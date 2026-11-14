// Sincronización automática de la planilla de Google. Tres cosas disparan la misma sincronía:
//   · el aviso de la propia planilla (Apps Script, al editar y cada pocos minutos) → `trigger('webhook')`;
//   · un reloj interno cada `everyMs` mientras el proceso esté vivo → `trigger('reloj')`;
//   · el botón «Sincronizar ahora» (que va directo a `connections.sync`).
// Passenger puede apagar el proceso por inactividad: por eso el reloj interno es solo un respaldo y
// el disparo confiable es el aviso externo, que además despierta al proceso.
//
// Reglas: nunca dos sincronías a la vez; muchos avisos seguidos (una persona escribiendo) se
// juntan en una sola corrida, y entre una corrida y la siguiente pasan al menos `minGapMs`.
import { createHash, timingSafeEqual } from 'node:crypto';
import { DomainError } from './ledger.mjs';

// Comparación en tiempo constante: no filtra el largo ni cuántos caracteres coinciden.
export function tokenMatches(expected, given) {
  if (typeof expected !== 'string' || typeof given !== 'string' || !expected || !given) return false;
  const digest = value => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(expected), digest(given));
}

export function createAutoSync({ ledger, workspace, connections, actor = 'sincronía automática', everyMs = 0, minGapMs = 15000 }) {
  let running = null, pending = false, timer = null, interval = null, lastStart = 0, lastAudited = '', last = null;

  async function run(reason) {
    lastStart = Date.now();
    const at = new Date().toISOString();
    const status = connections.status(ledger, workspace).sheets;
    if (!status.configured || !status.keyMask) { last = { at, reason, ok: false, message: 'Todavía no hay una conexión de Google Sheets guardada.' }; return last; }
    try {
      const summary = await connections.sync(ledger, workspace, actor, 'sheets', {});
      last = { at, reason, ok: true, created: summary.created.length, reverted: (summary.reverted ?? []).length, errors: summary.errors.length, totals: summary.totals ?? null };
      lastAudited = '';
    } catch (error) {
      const known = error instanceof DomainError || Boolean(error?.status);
      if (!known) console.error('LANDUR sincronía automática falló:', error?.code || error?.name, String(error?.message ?? '').slice(0, 300));
      const message = known ? error.message : 'La sincronía automática falló. Revisá el registro del servidor.';
      last = { at, reason, ok: false, message };
      // Una falla que se repite cada pocos minutos no llena la auditoría: se asienta cuando cambia.
      if (message !== lastAudited) { lastAudited = message; try { ledger.audit(workspace, actor, 'sync.sheets.error', message.slice(0, 200)); } catch {} }
    }
    return last;
  }

  function kick(reason) {
    pending = false;
    running = run(reason).finally(() => { running = null; if (pending) trigger('encolada'); });
    return running;
  }

  // Devuelve la corrida en curso o nueva; si hay que esperar el intervalo mínimo, la deja
  // agendada y responde `{ queued: true }`.
  function trigger(reason = 'manual') {
    if (running) { pending = true; return running; }
    const wait = lastStart + minGapMs - Date.now();
    if (wait <= 0) return kick(reason);
    pending = true;
    if (!timer) {
      timer = setTimeout(() => { timer = null; if (pending && !running) kick('diferida'); }, wait);
      timer.unref?.();
    }
    return Promise.resolve({ queued: true });
  }

  return {
    trigger,
    start() {
      if (everyMs > 0 && !interval) { interval = setInterval(() => { trigger('reloj'); }, everyMs); interval.unref?.(); }
    },
    stop() { clearInterval(interval); clearTimeout(timer); interval = timer = null; pending = false; },
    status: () => ({ running: Boolean(running), pending, everyMinutes: everyMs ? Math.round(everyMs / 60000) : 0, last }),
  };
}

// «5» → 300000 ms. Vacío = 5 minutos; 0 apaga el reloj interno; el resto se acota a 1–1440.
export function syncIntervalMs(value) {
  const text = String(value ?? '').trim();
  if (!text) return 5 * 60 * 1000;
  const minutes = Number(text);
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return Math.min(1440, Math.max(1, Math.round(minutes))) * 60 * 1000;
}
