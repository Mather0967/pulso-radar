import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { Ledger } from '../server/ledger.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
function fixture(t) {
  const dir=mkdtempSync(join(tmpdir(),'landur-hosting-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  // Un PORT heredado del shell de desarrollo no debe filtrarse al preflight ni al respaldo.
  const env={...process.env,PORT:'3001',NODE_ENV:'production',LANDUR_DEMO:'0',LANDUR_PASSWORD:'synthetic-test-secret-only',LANDUR_PUBLIC_ORIGIN:'https://landur.example.com',LANDUR_DATA_DIR:join(dir,'private'),LANDUR_BACKUP_DIR:join(dir,'backups'),LANDUR_INSECURE_LOCAL:'0'};
  return {dir,env};
}
test('preflight producción usa una base temporal y no deja artefactos',t=>{
  const {env}=fixture(t);
  const output=execFileSync(process.execPath,['scripts/check-host.mjs'],{cwd:root,env,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  const result=JSON.parse(output);assert.equal(result.productionChecks,true);assert.equal(result.backup,true);
  assert.deepEqual(readdirSync(env.LANDUR_DATA_DIR),[]);assert.ok(!output.includes(env.LANDUR_PASSWORD));
});
test('script de respaldo restaura finanzas sin restaurar sesiones',t=>{
  const {env}=fixture(t);mkdirSync(env.LANDUR_DATA_DIR,{recursive:true});
  const db=new Ledger(join(env.LANDUR_DATA_DIR,'landur.sqlite'));db.seed('synthetic-fixture');const expected=db.snapshot('synthetic-fixture');
  db.db.exec("CREATE TABLE sessions(hash TEXT); INSERT INTO sessions VALUES ('synthetic-token');");
  execFileSync(process.execPath,['scripts/backup.mjs'],{cwd:root,env,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  assert.equal(db.db.prepare('SELECT COUNT(*) n FROM sessions').get().n,1);db.close();
  const files=readdirSync(env.LANDUR_BACKUP_DIR);assert.equal(files.length,1);
  const path=join(env.LANDUR_BACKUP_DIR,files[0]);assert.equal(statSync(path).mode & 0o777,0o600);
  const copy=new Ledger(path);assert.deepEqual(copy.snapshot('synthetic-fixture'),expected);
  assert.equal(copy.db.prepare('SELECT COUNT(*) n FROM sessions').get().n,0);copy.close();
});
