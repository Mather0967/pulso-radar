import { resolve, isAbsolute, relative, sep, dirname, basename } from 'node:path';
import { existsSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const applicationRoot = fileURLToPath(new URL('../', import.meta.url));
// Resolve existing ancestors too, so a symlink cannot place private data in public/.
function actualPath(path) {
  if (existsSync(path)) return realpathSync(path);
  return resolve(actualPath(dirname(path)), basename(path));
}
function within(parent, child) {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}
export function configuration(env = process.env, root = applicationRoot) {
  const production = env.NODE_ENV === 'production';
  const demo = env.LANDUR_DEMO === '1';
  const dataDir = actualPath(resolve(env.LANDUR_DATA_DIR || resolve(root, 'data')));
  const origin = env.LANDUR_PUBLIC_ORIGIN;
  if (origin) {
    let parsed;
    try { parsed = new URL(origin); } catch { throw new Error('LANDUR_PUBLIC_ORIGIN debe ser un origen HTTPS válido.'); }
    if (parsed.protocol !== 'https:' || parsed.origin !== origin || parsed.username || parsed.password)
      throw new Error('LANDUR_PUBLIC_ORIGIN debe ser https://dominio sin ruta, barra final ni credenciales.');
  }
  if (!demo && (!env.LANDUR_PASSWORD || env.LANDUR_PASSWORD.length < 16 || env.LANDUR_PASSWORD.length > 256))
    throw new Error('Configurá LANDUR_PASSWORD con entre 16 y 256 caracteres en el entorno del servidor.');
  const publicPath = actualPath(resolve(root, 'public'));
  if (within(publicPath, dataDir) || dataDir.split(sep).some(p => ['public_html', 'www'].includes(p)))
    throw new Error('LANDUR_DATA_DIR debe estar fuera de las carpetas públicas.');
  if (production) {
    if (demo) throw new Error('El modo demo no puede arrancar con NODE_ENV=production. Usá un entorno de prueba separado.');
    if (!origin) throw new Error('Producción requiere LANDUR_PUBLIC_ORIGIN con el subdominio HTTPS definitivo.');
    if (env.LANDUR_INSECURE_LOCAL === '1') throw new Error('Producción no permite cookies inseguras.');
    if (!env.LANDUR_DATA_DIR || !isAbsolute(env.LANDUR_DATA_DIR) || within(actualPath(resolve(root)), dataDir))
      throw new Error('Producción requiere LANDUR_DATA_DIR absoluto, privado y fuera del directorio de código.');
  }
  const port = Number(env.PORT || 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT debe ser un puerto válido.');
  return { production, demo, dataDir, publicOrigin: origin, password: env.LANDUR_PASSWORD,
    insecureCookies: env.LANDUR_INSECURE_LOCAL === '1', host: env.HOST || '0.0.0.0', port,
    // Fuerza la lectura de X-Forwarded-For para un proxy que no sea local.
    // Con Passenger/Apache el par ya es loopback y se confía sin configurar nada.
    trustProxy: env.LANDUR_TRUST_PROXY === '1',
    // Orígenes extra aceptados cuando no hay LANDUR_PUBLIC_ORIGIN (desarrollo multipuerto).
    allowedHosts: (env.LANDUR_ALLOWED_HOSTS || '').split(',').map(s => s.trim()).filter(Boolean) };
}
