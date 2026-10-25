import { mkdirSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';
import { configuration } from './config.mjs';

process.umask(0o077);
const config = configuration();
const { Ledger } = await import('./ledger.mjs');
const { createApp } = await import('./app.mjs');
mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });
const filename = resolve(config.dataDir, config.demo ? 'demo.sqlite' : 'landur.sqlite');
const ledger = new Ledger(filename);
chmodSync(filename, 0o600);
const server = createApp({ ledger, ...config });
// Passenger intercepts listen(); PORT is only a fallback for standalone Node.
server.listen(config.port, config.host, () => console.log(`LANDUR ${config.demo ? 'DEMO · datos sintéticos' : 'privado'} iniciado`));
const stop = () => server.close(() => { ledger.close(); process.exit(0); });
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
