import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Ledger, money, MIGRATIONS } from '../server/ledger.mjs';
import { pngBytes } from './helpers/png.mjs';

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
    assert.equal(ledger.db.prepare('PRAGMA user_version').get().user_version,MIGRATIONS.length);
    const state=ledger.snapshot('a');
    assert.equal(state.operations.length,1,'los datos anteriores se conservan');
    assert.equal(state.operations[0].concept,'Anterior a la migración');
    assert.equal(state.operations[0].reversed_by,null);
  } finally { ledger.close(); }
  // Reabrir no vuelve a migrar ni duplica columnas.
  const again=new Ledger(file);
  try {
    assert.equal(again.db.prepare('PRAGMA user_version').get().user_version,MIGRATIONS.length);
    assert.equal(again.db.prepare('PRAGMA table_info(operations)').all().filter(c=>c.name==='reversed_by').length,1);
    assert.equal(again.db.prepare('PRAGMA table_info(applications)').all().filter(c=>c.name==='reversed').length,1);
    assert.equal(again.db.prepare('PRAGMA table_info(evidence)').all().filter(c=>c.name==='content').length,1,'la migración crea la tabla de comprobantes');
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

const PNG=pngBytes().toString('base64');

test('comprobantes: se adjuntan, se leen por espacio y el reintento no duplica', t => {
  const {ledger,run,account,op}=fixture(t);
  const expense=run(op('expense',{accountId:account(),amount:'1250'})).id;
  const key=randomUUID();
  const input={operationId:expense,name:'ticket.png',mime:'image/png',data:PNG};
  const first=ledger.attachEvidence('a','tester',key,input);
  assert.equal(ledger.attachEvidence('a','tester',key,input).id,first.id,'el reintento devuelve el mismo archivo');
  const file=ledger.evidenceFile('a',first.id);
  assert.equal(file.name,'ticket.png');assert.equal(file.mime,'image/png');
  assert.deepEqual([...file.content],[...Buffer.from(PNG,'base64')],'el bytes devuelto es el que se subió');
  const state=ledger.snapshot('a');
  assert.equal(state.evidence.length,1);assert.equal(state.evidence[0].operation,expense);
  assert.equal(state.audit[0].action,'evidence.attached');
  assert.throws(()=>ledger.evidenceFile('b',first.id),/no existe o no está disponible/,'un espacio ajeno no lo lee');
});

test('comprobantes: el tipo sale de los bytes y nada mentiroso se guarda', t => {
  const {ledger,run,account,op}=fixture(t);
  const expense=run(op('expense',{accountId:account(),amount:'1250'})).id;
  const at=(mime,name,data)=>({operationId:expense,name,mime,data});
  // Un HTML con extensión de imagen no pasa: el servidor mira los bytes, no la etiqueta.
  const script=Buffer.from('<script>alert(1)</script>').toString('base64');
  assert.throws(()=>ledger.attachEvidence('a','t',randomUUID(),at('image/png','x.html',script)),/no es una imagen/);
  assert.throws(()=>ledger.attachEvidence('a','t',randomUUID(),at('text/html','x.png',PNG)),/no es una imagen/);
  assert.throws(()=>ledger.attachEvidence('a','t',randomUUID(),at('image/png','',PNG)),/entre 1 y 120/);
  assert.throws(()=>ledger.attachEvidence('a','t',randomUUID(),at('image/png','x.png','no base64!!')),/No se pudo leer/);
  assert.throws(()=>ledger.attachEvidence('a','t',randomUUID(),{operationId:'no-existe',name:'x.png',mime:'image/png',data:PNG}),/operación/);
  const huge=Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),Buffer.alloc(1572864)]);
  assert.throws(()=>ledger.attachEvidence('a','t',randomUUID(),at('image/png','grande.png',huge.toString('base64'))),/KB o menos/);
  // Firma correcta pero archivo cortado: se rechaza por incompleto, no por el tipo.
  assert.throws(()=>ledger.attachEvidence('a','t',randomUUID(),at('image/png','cortado.png',pngBytes().subarray(0,20).toString('base64'))),/incompleto/);
  // Un nombre con ruta no crea rutas en el servidor: se guarda como etiqueta.
  const ok=ledger.attachEvidence('a','t',randomUUID(),at('image/png','../../etc/passwd.png',PNG));
  assert.equal(ledger.evidenceFile('a',ok.id).name,'..-..-etc-passwd.png');
  assert.equal(ledger.snapshot('a').evidence.length,1);
});

test('la reversión conserva el comprobante de la operación original', t => {
  const {ledger,run,account,op}=fixture(t);
  const expense=run(op('expense',{accountId:account(),amount:'1250'})).id;
  ledger.attachEvidence('a','tester',randomUUID(),{operationId:expense,name:'ticket.png',mime:'image/png',data:PNG});
  run({kind:'reversal',operationId:expense,date:'2026-10-25'});
  const state=ledger.snapshot('a');
  assert.equal(state.evidence.length,1,'el archivo no se borra con la operación');
  assert.equal(state.evidence[0].operation,expense);
  assert.equal(state.operations.find(o=>o.id===expense).reversed_by!==null,true);
});

test('una cuenta vacía se elimina con auditoría y una cuenta con movimientos se protege', t => {
  const {ledger,run,account,op}=fixture(t);
  const empty=account({name:'Cuenta para quitar',opening:'0'});
  const key=randomUUID(),deletion={kind:'account.delete',accountId:empty};
  assert.deepEqual(run(deletion,key),{id:empty});
  assert.equal(ledger.snapshot('a').accounts.some(a=>a.id===empty),false);
  assert.equal(ledger.snapshot('a').audit[0].action,'account.deleted');
  assert.match(ledger.snapshot('a').audit[0].entity,/Cuenta para quitar/);
  assert.equal(run(deletion,key).replayed,true,'el reintento idempotente no vuelve a borrar');
  const used=account({name:'Cuenta con movimiento'});
  run(op('expense',{accountId:used}));
  assert.throws(()=>run({kind:'account.delete',accountId:used}),error=>error.status===409&&/movimientos/.test(error.message));
  assert.ok(ledger.snapshot('a').accounts.some(a=>a.id===used),'el rechazo no altera la cuenta');
  assert.ok(ledger.snapshot('a').entries.some(e=>e.account===used),'el historial no se elimina');
  assert.throws(()=>run({kind:'account.delete',accountId:'foreign'}),error=>error.status===404);
});

test('eliminar una cuenta con movimientos: se traslada todo a otra cuenta sin perder dinero', t => {
  const {ledger,run,account,op}=fixture(t);
  const from=account({name:'Cuenta vieja'});
  const into=account({name:'Cuenta que queda',accountKind:'cash',opening:'10000'});
  run(op('expense',{accountId:from,amount:'1500'}));
  const before=ledger.snapshot('a').totals[0];
  const result=run({kind:'account.delete',accountId:from,mode:'move',toAccountId:into});
  assert.equal(result.into,into);assert.equal(result.entries,1);
  const state=ledger.snapshot('a');
  assert.equal(state.accounts.some(a=>a.id===from),false,'la cuenta original desaparece');
  const target=state.accounts.find(a=>a.id===into);
  assert.equal(target.opening,7000000,'los saldos iniciales se suman (en unidades menores)');
  assert.equal(target.balance,before.balance,'el saldo de la cuenta que queda absorbe el otro');
  assert.equal(state.totals[0].balance,before.balance,'el total de dinero del espacio no cambia');
  assert.equal(state.entries.some(e=>e.account===from),false,'los movimientos cambiaron de cuenta');
  assert.equal(state.audit[0].action,'account.merged');
});

test('eliminar una cuenta con movimientos: se puede crear una cuenta nueva con esa información', t => {
  const {ledger,run,account,op}=fixture(t);
  const from=account({name:'Banco viejo'});
  run(op('expense',{accountId:from,amount:'1250'}));
  const before=ledger.snapshot('a').totals[0].balance;
  const result=run({kind:'account.delete',accountId:from,mode:'move',newAccount:{name:'Banco 2026'}});
  const state=ledger.snapshot('a');
  const created=state.accounts.find(a=>a.id===result.into);
  assert.equal(created.name,'Banco 2026');
  assert.equal(created.opening,6000000,'conserva el saldo inicial de la cuenta original');
  assert.equal(created.balance,before);
  assert.equal(state.totals[0].balance,before);
  assert.equal(state.accounts.some(a=>a.id===from),false);
  assert.equal(state.entries.every(e=>e.account===created.id),true);
  assert.equal(state.audit[0].action,'account.merged');
});

test('eliminar una cuenta con todo lo asociado es explícito y queda respaldado en auditoría', t => {
  const {ledger,run,account,op}=fixture(t);
  const bank=account({name:'Cuenta a borrar'});
  const other=account({name:'Caja',accountKind:'cash',opening:'0'});
  const expense=run(op('expense',{accountId:bank,amount:'1250'})).id;
  const obligation=run(op('obligation',{due:'2026-10-28'})).id;
  const payment=run(op('payment',{accountId:bank,targetId:obligation,amount:'1000'})).id;
  ledger.attachEvidence('a','tester',randomUUID(),{operationId:expense,name:'ticket.png',mime:'image/png',data:PNG});
  run(op('expense',{accountId:other,amount:'500'}));
  // Sin confirmación explícita no se borra nada.
  assert.throws(()=>run({kind:'account.delete',accountId:bank,mode:'purge'}),/Confirmá/);
  // Confirmar con el nombre de otra cuenta tampoco alcanza.
  assert.throws(()=>run({kind:'account.delete',accountId:bank,mode:'purge',confirm:true,confirmName:'Otra'}),error=>error.status===400&&/nombre exacto/.test(error.message));
  assert.throws(()=>run({kind:'account.delete',accountId:bank,mode:'purge',confirm:true,confirmName:'  '}),error=>error.status===400);
  assert.ok(ledger.snapshot('a').accounts.some(a=>a.id===bank),'los intentos sin nombre no tocan la cuenta');
  assert.ok(ledger.snapshot('a').operations.some(o=>o.id===expense),'ni borran movimientos');
  const result=run({kind:'account.delete',accountId:bank,mode:'purge',confirm:true,confirmName:'  Cuenta a borrar  '});
  assert.equal(result.operations,2,'se van el gasto y el pago de esa cuenta');
  assert.equal(result.evidence,1,'y el comprobante adjunto');
  const state=ledger.snapshot('a');
  assert.equal(state.accounts.some(a=>a.id===bank),false);
  assert.equal(state.operations.some(o=>[expense,payment].includes(o.id)),false);
  assert.equal(state.operations.some(o=>o.id===obligation),true,'la deuda pendiente no pertenece a la cuenta');
  assert.equal(state.evidence.length,0);
  assert.equal(state.entries.some(e=>e.account===bank),false);
  assert.equal(state.totals[0].payable,149000,'la deuda vuelve a quedar pendiente');
  assert.ok(state.audit.some(a=>a.action==='account.purged'),'la baja queda auditada');
  assert.match(state.audit.find(a=>a.action==='account.purged').entity,/Cuenta a borrar/,'la auditoría guarda la cuenta eliminada');
});

test('el traspaso valida moneda, destino y cuenta distinta antes de tocar nada', t => {
  const {ledger,run,account,op}=fixture(t);
  const from=account({name:'En pesos'});
  run(op('expense',{accountId:from,amount:'1000'}));
  const dollars=account({name:'En dólares',currency:'USD',opening:'0'});
  assert.throws(()=>run({kind:'account.delete',accountId:from,mode:'move',toAccountId:dollars}),/monedas distintas/);
  assert.throws(()=>run({kind:'account.delete',accountId:from,mode:'move',toAccountId:'no-existe'}),error=>error.status===404);
  assert.throws(()=>run({kind:'account.delete',accountId:from,mode:'move',toAccountId:from}),/distinta/);
  assert.throws(()=>run({kind:'account.delete',accountId:from,mode:'move'}),/a qué cuenta/);
  assert.throws(()=>run({kind:'account.delete',accountId:from,mode:'move',newAccount:{name:''}}),/Nombre/);
  const state=ledger.snapshot('a');
  assert.ok(state.accounts.some(a=>a.id===from),'los rechazos no tocan la cuenta');
  assert.equal(state.entries.some(e=>e.account===from),true,'ni sus movimientos');
});

test('las claves de idempotencia se podan y las de importación no', t => {
  const {ledger}=fixture(t);
  const old=new Date(Date.now()-40*24*60*60*1000).toISOString(),recent=new Date().toISOString();
  const insert=ledger.db.prepare('INSERT INTO requests VALUES (?,?,?,?,?)');
  insert.run('a','u:tester:viejaclave00001','h','{}',old);
  insert.run('a','u:tester:nuevaclave00001','h','{}',recent);
  insert.run('a','csvrow-abcdef0123456789','h','{}',old);
  assert.equal(ledger.purgeRequests(),1,'solo se va la clave de comando vencida');
  assert.deepEqual(ledger.db.prepare('SELECT key FROM requests ORDER BY key').all().map(r=>r.key),
    ['csvrow-abcdef0123456789','u:tester:nuevaclave00001'],'la memoria de duplicados de importación se conserva');
});

test('un comprobante se puede eliminar con idempotencia, auditoría y aislamiento', t => {
  const {ledger,run,account,op}=fixture(t);
  const expense=run(op('expense',{accountId:account()})).id;
  const evidence=ledger.attachEvidence('a','tester',randomUUID(),{operationId:expense,name:'factura equivocada.png',mime:'image/png',data:PNG});
  const deletion={kind:'evidence.remove',evidenceId:evidence.id},key=randomUUID();
  assert.deepEqual(run(deletion,key),{id:evidence.id});
  assert.equal(ledger.snapshot('a').evidence.length,0);
  assert.equal(ledger.snapshot('a').operations.length,1,'borrar el archivo no altera la operación');
  assert.equal(ledger.snapshot('a').audit[0].action,'evidence.removed');
  assert.match(ledger.snapshot('a').audit[0].entity,/factura equivocada/);
  assert.equal(run(deletion,key).replayed,true);
  assert.throws(()=>ledger.evidenceFile('a',evidence.id),error=>error.status===404);
  assert.throws(()=>run({kind:'evidence.remove',evidenceId:evidence.id}),error=>error.status===404);
  const foreign=ledger.attachEvidence('b','other',randomUUID(),{operationId:run(op('sale',{}),randomUUID(),'b').id,name:'ajeno.png',mime:'image/png',data:PNG});
  assert.throws(()=>run({kind:'evidence.remove',evidenceId:foreign.id}),error=>error.status===404,'un espacio ajeno es indistinguible de uno inexistente');
});

test('limpieza de demos: borra espacios demo vencidos aunque tengan comprobantes y reversiones, y no toca el privado', t => {
  const ledger = new Ledger(); t.after(() => ledger.close());
  // La tabla de sesiones la crea el servidor HTTP; la limpieza la consulta para saber qué espacios siguen en uso.
  ledger.db.exec('CREATE TABLE sessions (hash TEXT PRIMARY KEY, workspace TEXT NOT NULL, actor TEXT NOT NULL, expires INTEGER NOT NULL, mode TEXT NOT NULL)');
  ledger.seed('demo-1');
  const expense = ledger.snapshot('demo-1').operations.find(o => o.kind === 'expense').id;
  ledger.attachEvidence('demo-1', 'tester', randomUUID(), { operationId: expense, name: 'ticket.png', mime: 'image/png', data: PNG });
  ledger.command('demo-1', 'tester', randomUUID(), { kind: 'reversal', operationId: expense, date: '2026-10-25' });
  ledger.workspace('privado');
  assert.equal(ledger.purgeDemoWorkspaces(), 1, 'se elimina el espacio demo sin sesión activa');
  assert.equal(ledger.snapshot('demo-1').operations.length, 0);
  assert.equal(ledger.snapshot('demo-1').evidence.length, 0);
  assert.ok(ledger.db.prepare('SELECT 1 FROM workspaces WHERE id=?').get('privado'), 'el espacio no demo sigue ahí');
});
