import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID, createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import { DomainError } from './ledger.mjs';
import { exportOperations } from './csv.mjs';

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/sw.js', ['sw.js', 'text/javascript; charset=utf-8']],
  ['/manifest.webmanifest', ['manifest.webmanifest', 'application/manifest+json']],
  ['/icon.svg', ['icon.svg', 'image/svg+xml']],
  ['/icon-192.png', ['icon-192.png', 'image/png']],
  ['/icon-512.png', ['icon-512.png', 'image/png']],
  ['/apple-touch-icon.png', ['apple-touch-icon.png', 'image/png']],
]);
const digest = text => createHash('sha256').update(text).digest('hex');
export function createApp({ ledger, demo = false, password, publicOrigin, insecureCookies = false }) {
  if (!demo && (typeof password !== 'string' || password.length < 16)) throw new Error('El modo privado requiere LANDUR_PASSWORD de al menos 16 caracteres.');
  if (password && password.length > 256) throw new Error('La contraseña no debe superar 256 caracteres.');
  const salt = randomBytes(32), passwordHash = password ? scryptSync(password, salt, 64) : null;
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
  const json = (res, status, payload) => { res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8' }); res.end(JSON.stringify(payload)); };
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','same-origin');
    res.setHeader('Permissions-Policy','camera=(self), microphone=(), geolocation=()');
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
            if (ledger.db.prepare('SELECT COUNT(*) n FROM workspaces').get().n >= 500) throw new DomainError('Límite de espacios de demostración alcanzado.',429);
            const workspace = randomUUID();
            ledger.seed(workspace);
            demoToken = setSession(res,workspace,'Visitante demo');
          }
          return json(res,200,{ok:true,demoToken});
        }
        if (demo) throw new DomainError('Esta instancia solo admite datos sintéticos.',400);
        const address = req.socket.remoteAddress || 'unknown';
        const now = Date.now();
        for (const [ip, value] of attempts) if (now > value.until) attempts.delete(ip);
        if (attempts.size > 1000) throw new DomainError('Demasiados intentos. Intentá más tarde.',429);
        const attempt = attempts.get(address) || {count:0,until:now+15*60*1000};
        if (attempt.count >= 8) throw new DomainError('Demasiados intentos. Esperá 15 minutos.',429);
        attempt.count++; attempts.set(address,attempt);
        if (typeof input.password !== 'string' || input.password.length > 256 || !timingSafeEqual(scryptSync(input.password,salt,64),passwordHash))
          throw new DomainError('No se pudo iniciar sesión.',401);
        attempts.delete(address);
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
