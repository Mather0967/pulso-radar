import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
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
test('una base anterior se migra en el lugar sin perder datos', t => {
  const dir=mkdtempSync(join(tmpdir(),'landur-migrate-')),file=join(dir,'test.sqlite');
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  // Base creada por una versión previa: sin marca de versión y sin las columnas nuevas.
  const legacy=new DatabaseSync(file);
  legacy.exec(`CREATE TABLE workspaces (id TEXT PRIMARY KEY, demo INTEGER NOT NULL);
    CREATE TABLE accounts (id TEXT PRIMARY KEY, workspace TEXT NOT NULL REFERENCES workspaces(id), name TEXT NOT NULL,
      kind TEXT NOT NULL, currency TEXT NOT NULL, opening INTEGER NOT NULL CHECK(opening >= 0),
      cutoff TEXT NOT NULL, verified INTEGER NOT NULL, accessible INTEGER NOT NULL);
    CREATE TABLE operations (id TEXT PRIMARY KEY, workspace TEXT NOT NULL REFERENCES workspaces(id), kind TEXT NOT NULL,
      concept TEXT NOT NULL, date TEXT NOT NULL, currency TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount > 0),
      source TEXT NOT NULL, external_id TEXT, related_id TEXT, category TEXT, created_at TEXT NOT NULL);
    CREATE TABLE entries (id TEXT PRIMARY KEY, operation TEXT NOT NULL REFERENCES operations(id),
      account TEXT NOT NULL REFERENCES accounts(id), amount INTEGER NOT NULL CHECK(amount != 0));
    CREATE TABLE obligations (id TEXT PRIMARY KEY, operation TEXT NOT NULL REFERENCES operations(id), due TEXT NOT NULL);
    CREATE TABLE applications (id TEXT PRIMARY KEY, operation TEXT NOT NULL REFERENCES operations(id),
      target TEXT NOT NULL REFERENCES operations(id), amount INTEGER NOT NULL CHECK(amount > 0));
    CREATE TABLE audit (id TEXT PRIMARY KEY, workspace TEXT NOT NULL REFERENCES workspaces(id),
      actor TEXT NOT NULL, action TEXT NOT NULL, entity TEXT NOT NULL, at TEXT NOT NULL);
    CREATE TABLE requests (workspace TEXT NOT NULL REFERENCES workspaces(id), key TEXT NOT NULL, fingerprint TEXT NOT NULL,
      result TEXT NOT NULL, PRIMARY KEY(workspace, key));
    INSERT INTO workspaces VALUES ('a',0);
    INSERT INTO operations VALUES ('vieja','a','expense','Anterior a la migración','2026-10-24','UYU',1000,'manual',NULL,NULL,NULL,'2026-10-24T00:00:00.000Z');
  `);
  legacy.close();
  const ledger=new Ledger(file);
  try {
    assert.equal(ledger.db.prepare('PRAGMA user_version').get().user_version,2);
    const state=ledger.snapshot('a');
    assert.equal(state.operations.length,1,'los datos anteriores se conservan');
    assert.equal(state.operations[0].concept,'Anterior a la migración');
    assert.equal(state.operations[0].reversed_by,null);
  } finally { ledger.close(); }
  // Reabrir no vuelve a migrar ni duplica columnas.
  const again=new Ledger(file);
  try {
    assert.equal(again.db.prepare('PRAGMA user_version').get().user_version,2);
    assert.equal(again.db.prepare('PRAGMA table_info(operations)').all().filter(c=>c.name==='reversed_by').length,1);
    assert.equal(again.db.prepare('PRAGMA table_info(applications)').all().filter(c=>c.name==='reversed').length,1);
  } finally { again.close(); }
});
test('revertir un gasto devuelve el dinero y lo saca del resultado', t => {
  const {ledger,run,account,op}=fixture(t);
  const expense=run(op('expense',{accountId:account(),amount:'1250'})).id;
  assert.equal(ledger.snapshot('a').totals[0].balance,6000000-125000);
  assert.equal(ledger.snapshot('a').totals[0].expenses,125000);
  const reversal=run({kind:'reversal',operationId:expense,date:'2026-10-25'});
  const state=ledger.snapshot('a');
  assert.equal(state.totals[0].balance,6000000,'el contra-asiento devuelve el saldo');
  assert.equal(state.totals[0].expenses,0,'el gasto revertido deja de contar');
  const original=state.operations.find(o=>o.id===expense);
  assert.equal(original.reversed_by,reversal.id);assert.ok(original.reversed_at,'queda la marca de cuándo');
  assert.equal(original.concept,'Prueba sintética','la original no se edita ni se borra');
  const compensating=state.operations.find(o=>o.id===reversal.id);
  assert.equal(compensating.kind,'reversal');assert.equal(compensating.related_id,expense);
  assert.equal(state.audit[0].action,'reversal.created');
});
test('no se revierte dos veces, ni una reversión', t => {
  const {ledger,run,account,op}=fixture(t);
  const expense=run(op('expense',{accountId:account(),amount:'100'})).id;
  const reversal=run({kind:'reversal',operationId:expense,date:'2026-10-25'}).id;
  assert.throws(()=>run({kind:'reversal',operationId:expense,date:'2026-10-25'}),/ya fue revertida/);
  assert.throws(()=>run({kind:'reversal',operationId:reversal,date:'2026-10-25'}),/no se revierte/);
  assert.equal(ledger.snapshot('a').operations.filter(o=>o.kind==='reversal').length,1);
});
test('una deuda con pagos aplicados exige revertir el pago primero', t => {
  const {ledger,run,account,op}=fixture(t);
  const obligation=run(op('obligation',{amount:'1000',due:'2026-10-28'})).id;
  const payment=run(op('payment',{amount:'400',accountId:account(),targetId:obligation})).id;
  assert.equal(ledger.snapshot('a').totals[0].payable,60000);
  assert.throws(()=>run({kind:'reversal',operationId:obligation,date:'2026-10-25'}),/Primero revertí los cobros o pagos/);
  run({kind:'reversal',operationId:payment,date:'2026-10-25'});
  assert.equal(ledger.snapshot('a').totals[0].payable,100000,'revertir el pago restaura el pendiente');
  run({kind:'reversal',operationId:obligation,date:'2026-10-25'});
  const state=ledger.snapshot('a');
  assert.equal(state.totals[0].payable,0);
  assert.equal(state.totals[0].balance,6000000,'todo vuelve al punto de partida');
  assert.equal(state.totals[0].expenses,0);
});
test('revertir un cobro restaura el pendiente y deshace la comisión', t => {
  const {ledger,run,account,op}=fixture(t);
  const wallet=account({name:'Billetera',accountKind:'wallet',opening:'0'});
  const sale=run(op('sale',{amount:'3200'})).id;
  const collection=run(op('collection',{amount:'3200',accountId:wallet,targetId:sale,commission:'331.20'})).id;
  assert.equal(ledger.snapshot('a').totals[0].receivable,0);
  assert.equal(ledger.snapshot('a').accounts.find(a=>a.id===wallet).balance,320000-33120);
  run({kind:'reversal',operationId:collection,date:'2026-10-25'});
  const state=ledger.snapshot('a');
  assert.equal(state.totals[0].receivable,320000,'la venta vuelve a quedar pendiente');
  assert.equal(state.accounts.find(a=>a.id===wallet).balance,0,'la billetera vuelve a cero');
  assert.equal(state.totals[0].expenses,0,'la comisión revertida deja de contar');
  assert.equal(state.operations.filter(o=>o.kind==='reversal').length,2,'el cobro y su comisión se revierten juntos');
});
test('revertir una transferencia devuelve ambos saldos sin crear resultado', t => {
  const {ledger,run,account,op}=fixture(t);
  const bank=account(), cash=account({name:'Caja',accountKind:'cash',opening:'0'});
  const transfer=run(op('transfer',{accountId:bank,toAccountId:cash,amount:'2800'})).id;
  run({kind:'reversal',operationId:transfer,date:'2026-10-25'});
  const state=ledger.snapshot('a');
  assert.equal(state.accounts.find(a=>a.id===bank).balance,6000000);
  assert.equal(state.accounts.find(a=>a.id===cash).balance,0);
  assert.equal(state.totals[0].expenses,0);assert.equal(state.totals[0].sales,0);
});
test('una venta sin cobros se revierte y deja de contarse', t => {
  const {ledger,run,op}=fixture(t);
  const sale=run(op('sale',{amount:'8600'})).id;
  assert.equal(ledger.snapshot('a').totals[0].sales,860000);
  run({kind:'reversal',operationId:sale,date:'2026-10-25'});
  const state=ledger.snapshot('a');
  assert.equal(state.totals[0].sales,0);assert.equal(state.totals[0].receivable,0);
  assert.equal(state.operations.find(o=>o.id===sale).reversed_by!==null,true);
});
