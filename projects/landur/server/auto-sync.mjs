// Sincronización automática de las conexiones: la planilla y la tienda se actualizan solas,
// sin depender de que alguien abra la app ni de que se acuerde de tocar «Sincronizar».
//
// Decisiones:
//  · Sólo se sincroniza lo configurado y lo **vencido** (`lastSync`): si el servidor corre en
//    más de un proceso, ninguno repite el trabajo del otro.
//  · Un error en una conexión no frena a las demás: queda en el resultado y en el registro.
//  · La importación ya deduplica; esto sólo decide *cuándo* se pregunta, nunca inventa datos.
//  · `minutes = 0` la desactiva (útil en pruebas y en una instalación sin conexiones).
const KINDS = ['sheets', 'shopify', 'meta'];

export function createAutoSync({
  ledger,
  connections,
  workspace = 'landur',
  minutes = 15,
  actor = 'sincronía automática',
  log = console,
  now = () => Date.now(),
} = {}) {
  const period = Math.max(0, Number(minutes) || 0) * 60000;
  let timer = null;
  let running = false;

  // Una conexión sin `lastSync` está vencida por definición; una recién sincronizada, no.
  const due = state => {
    const last = Date.parse(state?.lastSync ?? '');
    return !Number.isFinite(last) || now() - last >= period;
  };

  async function tick() {
    if (!period || running) return [];
    running = true;
    const done = [];
    try {
      const status = connections.status(ledger, workspace);
      for (const kind of KINDS) {
        if (!status?.[kind]?.configured || !due(status[kind])) continue;
        try {
          const summary = await connections.sync(ledger, workspace, actor, kind, {});
          const entry = {
            kind,
            created: summary?.created?.length ?? 0,
            revertidas: summary?.skipped?.revertidas ?? 0,
            errors: summary?.errors?.length ?? 0,
          };
          done.push(entry);
          if (entry.errors) log.warn(`[landur] sincronía ${kind}: ${entry.errors} fila(s) con aviso`);
        } catch (error) {
          const message = error?.message || String(error);
          done.push({ kind, error: message });
          log.warn(`[landur] sincronía ${kind}: ${message}`);
        }
      }
    } finally {
      running = false;
    }
    return done;
  }

  function start() {
    if (!period || timer) return;
    timer = setInterval(() => { tick().catch(() => {}); }, period);
    // En Passenger el proceso lo mantiene el servidor: `unref` sólo evita retener una salida
    // ordenada en Node autónomo o en una prueba.
    timer.unref?.();
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  return { tick, start, stop };
}
