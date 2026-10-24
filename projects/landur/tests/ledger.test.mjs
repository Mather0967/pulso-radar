import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Ledger, money } from '../server/ledger.mjs';

function fixture(t) {
  const ledger = new Ledger(); ledger.workspace('a'); ledger.workspace('b'); t.after(() => ledger.close());
  const run = (input, key = randomUUID(), workspace = 'a') => ledger.command(workspace, 'tester', key, input);
  const account = (extra = {}) => run({ kind:'account', name:'Banco', accountKind:'bank', currency:'UYU',opening:'60000',cutoff:'2026-10-01',verified:true,accessible:true,...extra }).id;
  const op = (kind, extra = {}) => ({kind,concept:'Prueba sintética',amount:'1490',currency:'UYU',date:'2026-10-24',...extra});
  return {ledger,run,account,op};
}

test('precision monetaria y rechazo de importes inválidos', () => {
  assert.equal(money('0,10') + money('0.20'), 30);
  assert.equal(money('10.3'), 1030);
  for (const invalid of [1, null, undefined, '', '-1','1e3','1.001','1.000,00','0','NaN','Infinity']) assert.throws(() => money(invalid));
  assert.equal(money('0',{zero:true}),0);
});
test('transferencia conserva fondos y no genera ingresos/gastos', t => {
  const {ledger,run,account,op} = fixture(t);
  const a=account(), b=account({name:'Caja',accountKind:'cash',opening:'0'});
  run(op('transfer',{accountId:a,toAccountId:b}));
  const state=ledger.snapshot('a');
  assert.equal(state.totals[0].balance,6000000); assert.equal(state.totals[0].expenses,0); assert.equal(state.totals[0].sales,0);
  assert.equal(state.accounts.find(x=>x.id===b).balance,149000);
});
test('factura y pagos parciales no duplican gasto ni sobreaplican deuda', t => {
  const {ledger,run,account,op}=fixture(t); const bank=account();
  const obligation=run(op('obligation',{due:'2026-10-28'})).id;
  assert.equal(ledger.snapshot('a').totals[0].balance,6000000);
  run(op('payment',{accountId:bank,targetId:obligation,amount:'1000'}));
  assert.equal(ledger.snapshot('a').totals[0].payable,49000);
  assert.throws(()=>run(op('payment',{accountId:bank,targetId:obligation,amount:'500'})), /supera/);
  run(op('payment',{accountId:bank,targetId:obligation,amount:'490'}));
  const state=ledger.snapshot('a'); assert.equal(state.totals[0].payable,0); assert.equal(state.totals[0].expenses,149000);
  assert.equal(state.totals[0].balance,5851000);
});
test('venta + cobro con comisión + traslado no triplica ingreso', t => {
  const {ledger,run,account,op}=fixture(t); const mp=account({opening:'0',accountKind:'wallet'}),bank=account({opening:'0'});
  const sale=run(op('sale',{amount:'3200',source:'shopify',externalId:'1042'})).id;
  run(op('collection',{amount:'3200',accountId:mp,targetId:sale,commission:'331.20',source:'mp',externalId:'1042'}));
  run(op('transfer',{amount:'2868.80',accountId:mp,toAccountId:bank}));
  const totals=ledger.snapshot('a').totals[0];
  assert.equal(totals.sales,320000); assert.equal(totals.balance,286880); assert.equal(totals.expenses,33120); assert.equal(totals.receivable,0);
});
test('comisión desconocida no se sustituye por 10,35 %', t => {
  const {ledger,run,account,op}=fixture(t);const bank=account();const sale=run(op('sale')).id;
  assert.throws(()=>run(op('collection',{accountId:bank,targetId:sale})), /comisión real/);
  assert.equal(ledger.snapshot('a').operations.length,1);
});
test('reintento idempotente y conflicto al reutilizar clave con otra operación', t => {
  const {ledger,run,account,op}=fixture(t);const bank=account(),key=randomUUID();
  const input=op('expense',{accountId:bank});const first=run(input,key);const replay=run(input,key);
  assert.equal(first.id,replay.id);assert.equal(replay.replayed,true);
  assert.throws(()=>run({...input,amount:'1500'},key), /otra operación/);
  assert.equal(ledger.snapshot('a').operations.length,1);assert.equal(ledger.snapshot('a').audit.length,2);
});
test('referencia externa única; dos movimientos legítimos iguales no se fusionan', t => {
  const {ledger,run,account,op}=fixture(t);const bank=account();
  const input=op('expense',{accountId:bank});run(input);run(input);
  run({...input,source:'extracto',externalId:'x'});
  assert.throws(()=>run({...input,source:'extracto',externalId:'x'}),/ya está registrada/);
  assert.equal(ledger.snapshot('a').operations.length,3);
});
test('cuentas y objetivos de otro espacio son inaccesibles', t => {
  const {ledger,run,account,op}=fixture(t);const bank=account();
  assert.throws(()=>run(op('expense',{accountId:bank}),randomUUID(),'b'),/cuenta no existe/);
  assert.equal(ledger.snapshot('b').operations.length,0);assert.equal(ledger.snapshot('b').accounts.length,0);
  const foreign=run(op('obligation',{due:'2026-10-30'}),randomUUID(),'b').id;
  assert.throws(()=>run(op('payment',{accountId:bank,targetId:foreign})),/operación asociada/);
});
test('monedas separadas y corte inicial respetado', t => {
  const {ledger,run,account,op}=fixture(t);const uyu=account(),usd=account({currency:'USD',opening:'100'});
  assert.throws(()=>run(op('transfer',{accountId:uyu,toAccountId:usd})),/moneda/);
  assert.throws(()=>run(op('expense',{accountId:uyu,date:'2026-09-30'})),/anterior/);
  assert.equal(ledger.snapshot('a').totals.length,2);assert.equal(ledger.snapshot('a').entries.length,0);
});
test('transferencia fallida revierte todas las escrituras', t => {
  const {ledger,run,account,op}=fixture(t);const bank=account();
  assert.throws(()=>run(op('transfer',{accountId:bank,toAccountId:'missing'})));
  assert.equal(ledger.snapshot('a').entries.length,0);assert.equal(ledger.snapshot('a').operations.length,0);
  assert.equal(ledger.snapshot('a').audit.length,1);
});
test('retiro personal no es gasto y disponible sigue pendiente', t => {
  const {ledger,run,account,op}=fixture(t);run(op('withdrawal',{accountId:account()}));
  const totals=ledger.snapshot('a').totals[0];assert.equal(totals.expenses,0);assert.equal(totals.withdrawals,149000);assert.equal(totals.available,null);
});
test('fechas imposibles rechazadas sin escrituras parciales', t => {
  const {ledger,run,op}=fixture(t);assert.throws(()=>run(op('obligation',{due:'2026-02-30'})),/fecha válida/);
  assert.equal(ledger.snapshot('a').operations.length,0);
});
test('dos conexiones serializan aplicación de pagos', t => {
  const dir=mkdtempSync(join(tmpdir(),'landur-concurrency-'));const file=join(dir,'test.sqlite');
  const a=new Ledger(file),b=new Ledger(file);t.after(()=>{a.close();b.close();rmSync(dir,{recursive:true,force:true});});
  a.workspace('a');const cmd=(db,input)=>db.command('a','test',randomUUID(),input);
  const account=cmd(a,{kind:'account',name:'Caja',accountKind:'cash',currency:'UYU',opening:'200',cutoff:'2026-10-01',verified:true,accessible:true}).id;
  const obligation=cmd(a,{kind:'obligation',amount:'100',concept:'Prueba',currency:'UYU',date:'2026-10-24',due:'2026-10-28'}).id;
  const payment={kind:'payment',amount:'70',concept:'Prueba',currency:'UYU',date:'2026-10-24',accountId:account,targetId:obligation};
  cmd(a,payment);assert.throws(()=>cmd(b,payment),/supera/);
  assert.equal(b.snapshot('a').totals[0].payable,3000);
});
test('persistencia y restauración de copia consistente', t => {
  const dir=mkdtempSync(join(tmpdir(),'landur-persist-')),file=join(dir,'test.sqlite'),backup=join(dir,'backup.sqlite');
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  let db=new Ledger(file);db.seed('demo');const expected=db.snapshot('demo');
  db.db.prepare('VACUUM INTO ?').run(backup);db.close();
  db=new Ledger(file);assert.deepEqual(db.snapshot('demo'),expected);db.close();
  db=new Ledger(backup);assert.deepEqual(db.snapshot('demo'),expected);db.close();
});
