import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID, createHash, scrypt, timingSafeEqual } from 'node:crypto';
// scrypt síncrono detiene el event loop: un intento de acceso congela también las lecturas financieras de otros usuarios.
const scryptKey = (password, salt, size = 64) => new Promise((resolve, reject) =>
  scrypt(password, salt, size, (error, key) => error ? reject(error) : resolve(key)));
import { DomainError } from './ledger.mjs';
import { exportOperations } from './csv.mjs';

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/voice.mjs', ['voice.mjs', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/sw.js', ['sw.js', 'text/javascript; charset=utf-8']],
  ['/manifest.webmanifest', ['manifest.webmanifest', 'application/manifest+json']],
  ['/icon.svg', ['icon.svg', 'image/svg+xml']],
  ['/icon-192.png', ['icon-192.png', 'image/png']],
  ['/icon-512.png', ['icon-512.png', 'image/png']],
  ['/apple-touch-icon.png', ['apple-touch-icon.png', 'image/png']],
]);
const digest = text => createHash('sha256').update(text).digest('hex');
// El proxy del propio host (Passenger/Apache) siempre conecta desde loopback, así que
// ahí X-Forwarded-For es confiable y se toma el último salto: el que agrega el proxy
// inmediato. Un cliente directo nunca llega desde loopback y no puede falsearla.
const loopback = /^(::1|::ffff:127\.0\.0\.1|127(?:\.\d{1,3}){3})$/;
export function isLocalPeer(peer) {
  return typeof peer === 'string' && loopback.test(peer.replace(/^\[|\]$/g, ''));
}
export function clientAddress({ peer, forwarded, trustProxy = false } = {}) {
  const hops = String(forwarded ?? '').split(',').map(s => s.trim()).filter(Boolean);
  if (hops.length && (trustProxy || isLocalPeer(peer))) return hops[hops.length - 1];
  return typeof peer === 'string' && peer ? peer : 'unknown';
}
export function createApp({ ledger, demo = false, password, publicOrigin, insecureCookies = false, trustProxy = false, allowedHosts = [] }) {
  if (!demo && (typeof password !== 'string' || password.length < 16)) throw new Error('El modo privado requiere LANDUR_PASSWORD de al menos 16 caracteres.');
  if (password && password.length > 256) throw new Error('La contraseña no debe superar 256 caracteres.');
  const salt = randomBytes(32), passwordHash = password ? scryptKey(password, salt) : null;
  passwordHash?.catch(() => {});
  const attempts = new Map();
  ledger.db.exec(`CREATE TABLE IF NOT EXISTS sessions (
    hash TEXT PRIMARY KEY, workspace TEXT NOT NULL, actor TEXT NOT NULL, expires INTEGER NOT NULL, mode TEXT NOT NULL
  )`);
  if (!demo) {
    ledger.workspace('landur');
    // This initial single-process deployment invalidates sessions on restart,
    // including when the operator rotates the password in cPanel.
    ledger.db.prepare("DELETE FROM sessions WHERE mode='private'").run();
  }
  const mode = demo ? 'demo' : 'private';
  // Embedded synthetic previews may run with third-party cookies blocked.
  // Header credentials are accepted ONLY by the explicitly enabled demo instance.
  function requestToken(req) {
    const cookie = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('landur_session='))?.slice(15);
    return demo && typeof req.headers['x-landur-demo-session'] === 'string'
      ? req.headers['x-landur-demo-session'] : cookie;
  }
  const cookieAttributes = demo && !insecureCookies
    ? 'HttpOnly; SameSite=None; Secure; Partitioned; Path=/'
    : `HttpOnly; SameSite=Strict; Path=/${insecureCookies ? '' : '; Secure'}`;
  function session(req) {
    const token = requestToken(req);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    return ledger.db.prepare('SELECT * FROM sessions WHERE hash=? AND expires>? AND mode=?').get(digest(token), Date.now(), mode);
  }
  function setSession(res, workspace, actor) {
    ledger.db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now());
    if (ledger.db.prepare('SELECT COUNT(*) n FROM sessions').get().n >= 1000) throw new DomainError('La demo alcanzó el límite de sesiones. Intentá más tarde.', 429);
    const token = randomBytes(32).toString('hex');
    const lifetime = demo ? 7 * 86400 : 8 * 3600;
    ledger.db.prepare('INSERT INTO sessions VALUES (?,?,?,?,?)').run(digest(token),workspace,actor,Date.now()+lifetime*1000,mode);
    res.setHeader('Set-Cookie',`landur_session=${token}; ${cookieAttributes}; Max-Age=${lifetime}`);
    return token;
  }
  async function body(req, limit = 16384) {
    if (!req.headers['content-type']?.startsWith('application/json') || req.headers['x-landur-request'] !== '1')
      throw new DomainError('Se requiere una solicitud JSON de la aplicación.', 415);
    // Un Host inyectado no puede suplantar el origen esperado.
    if (!hostAllowed(req.headers.host)) throw new DomainError('Origen no autorizado.', 403);
    const origin = req.headers.origin;
    const expected = publicOrigin || `${insecureCookies ? 'http' : 'https'}://${req.headers.host}`;
    if ((origin && origin !== expected) || req.headers['sec-fetch-site'] === 'cross-site') throw new DomainError('Origen no autorizado.', 403);
    let size = 0, chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > limit) throw new DomainError('La solicitud supera el tamaño permitido.', 413);
      chunks.push(chunk);
    }
    let value;
    try { value = JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new DomainError('JSON inválido.'); }
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DomainError('Se requiere un objeto JSON.');
    return value;
  }
  const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
  const normalizeHost = host => typeof host === 'string' && host ? host.replace(/:\d+$/, '').toLowerCase() : '';
  const extraHosts = new Set([].concat(allowedHosts || []).filter(Boolean).map(normalizeHost));
  const originHost = publicOrigin ? normalizeHost(new URL(publicOrigin).host) : null;
  // Sin LANDUR_PUBLIC_ORIGIN solo se acepta loopback o una lista explícita.
  const hostAllowed = host => { const name = normalizeHost(host); return !!name && (name === originHost || loopbackHosts.has(name) || extraHosts.has(name)); };
  const ATTEMPT_WINDOW = 15 * 60 * 1000, ATTEMPT_LIMIT = 8, ATTEMPT_KEYS = 5000, GLOBAL_WINDOW = 60 * 1000, GLOBAL_LIMIT = 60;
  let globalFrom = 0, globalCount = 0;
  const clientKey = req => clientAddress({ peer: req.socket.remoteAddress, forwarded: req.headers['x-forwarded-for'], trustProxy });
  function throttle(key) {
    const now = Date.now();
    for (const [ip, value] of attempts) if (now > value.until) attempts.delete(ip);
    // Que la tabla se llene no puede convertirse en un bloqueo para todos: se descartan las más antiguas.
    if (attempts.size >= ATTEMPT_KEYS)
      for (const [ip] of [...attempts].sort((a, b) => a[1].until - b[1].until).slice(0, attempts.size - ATTEMPT_KEYS + 1)) attempts.delete(ip);
    if (now - globalFrom >= GLOBAL_WINDOW) { globalFrom = now; globalCount = 0; }
    if (++globalCount > GLOBAL_LIMIT) throw new DomainError('Demasiados intentos. Intentá más tarde.', 429);
    const attempt = attempts.get(key) || { count: 0, until: now + ATTEMPT_WINDOW };
    if (attempt.count >= ATTEMPT_LIMIT) throw new DomainError('Demasiados intentos. Esperá 15 minutos.', 429);
    attempt.count++; attempts.set(key, attempt);
  }
  async function matchesPassword(candidate) {
    try { return timingSafeEqual(await scryptKey(candidate, salt), await passwordHash); }
    catch { return false; }
  }
  const json = (res, status, payload) => { res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8' }); res.end(JSON.stringify(payload)); };
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','same-origin');
    // El micrófono habilitado solo para este origen permite la dictación del formulario.
    res.setHeader('Permissions-Policy','camera=(self), microphone=(self), geolocation=()');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'");
    if (!demo) { res.setHeader('X-Frame-Options','DENY'); res.setHeader('Content-Security-Policy',res.getHeader('Content-Security-Policy')+"; frame-ancestors 'none'"); }
    if (publicOrigin?.startsWith('https://')) res.setHeader('Strict-Transport-Security','max-age=31536000');
    try {
      const url = new URL(req.url,'http://localhost');
      if (req.method === 'GET' && url.pathname === '/api/session') {
        const s = session(req);
        return json(res,200,{authenticated:!!s,demo,actor:s?.actor ?? null});
      }
      if (req.method === 'POST' && ['/api/demo','/api/login','/api/logout'].includes(url.pathname)) {
        const input = await body(req);
        if (url.pathname === '/api/logout') {
          const s = session(req);
          if (s) ledger.db.prepare('DELETE FROM sessions WHERE hash=?').run(s.hash);
          res.setHeader('Set-Cookie', demo && !insecureCookies ? [
            `landur_session=; ${cookieAttributes}; Max-Age=0`,
            'landur_session=; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=0'
          ] : `landur_session=; ${cookieAttributes}; Max-Age=0`);
          return json(res,200,{ok:true});
        }
        if (url.pathname === '/api/demo') {
          if (!demo) throw new DomainError('Modo demostración deshabilitado.',404);
          const existing = session(req);
          let demoToken = existing ? requestToken(req) : null;
          if (!existing) {
            // Los espacios demo sin sesión activa ocupaban disco hasta el tope y
          // después bloqueaban a todo visitante nuevo con 429.
          ledger.purgeDemoWorkspaces();
          if (ledger.db.prepare('SELECT COUNT(*) n FROM workspaces').get().n >= 500) throw new DomainError('Límite de espacios de demostración alcanzado.',429);
            const workspace = randomUUID();
            ledger.seed(workspace);
            demoToken = setSession(res,workspace,'Visitante demo');
          }
          return json(res,200,{ok:true,demoToken});
        }
        if (demo) throw new DomainError('Esta instancia solo admite datos sintéticos.',400);        const key = clientKey(req);
        throttle(key);
        if (typeof input.password !== 'string' || input.password.length > 256 || !(await matchesPassword(input.password)))
          throw new DomainError('No se pudo iniciar sesión.',401);
        attempts.delete(key);
        const previous = session(req);
        if (previous) ledger.db.prepare('DELETE FROM sessions WHERE hash=?').run(previous.hash);
        setSession(res,'landur','Rafa');
        return json(res,200,{ok:true});
      }
      if (url.pathname.startsWith('/api/')) {
        const s = session(req);
        if (!s) throw new DomainError('La sesión venció. Volvé a ingresar.',401);
        if (req.method === 'GET' && url.pathname === '/api/state') return json(res,200,{...ledger.snapshot(s.workspace),demo,actor:s.actor});
        if (req.method === 'GET' && url.pathname === '/api/export.csv') {
          res.setHeader('Content-Type','text/csv; charset=utf-8');
          res.setHeader('Content-Disposition','attachment; filename="landur-operaciones.csv"');
          return res.end(exportOperations(ledger.snapshot(s.workspace)));
        }
        if (req.method === 'POST' && ['/api/import/preview','/api/import/commit'].includes(url.pathname)) {
          const input = await body(req,131072);
          const result = url.pathname.endsWith('preview')
            ? ledger.previewImport(s.workspace,s.actor,input.csv)
            : ledger.command(s.workspace,s.actor,req.headers['idempotency-key'],{kind:'import',csv:input.csv});
          return json(res,200,result);
        }
        if (req.method === 'POST' && url.pathname === '/api/commands') {
          const input = await body(req);
          if (input.kind === 'import') throw new DomainError('Usá la importación con vista previa.');
          return json(res,200,ledger.command(s.workspace,s.actor,req.headers['idempotency-key'],input));
        }
        throw new DomainError('Ruta no disponible.',404);
      }
      const asset = assets.get(url.pathname);
      if (asset && ['GET','HEAD'].includes(req.method)) {
        const content = await readFile(publicDir+asset[0]);
        res.setHeader('Content-Type',asset[1]);
        if (url.pathname === '/sw.js') res.setHeader('Service-Worker-Allowed','/');
        res.writeHead(200); return res.end(req.method === 'HEAD' ? undefined : content);
      }
      throw new DomainError('No encontrado.',404);
    } catch (err) {
      if (!(err instanceof DomainError)) console.error('LANDUR request failed:', err.code || err.name);
      if (!res.headersSent) json(res,err.status || 500,{error:err.status ? err.message : 'No se pudo completar la operación. No repitas el registro sin revisar su estado.'});
      else res.end();
    }
  });
}
