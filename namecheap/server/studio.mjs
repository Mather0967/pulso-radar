// RIVECT Studio: demo comercial estática (projects/studio/public, compilada con `npm run build:portal`).
// Vive fuera de la carpeta pública porque LiteSpeed entrega sin sesión todo lo que esté en `public/`.
// Se sirve solo con sesión y permiso (projectAccess), y únicamente archivos que existían al arrancar.
import fs from 'node:fs';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json; charset=utf-8',
};

export function createStudio({ dir, access }) {
  // Lista blanca fija: nada de rutas armadas con lo que pide el navegador.
  const files = new Map();
  const walk = (folder, prefix) => {
    if (!fs.existsSync(folder)) return;
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) walk(full, prefix + entry.name + '/');
      else if (TYPES[path.extname(entry.name)]) files.set(prefix + entry.name, full);
    }
  };
  walk(dir, '');

  return async function studio(req, user) {
    const p = new URL(req.url).pathname;
    if (!['GET', 'HEAD'].includes(req.method)) return Response.json({ error: 'Método no admitido' }, { status: 405 });
    if (!access(user)) return Response.json({ error: 'No tenés permiso para este proyecto.' }, { status: 403 });
    if (p === '/studio') return new Response(null, { status: 303, headers: { Location: '/studio/' } });
    const name = p === '/studio/' ? 'index.html' : p.slice('/studio/'.length);
    const file = files.get(name);
    if (!file) return Response.json({ error: 'Ruta no encontrada.' }, { status: 404 });
    const headers = { 'Content-Type': TYPES[path.extname(file)] };
    // Los recursos de Vite llevan hash en el nombre: se pueden cachear en el navegador (nunca en un proxy).
    if (name.startsWith('assets/')) headers['Cache-Control'] = 'private, max-age=31536000, immutable';
    return new Response(await fs.promises.readFile(file), { headers });
  };
}
