// COMPONENTES DE PRUEBA. Proveedores simulados de Shopify, Meta Ads y Google Sheets:
// sin red, sin secretos reales. El fetch falso responde JSON con las mismas formas que
// los proveedores (Link rel="next", paging.next, values de Sheets), porque deduplicación,
// paginación y errores por fila son lo que LANDUR debe sostener.
import { generateKeyPairSync } from 'node:crypto';
import {Ledger} from '../../server/ledger.mjs';
import {createIntegrations} from '../../server/integrations.mjs';

const DAY = 24 * 60 * 60 * 1000;
const yesterday = new Date(Date.now() - DAY).toISOString().slice(0, 10);

const ordersPage = (page) => {
  const paid = i => ({
    id: 1000 + i, name: `#100${i}`, financial_status: 'paid', currency: 'USD', test: false,
    created_at: `2026-10-1${i}T12:0${i}:00Z`, total_price: `${100 + i}.50`,
    line_items: [{title: 'Buzo Landur', quantity: 2}],
  });
  const base = [
    paid(1), paid(2),
    {...paid(3), test: true},
    {...paid(4), cancelled_at: '2026-10-14T13:00:00Z'},
  ];
  if (page === 1) return {data: {orders: base.slice(0, 2)}, link: '<https://landur-qa.myshopify.com/admin/api/2026-10/orders.json?page_info=abc&limit=250>; rel="next"'};
  return {data: {orders: base.slice(2)}, link: null};
};

const accountUrl = 'https://landur-qa.myshopify.com/admin/api/2026-10/orders.json';

// La clave se genera en la prueba: el servidor firma un JWT de verdad, pero Google no está
// en el camino. Así la prueba cubre el firmado sin depender de credenciales.
const { privateKey: serviceAccountKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: {type: 'pkcs8', format: 'pem'},
  publicKeyEncoding: {type: 'spki', format: 'pem'},
});
export const serviceAccountJson = JSON.stringify({
  type: 'service_account',
  project_id: 'landur-qa',
  client_email: 'landur-qa@landur-qa.iam.gserviceaccount.com',
  private_key: serviceAccountKey,
});

export const SHEET_ID = 'SHEET_QA_1234567890abcdefghij';
// Mismas columnas que la planilla real del cliente (fragmento minorista).
const SHEET_HEADER = ['Fecha','Cliente','Canal','Nro. Pedido','Metodo de pago','Pedido','Unidades','Estado','Bruto','MP Fee','MP Neto','Material'];
const SHEET_ROWS = [
  SHEET_HEADER,
  [8,'Esteban Fernandez','Web','#1275','MP','2 ilumimate1 (Negro)',2,'Enviado',970,101,869,80],
  [9,'Patricia Martinez','Web','#1276','MP','1 Set Decantador Mundo',1,'Enviado',1680,174,1506,730],
  [9,'Mónica Elena','Web','#1277','MP','3 ilumimate 2.0 (Verde)',3,'Cancelado',1730,180,1550,120],
];
// La planilla real escribe el día suelto: el mes vive en el título de la pestaña.
const DAY_ONLY_ROWS = [SHEET_HEADER, [8,'Esteban Fernandez','Web','#1275','MP','2 ilumimate1 (Negro)',2,'Enviado',970,101,869,80]];

async function fakeFetch(url, options = {}) {
  const href = String(url);
  const respond = (body, headers = {}) => new Response(JSON.stringify(body), {status: 200, headers});
  if (href.startsWith(accountUrl)) {
    const page = href.includes('page_info=abc') ? 2 : 1;
    const {data, link} = ordersPage(page);
    return respond(data, link ? {Link: link} : {});
  }
  if (href.includes('act_900000000000000') && href.includes('fields=currency')) {
    return respond({currency: 'USD', name: 'Meta QA', account_status: 1});
  }
  if (href.includes('/insights')) {
    return respond({data: [
      {campaign_id: 77, campaign_name: 'Retargeting', account_currency: 'USD', spend: '12.34', date_start: yesterday},
      {campaign_id: 88, campaign_name: 'Greedo fish', account_currency: 'USD', spend: '5', date_start: yesterday},
      {campaign_id: 88, campaign_name: 'Greedo fish', account_currency: 'USD', spend: '0', date_start: yesterday},
    ], paging: {}});
  }
  if (href === 'https://oauth2.googleapis.com/token') {
    // Se comprueba la forma del JWT firmado: tres segmentos base64url.
    if (!/assertion=[\w-]+\.[\w-]+\.[\w-]+/.test(String(options.body || '')))
      return new Response(JSON.stringify({error: 'invalid_grant'}), {status: 400});
    return respond({access_token: 'ya29.fake', expires_in: 3600, token_type: 'Bearer'});
  }
  if (href.startsWith(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/`)) {
    if (!String(options.headers?.Authorization || '').startsWith('Bearer ya29.'))
      return new Response(JSON.stringify({error: {message: 'Unauthorized'}}), {status: 401});
    // Pestaña que no se compartió con la cuenta de servicio.
    if (href.includes('privada'))
      return new Response(JSON.stringify({error: {message: 'The caller does not have permission'}}), {status: 403});
    return respond({values: href.includes('solodia') ? DAY_ONLY_ROWS : SHEET_ROWS});
  }
  return new Response(JSON.stringify({error: 'offline'}), {status: 404});
}

export async function integrationsAgainst() {
  const ledger = new Ledger();
  ledger.workspace('landur');
  const account = ledger.command('landur', 'fixture', 'account-00000001', {kind: 'account', name: 'Banco QA', accountKind: 'bank', currency: 'USD', opening: '100', cutoff: '2026-10-01', verified: true, accessible: true});
  const connections = createIntegrations({fetchImpl: fakeFetch});
  return {ledger, connections, accountId: account.id};
}

export function saveShopify({currency = 'USD', accountId, ...rest} = {}) {
  return {kind: 'shopify', domain: 'landur-qa.myshopify.com', accessToken: `shpat_${'a'.repeat(32)}`, currency, commission: '2.00', accountId: accountId ?? null, ...rest};
}

export function saveMeta({accountId, ...rest} = {}) {
  return {kind: 'meta', adAccountId: '900000000000000', accessToken: `EAA${'x'.repeat(60)}`, accountId: accountId ?? null, ...rest};
}

export function saveSheets({currency = 'USD', accountId, sheetName = 'minorista', month = '2026-11', ...rest} = {}) {
  return {
    kind: 'sheets',
    spreadsheetId: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`,
    sheetName, month, currency, accountId: accountId ?? null,
    serviceAccount: serviceAccountJson,
    ...rest,
  };
}
