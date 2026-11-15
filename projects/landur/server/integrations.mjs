// Conexiones externas: Shopify (ventas), Meta Ads (gasto publicitario) y Google Sheets
// (las ventas que el cliente carga a mano en su planilla).
//
// Cada conexión guarda su configuración —token incluido— en la base privada del
// propio espacio (`connections`), nunca en localStorage, cookies ni logs. Los
// datos entran por el mismo `ledger.command` que la interfaz: deduplicación
// externa (source + external_id), auditoría y reversión auditada funcionan
// igual que los registros manuales. Sincronizar dos veces no duplica nada:
// las operaciones ya registradas se cuentan como omitidas.
//
// Las llamadas salientes van a hosts fijos (myshopify.com y graph.facebook.com):
// la configuración nunca construye URLs arbitrarias, así que la conexión no
// puede convertirse en SSRF. Los errores del proveedor llegan como mensajes
// accionables, sin exponer el token.
import { createHash, createSign } from 'node:crypto';
import { DomainError } from './ledger.mjs';

const CURRENCIES = ['UYU', 'USD', 'BRL'];
const SHOPIFY_VERSION = '2026-10';
const META_VERSION = 'v26.0';
const DAY = 24 * 60 * 60 * 1000;
const MAX_SYNC_DAYS = 92;
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const MAX_SHEET_ROWS = 5000;

const formatDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new DomainError('Indicá una fecha válida (AAAA-MM-DD).');
  return value;
};
const plusDays = (date, count = 1) => new Date(new Date(`${date}T12:00:00Z`).getTime() + count * DAY).toISOString().slice(0, 10);
const truncate = (value, max) => {
  const text = String(value ?? '').trim();
  return text.length <= max ? text : text.slice(0, Math.max(0, max - 1)).trimEnd() + '…';
};
const amountFrom = value => {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new DomainError('El importe del proveedor no se entiende como número.');
  return (Math.round(number * 100) / 100).toFixed(2);
};
const parseMoney = value => {
  if (typeof value !== 'string' || !/^-?\d+(\.\d{1,2})?$/.test(value)) throw new DomainError('La comisión debe ser una cifra con hasta 2 decimales (o 0).');
  return value;
};
const unitOf = value => {
  const unit = String(value ?? '').toUpperCase();
  if (!CURRENCIES.includes(unit)) throw new DomainError(`La moneda ${unit || 'desconocida'} no está admitida por LANDUR (UYU, USD o BRL) y no se hacen conversiones automáticas.`);
  return unit;
};
const dayInUruguay = iso => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montevideo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function callFetch(url, options, fetchImpl) {
  let response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(25000) });
  // Los proveedores piden pausa con 429 + Retry-After: se respeta una vez.
  if (response.status === 429) {
    const seconds = Math.min(20, Number(response.headers.get('retry-after')) || 2);
    await sleep(seconds * 1000);
    response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(25000) });
  }
  return response;
}

async function readProviderJson(response, label) {
  let text;
  try { text = await response.text(); }
  catch { throw new DomainError(`${label}: la respuesta del proveedor no se pudo leer.`); }
  let data;
  try { data = JSON.parse(text); }
  catch { throw new DomainError(`${label}: la respuesta del proveedor no es JSON válido.`); }
  if (!response.ok) {
    const detail = data?.error?.message ?? (typeof data?.error === 'string' ? data.error : null)
      ?? data?.error_description ?? data?.message
      ?? (Array.isArray(data?.errors) ? data.errors.map(String).join('; ') : data?.errors);
    if (response.status === 401 || response.status === 403)
      throw new DomainError(`${label}: el token no es válido o perdió el permiso. Actualizalo desde Configuración.`, 400);
    if (response.status === 429)
      throw new DomainError(`${label}: el proveedor está pidiendo pausa. Reintentá en unos minutos.`, 429);
    throw new DomainError(`${label}: ${truncate(detail, 160) || `falló la solicitud (${response.status}).`}`);
  }
  if (!data || typeof data !== 'object') throw new DomainError(`${label}: la respuesta del proveedor es inesperada.`);
  return data;
}

const mask = value => (typeof value === 'string' && value.length >= 10 ? `${value.slice(0, 6)}…${value.slice(-4)}` : '');

// ................ Google Sheets: validación ................
const foldCell = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// El enlace del navegador, el de «compartir» y el identificador suelto dicen lo mismo.
function normalizeSpreadsheet(value) {
  const text = String(value ?? '').trim();
  if (!text) throw new DomainError('Pegá el enlace o el identificador de la planilla de Google.');
  const fromUrl = text.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/);
  const id = fromUrl ? fromUrl[1] : text.replace(/[?#].*$/, '');
  if (!/^[A-Za-z0-9_-]{20,}$/.test(id))
    throw new DomainError('El identificador de la planilla no se reconoce: es la parte entre /d/ y /edit del enlace de Google Sheets.');
  return id;
}
// Una conexión lee una o varias pestañas de ventas, separadas por coma («minorista, mayorista»).
const sheetTabs = value => String(value ?? '').split(',').map(name => name.trim()).filter(Boolean);
function normalizeSheetName(value) {
  const names = [...new Set(sheetTabs(value))];
  if (!names.length) throw new DomainError('Indicá el nombre de la pestaña de la planilla (por ejemplo, minorista).');
  if (names.length > 4) throw new DomainError('Son demasiadas pestañas: indicá como máximo 4, separadas por coma.');
  for (const name of names)
    if (name.length > 80 || !/^[\p{L}\p{N} ._-]+$/u.test(name))
      throw new DomainError('El nombre de la pestaña solo admite letras, números, espacios, puntos, guiones y guiones bajos.');
  return names.join(', ');
}
function normalizeMonth(value) {
  const month = String(value ?? '').trim();
  if (!month) return '';
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new DomainError('El mes de la planilla se escribe AAAA-MM (por ejemplo, 2026-11).');
  return month;
}
// Los estados que significan «el dinero entró» los confirma el cliente: acá solo se guardan
// tal como los escribe. Vacío = comportamiento anterior (cobro en toda fila con comisión).
function normalizePaidStates(value) {
  const list = String(value ?? '').split(',').map(item => item.trim()).filter(Boolean);
  if (list.length > 12) throw new DomainError('Son demasiados estados: indicá como máximo 12, separados por coma.');
  for (const item of list) if (item.length > 40) throw new DomainError('Cada estado debe tener 40 caracteres o menos.');
  return [...new Set(list)].join(', ');
}
// Qué columna del material se registra como gasto. «real» es el costo efectivo; «plus10»
// incluye el 10 % que la planilla carga; «none» no registra gasto.
function normalizeMaterialColumn(value) {
  const option = String(value ?? 'real').trim();
  if (!['real', 'plus10', 'none'].includes(option)) throw new DomainError('Elegí qué valor de material se registra como gasto: el real, el que incluye el 10 % o ninguno.');
  return option;
}
// De la cuenta de servicio solo se guardan el correo y la clave: el resto del JSON no se usa
// y no tiene por qué quedar en la base ni volver nunca al navegador.
function normalizeServiceAccount(value, previous) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) {
    if (previous?.serviceAccount?.private_key) return previous.serviceAccount;
    throw new DomainError('Pegá el JSON de la cuenta de servicio de Google (el archivo que se descarga al crear la clave).');
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { throw new DomainError('El texto pegado no es un JSON válido: copiá el archivo completo de la cuenta de servicio.'); }
  const email = String(parsed?.client_email ?? '').trim();
  const privateKey = String(parsed?.private_key ?? '').trim();
  if (!/^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/.test(email))
    throw new DomainError('El JSON debe ser el de una cuenta de servicio: el correo (client_email) termina en .iam.gserviceaccount.com.');
  if (!/^-----BEGIN (RSA )?PRIVATE KEY-----/.test(privateKey) || !/-----END (RSA )?PRIVATE KEY-----$/.test(privateKey))
    throw new DomainError('Al JSON le falta la clave privada completa (private_key). Copialo de nuevo desde Google Cloud.');
  if (privateKey.length > 4096) throw new DomainError('La clave privada es demasiado larga.');
  return { client_email: email, private_key: privateKey };
}

// ................ Google Sheets: lectura ................
// Los importes llegan como número o como texto con separadores de miles: se aceptan las dos
// formas y un texto raro es un error de la fila, nunca un cero silencioso.
function sheetAmount(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return (Math.round(value * 100) / 100).toFixed(2);
  const raw = String(value ?? '').trim().replace(/[\s$]/g, '');
  if (!raw) return null;
  let text = raw;
  if (/^-?\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(text)) text = text.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(text)) text = text.replace(/,/g, '');
  else if (/^-?\d+([.,]\d{1,2})?$/.test(text)) text = text.replace(',', '.');
  else throw new DomainError(`«${truncate(raw, 24)}» no se entiende como importe.`);
  const number = Number(text);
  if (!Number.isFinite(number)) throw new DomainError(`«${truncate(raw, 24)}» no se entiende como importe.`);
  return (Math.round(number * 100) / 100).toFixed(2);
}
// La planilla real escribe el día suelto (8, 9) porque el mes está en el título de la pestaña.
// Con una fecha completa se usa esa; si solo hay día, hace falta el mes configurado: no se
// supone el mes del sistema, porque eso fecharía ventas en un período equivocado.
function monthDay(day, month, label) {
  if (!month) throw new DomainError(`${label}: la planilla trae solo el día (${day}). Indicá el mes de la planilla en la conexión para poder fecharlo.`);
  const iso = `${month}-${String(day).padStart(2, '0')}`;
  const parsed = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso)
    throw new DomainError(`${label}: el día ${day} no existe en ${month}.`);
  return iso;
}
// La planilla real escribe el mes en la primera fecha de cada tramo («Setiembre 16», «Octubre») y
// después solo el día (16, 17…). El mes escrito rige para las filas siguientes; antes de que
// aparezca uno, rige el mes configurado. El año sale del mes configurado: no se supone.
const MONTH_NAMES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, setiembre: 9, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
// `marker.month` (AAAA-MM) es el mes vigente y se actualiza cuando la planilla escribe uno.
function sheetDate(value, marker, label) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Las celdas de fecha de Google llegan como número de serie (días desde 1899-12-30); la parte
    // decimal es la hora: redondear fecharía en el día siguiente toda venta cargada después del mediodía.
    if (value >= 20000) return new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 864e5).toISOString().slice(0, 10);
    if (Number.isInteger(value) && value >= 1 && value <= 31) return monthDay(value, marker.month, label);
    throw new DomainError(`${label}: la fecha «${value}» no se entiende.`);
  }
  const text = String(value ?? '').trim();
  if (!text) {
    // La mayorista real no trae el día: se fecha el 1 del mes vigente (el de la planilla o el de la
    // conexión) y se informa cuántas filas quedaron así. Sin ningún mes, no se inventa nada.
    if (!marker.month) throw new DomainError(`${label}: falta la fecha. Completala en la planilla o indicá el mes de la planilla en la conexión.`);
    marker.approx = true;
    return `${marker.month}-01`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return formatDate(text);
  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) return formatDate(`${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`);
  if (/^\d{1,2}$/.test(text)) return monthDay(Number(text), marker.month, label);
  const named = foldCell(text).match(/^([a-z]+)(?: (\d{1,2}))?$/);
  const monthNumber = named && MONTH_NAMES[named[1]];
  if (monthNumber) {
    if (!marker.month) throw new DomainError(`${label}: la fecha dice «${truncate(text, 20)}» pero falta el año. Indicá el mes de la planilla en la conexión (por ejemplo, 2026-11).`);
    marker.month = `${marker.month.slice(0, 4)}-${String(monthNumber).padStart(2, '0')}`;
    if (!named[2]) { marker.approx = true; return `${marker.month}-01`; }
    return monthDay(Number(named[2]), marker.month, label);
  }
  throw new DomainError(`${label}: la fecha «${truncate(text, 20)}» no se entiende. Usá una columna de fecha real o indicá el mes de la planilla.`);
}
// «Transf.» es la marca de pago de la planilla: TRUE cuando el dinero llegó. Una celda vacía
// no es TRUE: no se registra un cobro que la planilla no confirma.
function sheetFlag(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : null;
  const text = foldCell(value);
  if (['true', 'verdadero', 'si', 'x', '1', 'yes'].includes(text)) return true;
  if (['false', 'falso', 'no', '0'].includes(text)) return false;
  return null;
}
const SHEET_COLUMNS = {
  date: ['fecha', 'dia', 'date'],
  customer: ['cliente', 'customer', 'nombre'],
  order: ['nro pedido', 'nro de pedido', 'numero de pedido', 'n de pedido', 'pedido nro', 'order'],
  detail: ['pedido', 'producto', 'detalle', 'descripcion'],
  units: ['unidades', 'cantidad', 'unid'],
  status: ['estado', 'estado del pedido', 'status'],
  // El canal de la venta (Web, Instagram, Mayorista…): viaja como categoría de la venta para que la lista de
  // Ventas distinga mayorista de minorista.
  channel: ['canal', 'channel'],
  gross: ['bruto', 'total', 'importe bruto'],
  fee: ['mp fee', 'fee', 'comision', 'comision mp', 'arancel'],
  net: ['mp neto', 'neto', 'importe neto'],
  // El cliente marca el pago en «Transf.» (TRUE/FALSE), no en «Estado» (eso es logística).
  paid: ['transf'],
  // La pestaña mayorista separa el costo real del material del valor con 10 % cargado.
  material: ['material real'],
  materialPlus: ['material 10', 'material + 10'],
  // La minorista tiene una sola columna de material y una de envío.
  materialMin: ['material'],
  shipping: ['envio', 'costo de envio'],
};
function sheetColumns(header) {
  const keys = header.map(foldCell);
  const map = {};
  for (const [field, names] of Object.entries(SHEET_COLUMNS)) map[field] = names.map(name => keys.indexOf(name)).find(index => index >= 0) ?? -1;
  return map;
}
// La primera fila con «Bruto» y algo que identifique la venta es el encabezado: arriba puede
// haber un título, una nota o una fila vacía.
function sheetHeaderIndex(rows) {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const keys = (rows[i] ?? []).map(foldCell);
    if (keys.includes('bruto') && (keys.includes('cliente') || keys.includes('producto') || keys.includes('nro pedido') || keys.includes('pedido'))) return i;
  }
  return -1;
}
// La cuenta de servicio firma un JWT (RS256) y lo cambia por un token de solo lectura: es el
// único camino que no obliga a publicar la planilla ni a guardar un secreto OAuth de usuario.
async function googleAccessToken(serviceAccount, fetchImpl) {
  const now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(value).toString('base64url');
  const header = encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = encode(JSON.stringify({ iss: serviceAccount.client_email, scope: SHEETS_SCOPE, aud: GOOGLE_TOKEN_URL, iat: now, exp: now + 3600 }));
  let signature;
  try {
    const signer = createSign('RSA-SHA256');
    signer.update(`${header}.${claims}`);
    signature = signer.sign(serviceAccount.private_key).toString('base64url');
  } catch {
    throw new DomainError('La clave privada de la cuenta de servicio no se pudo usar. Volvé a pegar el JSON completo.');
  }
  const payload = new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claims}.${signature}` });
  const response = await callFetch(GOOGLE_TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: String(payload) }, fetchImpl);
  let data;
  try { data = await readProviderJson(response, 'Google Sheets'); }
  catch (error) {
    // Un 429 no es una clave inválida: se deja pasar el mensaje de pausa.
    if (error instanceof DomainError && error.status === 429) throw error;
    throw new DomainError('Google rechazó la clave de la cuenta de servicio. Revisá que el JSON sea el correcto y que la API de Google Sheets esté habilitada en el proyecto.');
  }
  if (typeof data.access_token !== 'string' || !data.access_token)
    throw new DomainError('Google no devolvió un token para la cuenta de servicio. Revisá la clave y que la API de Google Sheets esté habilitada.');
  return data.access_token;
}

function connectionRow(ledger, workspace, name) {
  return ledger.db.prepare('SELECT config, updated_at FROM connections WHERE workspace=? AND name=?').get(workspace, name);
}
function readConfig(ledger, workspace, name) {
  const row = connectionRow(ledger, workspace, name);
  if (!row) return null;
  let config;
  try { config = JSON.parse(row.config); }
  catch { throw new DomainError('La configuración guardada de la conexión está dañada. Volvé a guardarla en Configuración.'); }
  if (!config || typeof config !== 'object') throw new DomainError('La configuración guardada de la conexión está dañada. Volvé a guardarla en Configuración.');
  return config;
}
// Una reversión no libera la referencia externa de la operación original (queda marcada, no se borra),
// así que una fila rehecha lleva otra versión: «row-X», «row-X-r2», «row-X-r3»… `live` es la vigente y
// `count` cuántas hubo (si hubo y ninguna está vigente, alguien la eliminó).
function externalVersions(ledger, workspace, base) {
  const rows = ledger.db.prepare("SELECT id, kind, amount, date, external_id, reversed_by FROM operations WHERE workspace=? AND source='sheets' AND substr(external_id,1,?)=?").all(workspace, base.length, base);
  const own = rows.filter(row => row.external_id === base || /^-r\d+$/.test(row.external_id.slice(base.length)));
  return { live: own.find(row => !row.reversed_by) ?? null, count: own.length, next: own.length ? `${base}-r${own.length + 1}` : base };
}
// La clave de idempotencia solo admite letras, números, guion y guion bajo y es única por versión.
const opKey = (prefix, external) => `${prefix}-${external.replace(/[^A-Za-z0-9_-]+/g, '-')}`.slice(0, 100);

function externalExists(ledger, workspace, source, externalId) {
  return !!ledger.db.prepare('SELECT 1 FROM operations WHERE workspace=? AND source=? AND external_id=?').get(workspace, source, externalId);
}

function statusOne(ledger, workspace, name) {
  const row = connectionRow(ledger, workspace, name);
  if (!row) return { kind: name, configured: false };
  // `imported` (las filas de la última lectura) es de uso interno: no viaja al navegador.
  const { accessToken, serviceAccount, imported, ...visible } = readConfig(ledger, workspace, name);
  return { kind: name, configured: true, tokenMask: mask(accessToken), clientEmail: serviceAccount?.client_email ?? null, keyMask: serviceAccount?.private_key ? 'Clave guardada' : null, lastSync: visible.lastSync ?? null, updatedAt: row.updated_at, ...visible };
}

// ................ validación y guardado ................
function normalizeShopifyDomain(value) {
  let host = String(value ?? '').trim().toLowerCase();
  if (!host) throw new DomainError('Ingresá el dominio de la tienda (por ejemplo, negocio.myshopify.com).');
  host = host.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(host))
    throw new DomainError('El dominio debe terminar en .myshopify.com: es el que aparece en el admin de Shopify.');
  return host;
}
const SHOPIFY_TOKEN = /^shp[a-z]{2,4}_[A-Za-z0-9]{16,64}$/;

function validateSave(ledger, workspace, input) {
  const name = ['shopify', 'meta', 'sheets'].includes(input?.kind) ? input.kind : null;
  if (!name) throw new DomainError('Conexión no reconocida.', 404);
  const previous = readConfig(ledger, workspace, name);
  const config = {};
  const nextToken = typeof input?.accessToken === 'string' && input.accessToken.trim() ? input.accessToken.trim() : null;
  if (nextToken && nextToken.length > 2048) throw new DomainError('El token es demasiado largo.');
  if (name === 'shopify') {
    config.domain = normalizeShopifyDomain(input.domain);
    config.currency = input.currency !== undefined ? unitOf(input.currency) : previous?.currency;
    if (!config.currency) throw new DomainError('Seleccioná la moneda de la tienda (UYU, USD o BRL).');
    config.accountId = typeof input.accountId === 'string' && input.accountId.trim() ? input.accountId.trim() : previous?.accountId ?? '';
    config.accessToken = nextToken ?? previous?.accessToken ?? null;
    if (!config.accessToken)
      throw new DomainError('Falta el token de la app de Shopify (shpat_…). Copialo desde Apps desarrolladas → API credentials; se muestra una sola vez.');
    if (!SHOPIFY_TOKEN.test(config.accessToken))
      throw new DomainError('El token de Shopify empieza con "shp" (por ejemplo shpat_…). Revisá que copiaste el token completo de API credentials.');
  } else if (name === 'meta') {
    const account = String(input.adAccountId ?? previous?.adAccountId ?? '').replace(/^act_/, '').trim();
    if (!/^\d{5,25}$/.test(account)) throw new DomainError('Ingresá el identificador del ad account: solo números, el mismo que aparece como act_<número> en Meta.');
    config.adAccountId = account;
    config.accountId = typeof input.accountId === 'string' && input.accountId.trim() ? input.accountId.trim() : previous?.accountId ?? '';
    config.accessToken = nextToken ?? previous?.accessToken ?? null;
    if (!config.accessToken)
      throw new DomainError('Falta el token de acceso de Meta. Generá uno de larga duración (System User) con el permiso ads_read.');
  } else {
    config.spreadsheetId = normalizeSpreadsheet(input.spreadsheetId ?? previous?.spreadsheetId);
    config.sheetName = normalizeSheetName(input.sheetName ?? previous?.sheetName ?? 'minorista');
    config.month = input.month === undefined ? previous?.month ?? '' : normalizeMonth(input.month);
    config.paidStates = input.paidStates === undefined ? previous?.paidStates ?? '' : normalizePaidStates(input.paidStates);
    config.materialColumn = input.materialColumn === undefined ? previous?.materialColumn ?? 'real' : normalizeMaterialColumn(input.materialColumn);
    config.currency = input.currency !== undefined ? unitOf(input.currency) : previous?.currency;
    if (!config.currency) throw new DomainError('Seleccioná la moneda de la planilla (UYU, USD o BRL).');
    config.accountId = typeof input.accountId === 'string' && input.accountId.trim() ? input.accountId.trim() : previous?.accountId ?? '';
    config.serviceAccount = normalizeServiceAccount(input.serviceAccount, previous);
  }
  return { name, config, previous };
}

// ................ sincronía Shopify ................
async function syncShopify(ledger, workspace, actor, config, since, until, fetchImpl) {
  const params = new URLSearchParams({
    status: 'any', financial_status: 'paid', limit: '250',
    updated_at_min: `${since}T00:00:00-03:00`,
  });
  if (until) params.set('updated_at_max', `${until}T23:59:59-03:00`);
  let url = `https://${config.domain}/admin/api/${SHOPIFY_VERSION}/orders.json?${params}`;
  const orders = [];
  for (let page = 0; url && page < 40; page++) {
    const response = await callFetch(url, { headers: { 'X-Shopify-Access-Token': config.accessToken, Accept: 'application/json' } }, fetchImpl);
    const data = await readProviderJson(response, 'Shopify');
    orders.push(...(Array.isArray(data.orders) ? data.orders : []));
    const next = response.headers.get('link')?.match(/<([^>]+)>;\s*rel="next"/)?.[1];
    url = next ? (next.startsWith('http') ? next : `https://${config.domain}${next}`) : null;
  }
  orders.sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')));

  let account = null;
  if (config.accountId) { try { account = ledger.account(workspace, config.accountId); } catch { account = null; } }
  // La comisión de Shopify no se estima acá: el cobro entra por el total de la orden y el
  // ajuste se hace después. Inventar un descuento dejaría el saldo por debajo de la realidad.
  const commission = '0.00';
  const created = [], skipped = { duplicadas: 0, prueba: 0, canceladas: 0, vacias: 0, sinCobro: 0 }, errors = [];
  let missingAccountAccounted = false;
  for (const order of orders) {
    const label = truncate(order.name || order.id || 'orden', 24);
    const fail = message => { errors.push({ id: label, message }); };
    try {
      if (order.test) { skipped.prueba++; continue; }
      if (order.cancelled_at) { skipped.canceladas++; continue; }
      if (order.financial_status === 'partially_refunded') { skipped.sinCobro++; continue; }
      if (order.financial_status !== 'paid') { skipped.sinCobro++; continue; }
      const total = amountFrom(order.total_price ?? '0');
      if (Number(total) <= 0) { skipped.vacias++; continue; }
      const currency = unitOf(order.currency);
      if (config.currency !== currency) { fail(`La moneda de la orden (${currency}) no coincide con la moneda de la conexión (${config.currency}). No se hacen conversiones automáticas.`); continue; }
      const day = dayInUruguay(order.created_at || '');
      const saleExternal = `order-${order.id}`;
      let saleRow = ledger.db.prepare('SELECT id FROM operations WHERE workspace=? AND source=? AND external_id=?').get(workspace, 'shopify', saleExternal);
      if (!saleRow) {
        const titles = (order.line_items ?? [])
          .map(item => `${item.title || ''}${item.quantity && item.quantity !== 1 ? ` × ${item.quantity}` : ''}`)
          .map(part => part.trim()).filter(Boolean).join(', ');
        const concept = truncate(titles ? `${order.name ?? 'Pedido'} · ${titles}` : `Pedido ${order.name ?? order.id}`, 115);
        const run = ledger.command(workspace, actor, truncate(`venta-shopify-${order.id}`, 100),
          { kind: 'sale', concept, amount: total, currency, date: day, source: 'shopify', externalId: saleExternal });
        created.push({ kind: 'sale', id: run.id, ref: label });
        saleRow = { id: run.id };
      }
      if (!account) {
        if (!missingAccountAccounted) { fail('Falta la cuenta donde registrar los cobros: elegila en Configuración (conexión Shopify).'); missingAccountAccounted = true; }
        continue;
      }
      if (account.currency !== currency) { fail(`La cuenta elegida maneja ${account.currency}; los cobros de esta orden son en ${currency}. Elegí una cuenta de esa moneda para la conexión.`); continue; }
      const collectionExternal = `order-${order.id}-cobro`;
      if (externalExists(ledger, workspace, 'shopify', collectionExternal)) { skipped.duplicadas++; continue; }
      const run = ledger.command(workspace, actor, truncate(`cobro-shopify-${order.id}`, 100),
        { kind: 'collection', concept: truncate(`Cobro · ${order.name ?? order.id}`, 115), accountId: account.id, targetId: saleRow.id, amount: total, currency, commission, date: day, source: 'shopify', externalId: collectionExternal });
      created.push({ kind: 'collection', id: run.id, ref: label });
    } catch (error) {
      if (error instanceof DomainError) fail(error.message);
      else throw error;
    }
  }
  return { source: 'shopify', orders: orders.length, created, skipped, errors };
}

// ................ sincronía Meta Ads ................
async function syncMeta(ledger, workspace, actor, config, since, until, fetchImpl) {
  const accountUrl = `https://graph.facebook.com/${META_VERSION}/act_${config.adAccountId}?fields=currency,name,account_status&access_token=${encodeURIComponent(config.accessToken)}`;
  const adAccount = await readProviderJson(await callFetch(accountUrl, {}, fetchImpl), 'Meta Ads');
  if (adAccount.account_status !== undefined && Number(adAccount.account_status) !== 1)
    throw new DomainError('El ad account de Meta no está activo. Revisá su estado en Ads Manager.');
  const adAccountCurrency = unitOf(adAccount.currency);

  const params = new URLSearchParams({
    level: 'campaign',
    fields: 'campaign_id,campaign_name,account_currency,spend',
    time_range: JSON.stringify({ since, until: plusDays(until) }),
    time_increment: '1',
    limit: '500',
  });
  let url = `https://graph.facebook.com/${META_VERSION}/act_${config.adAccountId}/insights?${params}`;
  const rows = [];
  for (let page = 0; url && page < 40; page++) {
    const response = await callFetch(url, { headers: { Authorization: `Bearer ${config.accessToken}`, Accept: 'application/json' } }, fetchImpl);
    const data = await readProviderJson(response, 'Meta Ads');
    rows.push(...(Array.isArray(data.data) ? data.data : []));
    url = typeof data.paging?.next === 'string' ? data.paging.next : null;
  }

  let account = null;
  if (config.accountId) { try { account = ledger.account(workspace, config.accountId); } catch { account = null; } }
  const created = [], skipped = { duplicadas: 0, sinGasto: 0 }, errors = [];
  for (const row of rows) {
    // Meta devuelve la fila diaria con date_start/date_stop, no con date.
    const day = String(row.date_start ?? row.date ?? '').slice(0, 10);
    const label = `${truncate(row.campaign_name || row.campaign_id || 'campaña', 30)} · ${day}`;
    const fail = message => { errors.push({ id: label, message }); };
    try {
      const spend = Number(row.spend ?? 0);
      if (!(spend > 0)) { skipped.sinGasto++; continue; }
      const currency = unitOf(row.account_currency);
      if (currency !== adAccountCurrency) { fail(`La fila reporta ${currency} pero el ad account maneja ${adAccountCurrency}.`); continue; }
      if (!account) { fail('Falta la cuenta donde registrar el gasto: elegila en Configuración (conexión Meta Ads).'); continue; }
      if (account.currency !== currency) { fail(`La cuenta elegida maneja ${account.currency}; el gasto es en ${currency}.`); continue; }
      formatDate(day);
      const externalId = `campaign-${row.campaign_id}-${day}`;
      if (externalExists(ledger, workspace, 'meta-ads', externalId)) { skipped.duplicadas++; continue; }
      const concept = truncate(`Publicidad · ${row.campaign_name || row.campaign_id || 'campaña'} · ${day}`, 115);
      const run = ledger.command(workspace, actor, truncate(`gasto-meta-${row.campaign_id}-${day}`, 100),
        { kind: 'expense', concept, amount: amountFrom(spend), currency, date: day, category: 'Publicidad', source: 'meta-ads', externalId, accountId: account.id });
      created.push({ kind: 'expense', id: run.id, ref: label });
    } catch (error) {
      if (error instanceof DomainError) fail(error.message);
      else throw error;
    }
  }
  return { source: 'meta-ads', adAccount: { name: truncate(adAccount.name, 60), currency: adAccountCurrency }, rows: rows.length, created, skipped, errors };
}

// ................ sincronía Google Sheets ................
// La planilla es la fuente de la venta: cada fila entra como venta y, si la conexión tiene
// cuenta, también su cobro con la comisión que figura en la propia fila (MP Fee, o Bruto −
// MP Neto). No se calcula nada que la planilla no diga: sin comisión no hay cobro.
async function syncSheets(ledger, workspace, actor, config, fetchImpl, options = {}) {
  // `restoreDeleted` viene de la pregunta de la app: la sincronía nunca rehace una venta
  // eliminada por su cuenta, porque eso sería decidir por el cliente.
  const restoreDeleted = options.restoreDeleted === true;
  const token = await googleAccessToken(config.serviceAccount, fetchImpl);
  // Se leen todas las pestañas antes de asentar nada: si una falla no se concilia ni se revierte nada
  // con media planilla (una pestaña ausente parecería «filas borradas»).
  const tabs = sheetTabs(config.sheetName);
  const several = tabs.length > 1;
  const sheets = [];
  for (const tab of tabs) {
    const where = several ? ` (pestaña «${tab}»)` : '';
    // El nombre de la pestaña va entre comillas: con espacios o puntos, la anotación A1 sin
    // comillas no es válida y Google rechaza la lectura.
    const range = `'${tab}'!A1:BZ${MAX_SHEET_ROWS}`;
    const url = `${SHEETS_API}/${config.spreadsheetId}/values/${encodeURIComponent(range)}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`;
    const response = await callFetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }, fetchImpl);
    // 403 no es un token vencido: es la planilla sin compartir con la cuenta de servicio.
    if (response.status === 403)
      throw new DomainError(`Google no dio permiso de lectura: compartí la planilla con ${config.serviceAccount.client_email} (permiso de solo lectura) y volvé a sincronizar.`);
    if (response.status === 404)
      throw new DomainError(`Google no encontró la planilla o la pestaña${where}. Revisá el enlace y el nombre de la pestaña en Configuración.`);
    const data = await readProviderJson(response, 'Google Sheets');
    const rows = Array.isArray(data.values) ? data.values : [];
    const headerIndex = sheetHeaderIndex(rows);
    if (headerIndex < 0)
      throw new DomainError(`La planilla${where} no tiene una fila de encabezados reconocible («Fecha», «Cliente» y «Bruto»). Revisá que la pestaña elegida sea la de ventas.`);
    const columns = sheetColumns(rows[headerIndex]);
    if (columns.gross < 0) throw new DomainError(`La planilla${where} no tiene una columna «Bruto»: no se puede saber el importe de cada venta.`);
    if (columns.date < 0) throw new DomainError(`La planilla${where} no tiene una columna «Fecha».`);
    sheets.push({ tab, rows, headerIndex, columns });
  }

  let account = null;
  if (config.accountId) { try { account = ledger.account(workspace, config.accountId); } catch { account = null; } }
  const created = [], skipped = { duplicadas: 0, canceladas: 0, vacias: 0, sinFecha: 0, sinCobro: 0, sinMaterial: 0, sinEnvio: 0, eliminadas: 0 }, errors = [], reverted = [];
  const beforeCutoff = { rows: 0, oldest: null };
  let read = 0, first = null, last = null, approxDates = 0;
  // Conciliación: lo que la planilla suma (toda fila con Bruto, también las omitidas) contra lo que
  // quedó asentado como venta. Si no coinciden, el resultado lo dice en vez de dejarlo a ojo.
  let sheetRows = 0, sheetCents = 0, appRows = 0, appCents = 0;
  const seenOrders = new Map(), identical = new Map();
  // Filas con referencia en esta lectura, y filas que no se pudieron leer: si alguna no se pudo
  // leer no se sabe si «falta» en la planilla o solo está mal escrita, y no se revierte nada.
  const presentRefs = new Set();
  let unkeyed = 0;
  const todayIso = new Date().toISOString().slice(0, 10);
  const reverseOp = (op, ref) => {
    ledger.command(workspace, actor, `reversal-planilla-${op.id}`, { kind: 'reversal', operationId: op.id, date: todayIso });
    reverted.push({ kind: op.kind, ref });
  };
  // Revierte la venta y lo que nació de ella (cobros, material, envío). Con cobros cargados a mano no
  // toca nada: lo que alguien asentó a mano no lo deshace una sincronización.
  const revertSale = (sale, ref) => {
    const dependents = ledger.db.prepare("SELECT id, kind, source FROM operations WHERE workspace=? AND related_id=? AND reversed_by IS NULL AND kind NOT IN ('reversal','commission')").all(workspace, sale.id);
    if (dependents.some(item => item.source !== 'sheets'))
      throw new DomainError(`La venta ${ref} cambió en la planilla, pero tiene cobros cargados a mano: revertilos en LANDUR y volvé a sincronizar.`);
    for (const item of dependents) reverseOp(item, ref);
    for (const suffix of ['-material', '-envio']) {
      const { live } = externalVersions(ledger, workspace, `${sale.external_id}${suffix}`);
      if (live) reverseOp(live, ref);
    }
    reverseOp(sale, ref);
  };
  const syncExpense = ({ saleExternal, suffix, cell: raw, concept, category, date, label, skipKey, what }) => {
    const value = sheetAmount(raw);
    if (value !== null && Number(value) < 0) { errors.push({ id: label, message: `${what} de la fila es negativo (${value}). Revisá la planilla.` }); return; }
    const cents = value === null ? 0 : Math.round(Number(value) * 100);
    const base = `${saleExternal}${suffix}`;
    let found = externalVersions(ledger, workspace, base);
    let reversedHere = false;
    if (found.live && (cents === 0 || found.live.amount !== cents || found.live.date !== date)) {
      reverseOp(found.live, label);
      reversedHere = true;
      found = externalVersions(ledger, workspace, base);
    }
    if (cents === 0 || found.live) return;
    // Un gasto eliminado en LANDUR vuelve solo junto con las ventas eliminadas (`restoreDeleted`).
    if (found.count > 0 && !reversedHere && !restoreDeleted) return;
    if (!account) { skipped[skipKey]++; return; }
    const run = ledger.command(workspace, actor, opKey(suffix === '-material' ? 'material-planilla' : 'envio-planilla', found.next),
      { kind: 'expense', concept: truncate(concept, 115), amount: value, currency: config.currency, date, category, accountId: account.id, source: 'sheets', externalId: found.next });
    created.push({ kind: 'expense', id: run.id, ref: label });
  };
  // La cuenta guardada puede haberse eliminado después: se avisa una vez y se siguen
  // registrando las ventas, que no dependen de una cuenta.
  const accountMissing = Boolean(config.accountId) && !account;
  let accountWarned = false;
  for (const { tab, rows, headerIndex, columns } of sheets) {
    // El mes vigente arranca en el de la conexión en cada pestaña (cada una tiene su propia cronología).
    const marker = { month: config.month, approx: false };
    // Material: en la mayorista «Material Real» o «Material + 10 %» según la conexión; la minorista tiene
    // una sola columna. «No registrar gasto» apaga material y envío.
    const wantedMaterial = config.materialColumn === 'plus10' ? 'materialPlus' : 'material';
    const materialField = config.materialColumn === 'none' ? null : columns[wantedMaterial] >= 0 ? wantedMaterial : columns.materialMin >= 0 ? 'materialMin' : null;
    const shippingField = config.materialColumn === 'none' || columns.shipping < 0 ? null : 'shipping';
    for (let index = headerIndex + 1; index < rows.length; index++) {
      const row = rows[index] ?? [];
      const cell = field => (columns[field] >= 0 ? row[columns[field]] : undefined);
      const customer = String(cell('customer') ?? '').trim();
      const detail = String(cell('detail') ?? '').trim();
      const order = String(cell('order') ?? '').trim();
      const channel = String(cell('channel') ?? '').trim();
      const label = truncate((several ? `${tab} · ` : '') + ([customer, detail].filter(Boolean).join(' · ') || `fila ${index + 1}`), several ? 44 : 32);
      const fail = message => { errors.push({ id: label, message }); };
      let keyed = false;
      try {
        const gross = sheetAmount(cell('gross'));
        // Una fila sin nada escrito (fórmulas pre-armadas, formato hasta el final de la hoja) no es una
        // venta «sin importe»: no se cuenta ni se informa.
        if (gross === null && !customer && !detail && !order) continue;
        if (gross === null || Number(gross) <= 0) { skipped.vacias++; continue; }
        read++;
        sheetRows++; sheetCents += Math.round(Number(gross) * 100);
        if (accountMissing && !accountWarned) {
          fail('La cuenta elegida para la conexión ya no existe: elegí otra en Configuración.');
          accountWarned = true;
        }
        const cancelled = /cancel|anulad|reembols|devol/.test(foldCell(cell('status')));
        // La fecha se lee también en las canceladas: puede traer el mes que rige para las filas de abajo.
        let date;
        marker.approx = false;
        try { date = sheetDate(cell('date'), marker, label); }
        catch (error) {
          if (!(error instanceof DomainError)) throw error;
          if (cancelled) { skipped.canceladas++; continue; }
          skipped.sinFecha++; unkeyed++; fail(error.message); continue;
        }
        if (cancelled) { skipped.canceladas++; continue; }
        if (marker.approx) approxDates++;
        if (!first || date < first) first = date;
        if (!last || date > last) last = date;
        const units = Number(cell('units'));
        // La referencia de la orden cuando existe; si no, una huella estable de la fila: así
        // repetir la sincronía no duplica aunque la pestaña no tenga número de pedido.
        let reference = order;
        if (order) {
          // Un Nro. Pedido repetido en la misma planilla no se funde en silencio con el anterior.
          if (seenOrders.has(order)) { fail(`El Nro. Pedido ${order} está repetido en la planilla (filas ${seenOrders.get(order)} y ${index + 1}): solo se registra la primera. Revisá el número.`); continue; }
          seenOrders.set(order, index + 1);
        } else {
          // Sin número de pedido, dos filas idénticas (misma venta cargada dos veces el mismo día) son
          // dos ventas: la repetición se numera por orden de aparición, estable entre sincronías.
          const fingerprint = createHash('sha256').update(JSON.stringify([date, customer, detail, gross, Number.isFinite(units) ? units : null])).digest('hex').slice(0, 16);
          const nth = (identical.get(fingerprint) ?? 0) + 1;
          identical.set(fingerprint, nth);
          reference = nth > 1 ? `${fingerprint}-${nth}` : fingerprint;
        }
        keyed = true;
        const base = `row-${reference}`;
        presentRefs.add(base);
        const saleCents = Math.round(Number(gross) * 100);
        let found = externalVersions(ledger, workspace, base);
        let reversedNow = false;
        if (found.live && (found.live.amount !== saleCents || found.live.date !== date)) {
          // La fila cambió después de sincronizarla (importe o fecha): se revierte lo asentado y se
          // vuelve a registrar con lo que dice la planilla. Con cobros cargados a mano no se toca.
          revertSale(found.live, label);
          reversedNow = true;
          found = externalVersions(ledger, workspace, base);
        }
        // Una venta que se eliminó en LANDUR y sigue en la planilla no se rehace sola: se cuenta y la app
        // pregunta si hay que agregar también las eliminadas (`restoreDeleted`). Rehacer una fila que esta
        // misma sincronía acaba de revertir por un cambio en la planilla no es eso, y sí se hace.
        if (!found.live && found.count > 0 && !reversedNow && !restoreDeleted) { skipped.eliminadas++; continue; }
        const saleExternal = found.live ? found.live.external_id : found.next;
        let saleRow = found.live;
        if (!saleRow) {
          const concept = truncate([order ? `Pedido ${order}` : '', customer, detail].filter(Boolean).join(' · ') || 'Venta de planilla', 115);
          const run = ledger.command(workspace, actor, opKey('venta-planilla', saleExternal),
            { kind: 'sale', concept, amount: gross, currency: config.currency, date, source: 'sheets', externalId: saleExternal, ...(channel ? { category: truncate(channel, 60) } : {}) });
          created.push({ kind: 'sale', id: run.id, ref: label });
          saleRow = { id: run.id };
        }
        appRows++; appCents += saleCents;
        // LANDUR no asienta cobros ni gastos anteriores al saldo inicial de la cuenta: la venta entra, el resto
        // no. Se cuenta y se avisa una sola vez (con la fecha más vieja) en vez de repetir el error por fila.
        if (account && date < account.cutoff) { beforeCutoff.rows++; if (!beforeCutoff.oldest || date < beforeCutoff.oldest) beforeCutoff.oldest = date; continue; }
        // Gastos de la fila: material y envío salen de la misma cuenta que los cobros. Sin cuenta no
        // hay caja donde asentarlos, así que no se registran. Un valor editado se revierte y se rehace.
        if (materialField) syncExpense({ saleExternal, suffix: '-material', cell: cell(materialField), concept: `Material · ${detail || customer || 'planilla'}`, category: 'Materiales', date, label, skipKey: 'sinMaterial', what: 'El material' });
        if (shippingField) syncExpense({ saleExternal, suffix: '-envio', cell: cell(shippingField), concept: `Envío · ${order || customer || detail || 'planilla'}`, category: 'Envíos', date, label, skipKey: 'sinEnvio', what: 'El envío' });
        // Sin cuenta elegida se registran solo las ventas: el cobro no se inventa.
        if (!account) continue;
        // La planilla marca el pago en «Transf.»: sin TRUE no hay cobro, sin importar qué diga
        // «Estado» (que es logística) ni si hay comisión en la fila. Un cobro ya asentado de una fila
        // que deja de estar transferida se revierte más abajo, con el resto de los cambios del cobro.
        let unpaid = false;
        if (columns.paid >= 0) {
          const flag = cell('paid');
          const paid = sheetFlag(flag);
          if (paid === null && String(flag ?? '').trim() !== '') {
            fail(`La columna «Transf.» tiene un valor que no se entiende («${truncate(String(flag), 12)}»). Usá TRUE o FALSE.`);
            continue;
          }
          unpaid = paid !== true;
        }
        // Si el cliente indicó qué estados significan «cobrado», una fila en otro estado deja
        // su venta y no genera cobro. Sin estados configurados se mantiene el comportamiento
        // anterior: el cobro se registra siempre que la fila traiga comisión.
        const paidStates = String(config.paidStates || '').split(',').map(foldCell).filter(Boolean);
        if (paidStates.length > 0 && !paidStates.includes(foldCell(cell('status')))) unpaid = true;
        let commission = null;
        if (!unpaid) {
          const fee = columns.fee >= 0 ? sheetAmount(cell('fee')) : null;
          if (fee !== null) commission = fee;
          else if (columns.net >= 0) {
            const net = sheetAmount(cell('net'));
            if (net !== null) commission = (Math.round((Number(gross) - Number(net)) * 100) / 100).toFixed(2);
          }
        }
        // Una pestaña sin columna de comisión (la mayorista) no tiene qué descontar: con «Transf.» en TRUE el
        // cobro entra completo, sin comisión. Con la columna presente y vacía sigue sin cobro (dato que falta).
        if (commission === null && !unpaid && columns.paid >= 0 && columns.fee < 0 && columns.net < 0) commission = '0.00';
        const collect = !unpaid && commission !== null;
        if (collect) {
          if (Number(commission) < 0) { fail(`La comisión de la fila es negativa (${commission}). Revisá la planilla.`); continue; }
          if (Number(commission) >= Number(gross)) { fail(`La comisión de la fila (${commission}) no deja saldo por cobrar. Revisá la planilla.`); continue; }
          if (account.currency !== config.currency) { fail(`La cuenta elegida maneja ${account.currency}; la planilla está en ${config.currency}.`); continue; }
        }
        const collectionBase = `${saleExternal}-cobro`;
        let collection = externalVersions(ledger, workspace, collectionBase);
        if (collection.live) {
          const liveCommission = ledger.db.prepare("SELECT COALESCE(SUM(amount),0) n FROM operations WHERE workspace=? AND related_id=? AND kind='commission' AND reversed_by IS NULL").get(workspace, collection.live.id).n;
          if (collect && collection.live.amount === saleCents && collection.live.date === date && liveCommission === Math.round(Number(commission) * 100)) { skipped.duplicadas++; continue; }
          // El estado, la comisión o la fecha cambiaron: el cobro asentado ya no es el de la planilla.
          reverseOp(collection.live, label);
          collection = externalVersions(ledger, workspace, collectionBase);
        }
        if (!collect) { skipped.sinCobro++; continue; }
        const run = ledger.command(workspace, actor, opKey('cobro-planilla', collection.next),
          { kind: 'collection', concept: truncate(`Cobro · ${order || customer || 'planilla'}`, 115), accountId: account.id, targetId: saleRow.id, amount: gross, currency: config.currency, commission, date, source: 'sheets', externalId: collection.next });
        created.push({ kind: 'collection', id: run.id, ref: label });
      } catch (error) {
        if (!(error instanceof DomainError)) throw error;
        if (!keyed) unkeyed++;
        fail(error.message);
      }
    }
  }
  if (beforeCutoff.rows)
    errors.push({ id: 'Saldo inicial', message: `${beforeCutoff.rows} ${beforeCutoff.rows === 1 ? 'fila tiene' : 'filas tienen'} fecha anterior al saldo inicial de la cuenta (${account.cutoff}), la más vieja del ${beforeCutoff.oldest}: LANDUR registró las ventas, pero no sus cobros ni sus gastos. Mové el saldo inicial de la cuenta a una fecha anterior al ${beforeCutoff.oldest}.` });
  // Filas que ya estaban asentadas y la planilla ya no tiene (borradas, canceladas, con otro número):
  // se revierten, para que LANDUR quede igual a la planilla. Solo se compara contra la lectura anterior
  // de ESTA misma pestaña, y solo si esta lectura pudo ubicar todas sus filas.
  const sheetKey = `${config.spreadsheetId}|${config.sheetName}`;
  const previous = config.imported?.key === sheetKey && Array.isArray(config.imported.refs) ? config.imported.refs : [];
  const gone = previous.filter(ref => !presentRefs.has(ref));
  let reconciled = unkeyed === 0;
  if (gone.length && reconciled && gone.length > 5 && gone.length > previous.length / 2) {
    // Una pestaña equivocada o vaciada por error haría desaparecer media contabilidad: no se toca.
    errors.push({ id: 'Planilla', message: `La planilla perdió ${gone.length} de ${previous.length} filas respecto de la sincronización anterior: no se revirtió nada. Revisá que sea la pestaña correcta.` });
    reconciled = false;
  } else if (gone.length && reconciled) {
    for (const base of gone) {
      const { live } = externalVersions(ledger, workspace, base);
      if (!live) continue;
      try { revertSale(live, base.slice(4)); }
      catch (error) { if (error instanceof DomainError) errors.push({ id: base.slice(4), message: error.message }); else throw error; }
    }
  }
  // Si algo quedó sin ubicar o sin revertir, se conserva la lista anterior para no olvidar esas filas.
  const nextImported = { key: sheetKey, refs: reconciled ? [...presentRefs] : [...new Set([...previous, ...presentRefs])] };
  return { source: 'sheets', rows: read, sheet: { name: config.sheetName }, since: first, until: last, created, skipped, errors, reverted, approxDates,
    totals: { sheetRows, sheetCents, appRows, appCents }, nextImported };
}

// ................ superficie del módulo ................
export function createIntegrations({ fetchImpl = fetch } = {}) {
  function status(ledger, workspace) {
    return { shopify: statusOne(ledger, workspace, 'shopify'), meta: statusOne(ledger, workspace, 'meta'), sheets: statusOne(ledger, workspace, 'sheets') };
  }
  function save(ledger, workspace, actor, input) {
    const { name, config, previous } = validateSave(ledger, workspace, input);
    const stored = { ...config, lastSync: previous?.lastSync ?? null, ...(previous?.imported ? { imported: previous.imported } : {}) };
    ledger.db.prepare(`INSERT INTO connections (workspace,name,config,updated_at) VALUES (?,?,?,?)
      ON CONFLICT(workspace,name) DO UPDATE SET config=excluded.config, updated_at=excluded.updated_at`)
      .run(workspace, name, JSON.stringify(stored), new Date().toISOString());
    ledger.audit(workspace, actor, 'connection.saved', name);
    return { saved: true, status: statusOne(ledger, workspace, name) };
  }
  // Botón, aviso de la planilla y reloj pueden coincidir: dos lecturas a la vez se pisarían al
  // asentar las mismas filas. Quien llega con una sincronía en curso recibe esa misma.
  const running = new Map();
  function sync(ledger, workspace, actor, kind, input = {}) {
    const key = `${workspace}:${kind}`;
    if (running.has(key)) return running.get(key);
    const promise = Promise.resolve().then(() => runSync(ledger, workspace, actor, kind, input)).finally(() => running.delete(key));
    running.set(key, promise);
    return promise;
  }
  async function runSync(ledger, workspace, actor, kind, input = {}) {
    if (!['shopify', 'meta', 'sheets'].includes(kind)) throw new DomainError('Conexión no reconocida.', 404);
    const config = readConfig(ledger, workspace, kind);
    const ready = kind === 'sheets' ? config?.serviceAccount?.private_key : config?.accessToken;
    if (!ready)
      throw new DomainError('Primero guardá la configuración de la conexión en Configuración.', 400);
    // La planilla se lee entera (una pestaña por mes o por libro): no hay ventana que recortar.
    if (kind === 'sheets') {
      const { nextImported, ...summary } = await syncSheets(ledger, workspace, actor, config, fetchImpl, { restoreDeleted: input.restoreDeleted === true });
      return finish(ledger, workspace, kind, summary, summary.since, summary.until, nextImported);
    }
    let since = input.since !== undefined ? formatDate(input.since)
      : (typeof config.lastSync === 'string' && /^\d{4}-\d{2}-\d{2}/.test(config.lastSync) ? config.lastSync.slice(0, 10) : new Date(Date.now() - 30 * DAY).toISOString().slice(0, 10));
    if (kind === 'shopify') {
      const until = input.until !== undefined ? (input.until === null ? null : formatDate(input.until)) : null;
      if (until && new Date(`${until}T12:00:00Z`) < new Date(`${since}T12:00:00Z`))
        throw new DomainError('La ventana de sincronización está invertida: "desde" es posterior a "hasta".');
      const summary = await syncShopify(ledger, workspace, actor, config, since, until, fetchImpl);
      return finish(ledger, workspace, kind, summary, since, until);
    }
    const until = input.until !== undefined ? formatDate(input.until) : new Date(Date.now() - DAY).toISOString().slice(0, 10);
    // El día en curso no está consolidado en Meta: el cierre es el día anterior.
    // Si la última sincronía fue hoy, la ventana no se invierte: se recorta "desde"
    // al día anterior y la deduplicación absorbe el solape.
    if (new Date(`${until}T12:00:00Z`) < new Date(`${since}T12:00:00Z`) && input.until === undefined)
      since = until;
    else if (new Date(`${until}T12:00:00Z`) < new Date(`${since}T12:00:00Z`))
      throw new DomainError('La ventana de sincronización está invertida: "desde" es posterior a "hasta".');
    const days = (new Date(`${until}T12:00:00Z`) - new Date(`${since}T12:00:00Z`)) / DAY + 1;
    if (days > MAX_SYNC_DAYS) throw new DomainError(`Como máximo ${MAX_SYNC_DAYS} días por sincronía.`);
    const summary = await syncMeta(ledger, workspace, actor, config, since, until, fetchImpl);
    return finish(ledger, workspace, kind, summary, since, until);
  }
  function finish(ledger, workspace, kind, summary, since, until, imported) {
    const row = connectionRow(ledger, workspace, kind);
    if (row) {
      const config = readConfig(ledger, workspace, kind);
      config.lastSync = new Date().toISOString();
      if (imported) config.imported = imported;
      ledger.db.prepare('UPDATE connections SET config=?, updated_at=? WHERE workspace=? AND name=?')
        .run(JSON.stringify(config), new Date().toISOString(), workspace, kind);
    }
    ledger.audit(workspace, 'sincronía', `sync.${kind}`, JSON.stringify({ since, until, created: summary.created.length, reverted: summary.reverted?.length ?? 0, errors: summary.errors.length }));
    return { ...summary, since, until, lastSync: new Date().toISOString(), status: statusOne(ledger, workspace, kind) };
  }
  return { status, save, sync };
}
