import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Ledger } from '../server/ledger.mjs';
import { parseImport, columns, exportOperations } from '../server/csv.mjs';
const csv = (...rows) => [columns.join(','),...rows].join('\r\n');
const sale = 'sale,2026-10-24,Venta de prueba,100.00,UYU,,,hoja,A-01,Ventas';
function fixture(t){const ledger=new Ledger();ledger.workspace('test');t.after(()=>ledger.close());return ledger;}
test('CSV UTF-8 con comillas, comas y saltos de línea',()=>{
  const parsed=parseImport('\uFEFF'+csv('sale,2026-10-24,"Prueba, con ""comillas""\ny salto",100.00,UYU,,,hoja,A-01,Ventas'));
  assert.equal(parsed[0].concept,'Prueba, con "comillas"\ny salto');
});
test('CSV rechaza columnas extra, fechas inválidas, referencias ausentes y tipos no soportados',t=>{
  assert.throws(()=>parseImport('bad,header\nx,y'));
  assert.throws(()=>parseImport(csv(sale+',extra')));
  assert.throws(()=>parseImport(csv(sale.replace('A-01',''))));
  assert.throws(()=>parseImport(csv(sale.replace('sale','payment'))));
  assert.throws(()=>parseImport(csv(sale.replace('Venta de prueba','"bad'))));
  const ledger=fixture(t);assert.throws(()=>ledger.previewImport('test','actor',csv(sale.replace('2026-10-24','2026-02-30'))));
  assert.equal(ledger.snapshot('test').operations.length,0);
});
test('vista previa no persiste datos, solicitudes ni auditoría',t=>{
  const ledger=fixture(t);const preview=ledger.previewImport('test','actor',csv(sale));
  assert.equal(preview.created,1);assert.equal(ledger.snapshot('test').operations.length,0);assert.equal(ledger.snapshot('test').audit.length,0);
  assert.equal(ledger.db.prepare('SELECT COUNT(*) n FROM requests').get().n,0);
});
test('importación atómica, reimportación segura y conflictos explícitos',t=>{
  const ledger=fixture(t);const run=value=>ledger.command('test','actor',randomUUID(),{kind:'import',csv:value});
  assert.throws(()=>run(csv(sale,'expense,2026-10-24,Invalido,10,UYU,missing,,hoja,A-02,Gasto')));
  assert.equal(ledger.snapshot('test').operations.length,0);
  assert.equal(run(csv(sale)).created,1);assert.equal(run(csv(sale)).existing,1);
  assert.equal(ledger.snapshot('test').operations.length,1);
  assert.throws(()=>run(csv(sale.replace('100.00','200.00'))),/otros datos/);
});
test('exportación conserva referencias, neutraliza fórmulas y no mezcla totales',t=>{
  const ledger=fixture(t);ledger.command('test','actor',randomUUID(),{kind:'sale',date:'2026-10-24',concept:'=HYPERLINK("evil")',amount:'100',currency:'USD',source:'@source'});
  const result=exportOperations(ledger.snapshot('test'));
  assert.match(result,/'=HYPERLINK/);assert.match(result,/'@source/);assert.match(result,/"100.00"/);assert.match(result,/"USD"/);
});
test('la exportación formatea importes negativos sin romper el decimal',()=>{
  const rows=exportOperations({operations:[{id:'o1',kind:'expense',date:'2026-10-24',concept:'Ajuste',currency:'UYU',amount:-12345,applied:-200,source:'manual',external_id:null,related_id:null,category:null,due:null}]});
  // El guion inicial también dispara el guard anti-fórmulas, que antepone un apóstrofo.
  assert.ok(rows.includes(`"'-123.45"`));
  assert.ok(rows.includes(`"'-2.00"`));
  assert.ok(!rows.includes('.-'));
});
