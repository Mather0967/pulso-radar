// COMPONENTES DE PRUEBA. Proveedores simulados de Shopify y Meta Ads: sin red,
// sin secretos reales. El fetch falso responde JSON con las mismas formas que
// los proveedores (Link rel="next", paging.next), porque deduplicación,
// paginación y errores por fila son lo que LANDUR debe sostener.
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
