import { Download } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';
import { scenarioById, scenarios } from '../content/scenarios';
import { compileTour } from '../engine/tour';
import type { Scenario } from '../engine/types';
import * as A from '../runtime/actions';
import { useStore } from '../runtime/store';
import { Icon } from './Icon';
import { exportVisit } from './Panels';
import { Mark } from './Studio';

const EASE = [0.22, 1, 0.36, 1] as const;
const PORTAL = import.meta.env.MODE === 'portal';
/** Demos de gestión publicadas junto al Studio en el portal. */
const MANAGEMENT: Record<string, string> = { restaurante: '/studio/restaurantes/', dental: '/studio/odontologia/' };

/**
 * Selector de rubros. Izquierda: la lista (elegir). Derecha: el escenario que se va a abrir, con su mapa real
 * y sus capítulos (anticipar). Al iniciar, el escenario se expande a pantalla completa antes de montar el Studio,
 * para que se sienta como entrar en ese entorno y no como cambiar de página.
 */
export function Picker() {
  const visits = useStore((s) => s.visits);
  const [sel, setSel] = useState(scenarios[0].id);
  const [entering, setEntering] = useState<null | 'tour' | 'free'>(null);
  const reduce = useReducedMotion();
  const sc = scenarioById(sel)!;

  const start = (mode: 'tour' | 'free') => {
    if (reduce) return A.startScenario(sc.id, mode);
    setEntering(mode);
    setTimeout(() => A.startScenario(sc.id, mode), 520);
  };

  return (
    <div className="picker relative flex h-full flex-col overflow-y-auto">
      <header className="flex items-center gap-2.5 px-6 pt-6 md:px-8">
        <Mark />
        <span className="text-[14px] font-semibold tracking-[-0.01em]">RIVECT Studio</span>
        {PORTAL
          ? <a className="btn ghost ml-auto" href="/portal">Mis proyectos</a>
          : <span className="ml-auto hidden text-[12.5px] text-fg-3 sm:inline">Funciona sin conexión</span>}
      </header>

      <main className="mx-auto grid w-full max-w-[1240px] flex-1 items-center gap-8 px-6 py-10 md:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
        <section aria-labelledby="picker-title">
          <h1 id="picker-title" className="max-w-[14ch] text-[clamp(32px,3.6vw,46px)] font-semibold leading-[1.04] tracking-[-0.03em]">
            ¿Qué negocio vamos a recorrer?
          </h1>
          <p className="mt-3 max-w-[44ch] text-[15.5px] leading-relaxed text-fg-2">
            Cada rubro es una situación cotidiana en movimiento: el problema, la solución funcionando y lo que cambia.
          </p>

          <ul role="listbox" aria-label="Rubros" className="mt-8 flex flex-col gap-1">
            {scenarios.map((s) => (
              <BizOption key={s.id} sc={s} selected={s.id === sel} onSelect={() => setSel(s.id)} />
            ))}
          </ul>
        </section>

        <Preview sc={sc} entering={entering} onStart={start} />
      </main>

      {!!visits.length && (
        <section className="mx-auto w-full max-w-[1240px] px-6 pb-8 md:px-8">
          <h2 className="text-[13px] font-medium text-fg-2">Visitas guardadas</h2>
          <ul className="mt-2 divide-y divide-line-soft border-y border-line-soft">
            {visits.slice(0, 6).map((v) => {
              const vsc = scenarioById(v.scenarioId);
              return (
                <li key={v.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-[14px]">
                  <span className="font-medium">{v.businessName || 'Sin nombre'}</span>
                  <span className="text-fg-3">{vsc?.business.label}</span>
                  <span className="text-fg-3">{v.problems.length} problemas · {v.modules.length} módulos</span>
                  <span className="ml-auto font-mono text-[12px] text-fg-3">{new Date(v.updatedAt).toLocaleDateString('es-AR')}</span>
                  {vsc && (
                    <button className="text-fg-2 hover:text-brand" aria-label={`Exportar visita ${v.businessName || ''}`} onClick={() => exportVisit(vsc, v)}>
                      <Download size={16} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <footer className="px-6 pb-6 text-[12px] text-fg-3 md:px-8">
        Todo lo que se ve es una simulación con datos de ejemplo. Las conexiones reales se definen con cada negocio.
      </footer>
    </div>
  );
}

function minutes(sc: Scenario) {
  const end = compileTour(sc).end;
  return Math.max(1, Math.round(end / 60000));
}

function BizOption({ sc, selected, onSelect }: { sc: Scenario; selected: boolean; onSelect: () => void }) {
  const min = useMemo(() => minutes(sc), [sc]);
  return (
    <li role="option" aria-selected={selected}>
      <button
        onClick={onSelect}
        onMouseEnter={onSelect}
        onFocus={onSelect}
        className={`relative flex w-full items-center gap-4 rounded-[14px] px-4 py-3.5 text-left transition-colors ${selected ? 'bg-ink-2' : 'hover:bg-ink-1'}`}
      >
        {selected && <motion.span layoutId="biz-mark" className="absolute inset-y-3 left-0 w-[3px] rounded-full bg-brand" transition={{ duration: 0.3, ease: EASE }} />}
        <span className={`grid size-11 shrink-0 place-items-center rounded-[12px] transition-colors ${selected ? 'bg-brand-ghost text-brand' : 'bg-ink-3 text-fg-2'}`}>
          <Icon name={sc.business.icon} size={21} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[18px] font-semibold tracking-[-0.015em]">{sc.business.label}</span>
          <span className="block truncate text-[13.5px] text-fg-2">{sc.business.tagline}</span>
        </span>
        <span className="shrink-0 font-mono text-[12px] text-fg-3">~{min} min</span>
      </button>
    </li>
  );
}

function Preview({ sc, entering, onStart }: { sc: Scenario; entering: null | 'tour' | 'free'; onStart: (m: 'tour' | 'free') => void }) {
  const tour = useMemo(() => compileTour(sc), [sc]);
  const mgmt = PORTAL ? MANAGEMENT[sc.id] : undefined;
  return (
    <motion.section
      aria-label={`Vista previa: ${sc.business.label}`}
      className={entering ? 'fixed inset-0 z-50 flex flex-col bg-ink-1' : 'relative flex flex-col overflow-hidden rounded-[22px] border border-line bg-ink-1'}
      layout
      transition={{ duration: 0.5, ease: EASE }}
    >
      <div className="relative min-h-[300px] flex-1 border-b border-line-soft lg:min-h-[400px]">
        <AnimatePresence mode="wait">
          <MiniMap key={sc.id} sc={sc} />
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {!entering && (
          <motion.div exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="min-w-0">
              <h2 className="text-[13px] font-medium text-fg-2">El recorrido, en {tour.chapters.length} capítulos</h2>
              <ol className="mt-2.5 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                {tour.chapters.map((c, i) => (
                  <li key={c.id} className="flex items-baseline gap-2.5 text-[14px]">
                    <span className="font-mono text-[11.5px] text-fg-3">{i + 1}</span>
                    <span>{c.title}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex flex-col items-stretch gap-2 md:items-end">
              <div className="flex items-center gap-2">
                <button className="btn ghost" onClick={() => onStart('free')}>Explorar libre</button>
                <button className="btn primary" onClick={() => onStart('tour')}>Iniciar recorrido</button>
              </div>
              {mgmt && <a className="text-[13px] text-fg-2 underline decoration-line underline-offset-4 hover:text-fg hover:decoration-brand" href={mgmt}>Abrir demo de gestión</a>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

/** El mapa real del escenario (nodos y conexiones del rubro), en miniatura. Se arma una vez al elegir el rubro. */
function MiniMap({ sc }: { sc: Scenario }) {
  const cols = Math.max(...sc.nodes.map((n) => n.pos.col)) + 1;
  const rows = Math.max(...sc.nodes.map((n) => n.pos.row)) + 1;
  const cx = (c: number) => ((c + 0.5) / cols) * 100;
  const cy = (r: number) => ((r + 0.5) / rows) * 100;
  const byId = Object.fromEntries(sc.nodes.map((n) => [n.id, n]));
  return (
    <motion.div className="absolute inset-0 p-6 md:p-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <div className="relative h-full w-full">
        <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {sc.edges.map((e, i) => {
            const a = byId[e.from], b = byId[e.to];
            if (!a || !b) return null;
            const x1 = cx(a.pos.col), y1 = cy(a.pos.row), x2 = cx(b.pos.col), y2 = cy(b.pos.row);
            const mx = (x1 + x2) / 2;
            return (
              <motion.path key={e.id} d={`M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`} fill="none" stroke="#343c49" strokeWidth={1.4} vectorEffect="non-scaling-stroke"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.15 + i * 0.04, duration: 0.5, ease: EASE }} />
            );
          })}
        </svg>
        {sc.nodes.map((n, i) => (
          <motion.div
            key={n.id}
            className="absolute flex w-max max-w-[min(150px,19%)] -translate-x-1/2 -translate-y-1/2 items-start gap-1.5 rounded-[10px] border border-line bg-ink-2 px-2 py-1.5 text-[11.5px] leading-tight text-fg shadow-[0_6px_18px_-8px_rgb(0_0_0/.6)]"
            style={{ left: `${cx(n.pos.col)}%`, top: `${cy(n.pos.row)}%` }}
            initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.035, duration: 0.35, ease: EASE }}
          >
            <span className="mt-px shrink-0 text-brand" title={n.label}><Icon name={n.icon} size={13} /></span>
            <span className="hidden sm:inline">{n.label}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
