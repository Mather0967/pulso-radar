import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import { mkdirSync, existsSync, chmodSync } from 'node:fs';
import { configuration, applicationRoot } from '../server/config.mjs';

process.umask(0o077);
const config = configuration();
const source = resolve(config.dataDir, config.demo ? 'demo.sqlite' : 'landur.sqlite');
if (!existsSync(source)) throw new Error('No existe la base configurada. No se creó un respaldo vacío.');
// Reuse the same private-path checks, including symlinks and cPanel public paths.
const targetDir = configuration({ ...process.env,
  LANDUR_DATA_DIR: process.env.LANDUR_BACKUP_DIR || resolve(applicationRoot, 'backups')
}).dataDir;
mkdirSync(targetDir, { recursive: true, mode: 0o700 });
const target = resolve(targetDir, `landur-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`);
const db = new DatabaseSync(source);
try { db.prepare('VACUUM INTO ?').run(target); } finally { db.close(); }
// Restoring a backup must never restore authenticated browser sessions.
const backup = new DatabaseSync(target);
try {
  if (backup.prepare("SELECT name FROM sqlite_master WHERE name='sessions'").get()) backup.exec('DELETE FROM sessions');
} finally { backup.close(); }
chmodSync(target, 0o600);
console.log(`Respaldo privado creado: ${target}. No subir a Git ni al directorio público.`);
