// Sincronización automática de las conexiones. Cuatro cosas la disparan:
//   · el aviso de la propia planilla (Apps Script: al editar y cada pocos minutos) → `trigger('webhook')`;
//   · el reloj interno (`everyMs`): sincroniza lo configurado y VENCIDO de Sheets, Shopify y Meta → `tick()`;
//   · el arranque del proceso, que hace un `tick()` enseguida (Passenger lo reinicia cuando quiere);
//   · el botón «Sincronizar ahora» (va directo a `connections.sync`).
// Passenger puede apagar el proceso por inactividad: por eso el reloj es un respaldo y el disparo
// confiable es el aviso externo, que además despierta al proceso.
//
// Reglas: nunca dos sincronías de lo mismo a la vez (`connections.sync` comparte la corrida en curso);
// muchos avisos seguidos (una persona escribiendo) se juntan en una sola corrida, con al menos
// `minGapMs` entre una y otra; un error en una conexión no frena a las demás; y el reloj solo
// pregunta por lo vencido (`lastSync`), así que no repite lo que acaba de sincronizar un aviso.
import { createHash, timingSafeEqual } from 'node:crypto';
import { DomainError } from './ledger.mjs';

const KINDS = ['sheets', 'shopify', 'meta'];

// Comparación en tiempo constante: no filtra el largo ni cuántos caracteres coinciden.
export function tokenMatches(expected, given) {
  if (typeof expected !== 'string' || typeof given !== 'string' || !expected || !given) return false;
  const digest = value => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(expected), digest(given));
}

export function createAutoSync({ ledger, workspace, connections, actor = 'sincronía automática', everyMs = 0, minGapMs = 15000, log = console }) {
  let running = null, pending = false, timer = null, interval = null, lastStart = 0, lastAudited = '', last = null, ticking = false;

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
      if (!known) log.error('LANDUR sincronía automática falló:', error?.code || error?.name, String(error?.message ?? '').slice(0, 300));
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
  // agendada y responde `{ queued: true }`. Solo la planilla: es la que avisa.
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

  // Una conexión sin `lastSync` está vencida por definición; una recién sincronizada, no.
  const due = state => {
    const at = Date.parse(state?.lastSync ?? '');
    return !Number.isFinite(at) || Date.now() - at >= everyMs;
  };

  // Sincroniza lo configurado y vencido. Devuelve un resultado por conexión.
  async function tick() {
    if (!everyMs || ticking) return [];
    ticking = true;
    const done = [];
    try {
      const status = connections.status(ledger, workspace);
      for (const kind of KINDS) {
        if (!status?.[kind]?.configured || !due(status[kind])) continue;
        if (kind === 'sheets') {
          const result = await trigger('reloj');
          done.push(result?.queued ? { kind, queued: true } : result?.ok ? { kind, created: result.created, errors: result.errors } : { kind, error: result?.message });
          continue;
        }
        try {
          const summary = await connections.sync(ledger, workspace, actor, kind, {});
          done.push({ kind, created: summary?.created?.length ?? 0, errors: summary?.errors?.length ?? 0 });
        } catch (error) {
          const message = error?.message || String(error);
          done.push({ kind, error: message });
          log.warn(`[landur] sincronía ${kind}: ${message}`);
        }
      }
    } finally { ticking = false; }
    return done;
  }

  return {
    trigger,
    tick,
    start() {
      if (everyMs > 0 && !interval) { interval = setInterval(() => { tick().catch(() => {}); }, everyMs); interval.unref?.(); }
    },
    stop() { clearInterval(interval); clearTimeout(timer); interval = timer = null; pending = false; },
    status: () => ({ running: Boolean(running), pending, everyMinutes: everyMs ? Math.round(everyMs / 60000) : 0, last }),
  };
}

// «15» → 900000 ms. Vacío = 15 minutos; 0 (o algo que no es un número) apaga el reloj interno; el resto
// se acota a 1–1440. El aviso de la planilla funciona igual con el reloj apagado.
export function syncIntervalMs(value) {
  const text = String(value ?? '').trim();
  if (!text) return 15 * 60 * 1000;
  const minutes = Number(text);
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return Math.min(1440, Math.max(1, Math.round(minutes))) * 60 * 1000;
}
