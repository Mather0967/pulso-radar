// RIVECT Studio / Retail: demos comerciales estáticas servidas desde projects/*/public.
// Viven fuera de la carpeta pública porque LiteSpeed entrega sin sesión todo lo que esté en `public/`.
// Se sirven solo con sesión y permiso (projectAccess), y únicamente archivos que existían al arrancar.
import fs from 'node:fs';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
};

/**
 * Sirve una SPA compilada bajo un prefijo fijo (`mount`), con lista blanca de archivos.
 * `mount` no incluye la barra final (ej. '/studio').
 */
export function createProjectSite({ dir, access, mount }) {
  const prefix = mount + '/';
  // Lista blanca fija: nada de rutas armadas con lo que pide el navegador.
  const files = new Map();
  const walk = (folder, base) => {
    if (!fs.existsSync(folder)) return;
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) walk(full, base + entry.name + '/');
      else if (TYPES[path.extname(entry.name)]) files.set(base + entry.name, full);
    }
  };
  walk(dir, '');

  return async function projectSite(req, user) {
    const p = new URL(req.url).pathname;
    if (!['GET', 'HEAD'].includes(req.method)) return Response.json({ error: 'Método no admitido' }, { status: 405 });
    if (!access(user)) return Response.json({ error: 'No tenés permiso para este proyecto.' }, { status: 403 });
    if (p === mount) return new Response(null, { status: 303, headers: { Location: prefix } });
    if (!p.startsWith(prefix)) return Response.json({ error: 'Ruta no encontrada.' }, { status: 404 });
    let name = p === prefix ? 'index.html' : p.slice(prefix.length);
    // Sin traversal ni archivos ocultos (.gitignore, .env): nunca entran al fallback de SPA.
    if (!name || name.includes('..') || name.includes('\\') || name.split('/').some(segment => segment.startsWith('.'))) return Response.json({ error: 'Ruta no encontrada.' }, { status: 404 });
    // Una subcarpeta con su propio index.html (p. ej. /studio/restaurantes/) se abre como página;
    // sin la barra final se redirige. Una carpeta sin index.html sigue el fallback de SPA de abajo.
    if (name.endsWith('/') && files.has(name + 'index.html')) name += 'index.html';
    else if (!path.extname(name) && files.has(name + '/index.html')) return new Response(null, { status: 303, headers: { Location: p + '/' } });
    // Fallback de SPA: una ruta del cliente (sin extensión) devuelve index.html.
    // Los archivos reales y las rutas con extensión que no están en la lista blanca siguen dando 404.
    const file = files.get(name) ?? (path.extname(name) ? null : files.get('index.html'));
    if (!file) return Response.json({ error: 'Ruta no encontrada.' }, { status: 404 });
    const headers = { 'Content-Type': TYPES[path.extname(file)] };
    // Los recursos de Vite llevan hash en el nombre: se pueden cachear en el navegador (nunca en un proxy).
    if (/(^|\/)assets\//.test(name)) headers['Cache-Control'] = 'private, max-age=31536000, immutable';
    // Las fotos no llevan hash: un día de caché privada evita volver a bajarlas en cada pantalla.
    else if (path.extname(name) === '.jpg') headers['Cache-Control'] = 'private, max-age=86400';
    return new Response(await fs.promises.readFile(file), { headers });
  };
}

export function createStudio({ dir, access }) {
  return createProjectSite({ dir, access, mount: '/studio' });
}
