import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { configuration } from '../server/config.mjs';

// Run in the exact Node environment selected by cPanel, not another SSH Node.
process.umask(0o077);
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error('INCOMPATIBLE: se requiere Node >=22.13 con node:sqlite habilitado.');
  process.exit(1);
}
let db, directory;
try {
  const config = configuration();
  const { DatabaseSync } = await import('node:sqlite');
  mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });
  directory = resolve(config.dataDir, `.landur-check-${randomUUID()}`);
  mkdirSync(directory, { mode: 0o700 });
  db = new DatabaseSync(resolve(directory, 'probe.sqlite'));
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE probe (id INTEGER PRIMARY KEY); BEGIN IMMEDIATE; INSERT INTO probe VALUES (1); COMMIT;');
  if (db.prepare('SELECT COUNT(*) n FROM probe').get().n !== 1) throw new Error('No se pudo verificar la escritura.');
  db.prepare('VACUUM INTO ?').run(resolve(directory, 'backup.sqlite'));
  console.log(JSON.stringify({
    status: 'ok', node: process.versions.node, sqlite: db.prepare('SELECT sqlite_version() v').get().v,
    mode: config.demo ? 'synthetic-demo' : 'private', productionChecks: config.production,
    storageWrite: true, transaction: true, backup: true,
    note: 'Esta prueba local no valida Passenger, TLS, permisos del dominio, aceptación de Rafa ni pentesting.'
  }, null, 2));
} catch (error) {
  console.error('Preflight falló:', error.code || error.message);
  process.exitCode = 1;
} finally {
  db?.close();
  if (directory) rmSync(directory, { recursive: true, force: true });
}
