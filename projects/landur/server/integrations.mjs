// Conexiones externas: Shopify (ventas) y Meta Ads (gasto publicitario).
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
import { DomainError } from './ledger.mjs';

const CURRENCIES = ['UYU', 'USD', 'BRL'];
const SHOPIFY_VERSION = '2026-10';
const META_VERSION = 'v26.0';
const DAY = 24 * 60 * 60 * 1000;
const MAX_SYNC_DAYS = 92;

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
function externalExists(ledger, workspace, source, externalId) {
  return !!ledger.db.prepare('SELECT 1 FROM operations WHERE workspace=? AND source=? AND external_id=?').get(workspace, source, externalId);
}

function statusOne(ledger, workspace, name) {
  const row = connectionRow(ledger, workspace, name);
  if (!row) return { kind: name, configured: false };
  const { accessToken, ...visible } = readConfig(ledger, workspace, name);
  return { kind: name, configured: true, tokenMask: mask(accessToken), lastSync: visible.lastSync ?? null, updatedAt: row.updated_at, ...visible };
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
  const name = input?.kind === 'shopify' ? 'shopify' : input?.kind === 'meta' ? 'meta' : null;
  if (!name) throw new DomainError('Conexión no reconocida.', 404);
  const previous = readConfig(ledger, workspace, name);
  const config = {};
  const nextToken = typeof input?.accessToken === 'string' && input.accessToken.trim() ? input.accessToken.trim() : null;
  if (nextToken && nextToken.length > 2048) throw new DomainError('El token es demasiado largo.');
  if (name === 'shopify') {
    config.domain = normalizeShopifyDomain(input.domain);
    config.currency = input.currency !== undefined ? unitOf(input.currency) : previous?.currency;
    if (!config.currency) throw new DomainError('Seleccioná la moneda de la tienda (UYU, USD o BRL).');
    config.commission = parseMoney(input.commission ?? previous?.commission ?? '0');
    config.accountId = typeof input.accountId === 'string' && input.accountId.trim() ? input.accountId.trim() : previous?.accountId ?? '';
    config.accessToken = nextToken ?? previous?.accessToken ?? null;
    if (!config.accessToken)
      throw new DomainError('Falta el token de la app de Shopify (shpat_…). Copialo desde Apps desarrolladas → API credentials; se muestra una sola vez.');
    if (!SHOPIFY_TOKEN.test(config.accessToken))
      throw new DomainError('El token de Shopify empieza con "shp" (por ejemplo shpat_…). Revisá que copiaste el token completo de API credentials.');
  } else {
    const account = String(input.adAccountId ?? previous?.adAccountId ?? '').replace(/^act_/, '').trim();
    if (!/^\d{5,25}$/.test(account)) throw new DomainError('Ingresá el identificador del ad account: solo números, el mismo que aparece como act_<número> en Meta.');
    config.adAccountId = account;
    config.accountId = typeof input.accountId === 'string' && input.accountId.trim() ? input.accountId.trim() : previous?.accountId ?? '';
    config.accessToken = nextToken ?? previous?.accessToken ?? null;
    if (!config.accessToken)
      throw new DomainError('Falta el token de acceso de Meta. Generá uno de larga duración (System User) con el permiso ads_read.');
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
  const commission = parseMoney(config.commission ?? '0');
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
      if (Number(commission) >= Number(total)) { fail(`La comisión configurada (${commission}) no deja saldo por cobrar en ${label}. Revisá la comisión en Configuración.`); continue; }
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

// ................ superficie del módulo ................
export function createIntegrations({ fetchImpl = fetch } = {}) {
  function status(ledger, workspace) {
    return { shopify: statusOne(ledger, workspace, 'shopify'), meta: statusOne(ledger, workspace, 'meta') };
  }
  function save(ledger, workspace, actor, input) {
    const { name, config, previous } = validateSave(ledger, workspace, input);
    const stored = { ...config, lastSync: previous?.lastSync ?? null };
    ledger.db.prepare(`INSERT INTO connections (workspace,name,config,updated_at) VALUES (?,?,?,?)
      ON CONFLICT(workspace,name) DO UPDATE SET config=excluded.config, updated_at=excluded.updated_at`)
      .run(workspace, name, JSON.stringify(stored), new Date().toISOString());
    ledger.audit(workspace, actor, 'connection.saved', name);
    return { saved: true, status: statusOne(ledger, workspace, name) };
  }
  async function sync(ledger, workspace, actor, kind, input = {}) {
    if (kind !== 'shopify' && kind !== 'meta') throw new DomainError('Conexión no reconocida.', 404);
    const config = readConfig(ledger, workspace, kind);
    if (!config?.accessToken)
      throw new DomainError('Primero guardá la configuración de la conexión (token incluido) en Configuración.', 400);
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
  function finish(ledger, workspace, kind, summary, since, until) {
    const row = connectionRow(ledger, workspace, kind);
    if (row) {
      const config = readConfig(ledger, workspace, kind);
      config.lastSync = new Date().toISOString();
      ledger.db.prepare('UPDATE connections SET config=?, updated_at=? WHERE workspace=? AND name=?')
        .run(JSON.stringify(config), new Date().toISOString(), workspace, kind);
    }
    ledger.audit(workspace, 'sincronía', `sync.${kind}`, JSON.stringify({ since, until, created: summary.created.length, errors: summary.errors.length }));
    return { ...summary, since, until, lastSync: new Date().toISOString(), status: statusOne(ledger, workspace, kind) };
  }
  return { status, save, sync };
}
