import { Package } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, type ReactNode } from 'react';
import type { Id, Scenario, SurfaceDef } from '../engine/types';
import { useStore } from '../runtime/store';
import { CredBadge } from '../ui/CredBadge';
import type { AdState, CalendarState, ChatState, CrmState, PanelState, StoreState } from './reducers';

export const dockWidth = (paneW: number) => (paneW >= 1440 ? 420 : 380);

export function Dock({ sc }: { sc: Scenario }) {
  const ids = useStore((s) => s.scene.surfaces);
  const w = dockWidth(window.innerWidth);
  return (
    <div className="pointer-events-none absolute right-4 top-[72px] bottom-[170px] z-20 flex flex-col gap-3" style={{ width: w }}>
      <AnimatePresence mode="popLayout" initial={false}>
        {ids.map((id) => (
          <motion.section
            key={id}
            layout
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            className="surface pointer-events-auto flex min-h-0 flex-1 flex-col"
          >
            <Surface id={id} def={sc.surfaces[id]} />
          </motion.section>
        ))}
      </AnimatePresence>
    </div>
  );
}

function Surface({ id, def }: { id: Id; def: SurfaceDef }) {
  const state = useStore((s) => s.sim.surfaces[id]);
  if (!def || !state) return null;
  const body = {
    chat: () => <Chat def={def} s={state as ChatState} />,
    crm: () => <Crm def={def} s={state as CrmState} />,
    panel: () => <Panel def={def} s={state as PanelState} />,
    store: () => <Store s={state as StoreState} />,
    calendar: () => <Agenda s={state as CalendarState} />,
    ad: () => <Ad s={state as AdState} />,
  }[def.kind]();
  return (
    <>
      <header className="flex items-center gap-2 border-b border-line-soft px-4 py-2.5">
        <span className="text-[13px] font-semibold text-fg">{def.title}</span>
        {def.contact && <span className="text-[12px] text-fg-3">· {def.contact}</span>}
        {def.integration && <span className="ml-auto"><CredBadge integration={def.integration} compact /></span>}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
    </>
  );
}

/** Enter animation only for items added after the surface mounted (a seek must not replay 30 entrances). */
function useFresh() {
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; }, []);
  return mounted;
}

function Item({ children, fresh, className }: { children: ReactNode; fresh: boolean; className?: string }) {
  return (
    <motion.div
      layout="position"
      initial={fresh ? { opacity: 0, y: 10, scale: 0.98 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Chat({ s }: { def: SurfaceDef; s: ChatState }) {
  const fresh = useFresh();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [s.messages.length, s.typing]);
  return (
    <div className="chat flex h-full flex-col gap-2 overflow-y-auto px-3 py-3">
      {s.messages.map((m, i) => (
        <Item key={i} fresh={fresh.current} className={`bubble from-${m.from}`}>
          {m.from === 'bot' && <span className="bubble-who">Asistente</span>}
          <p>{m.text}</p>
          {m.card && (
            <div className="doc-card">
              <div className="mb-1.5 text-[12.5px] font-semibold text-fg">{m.card.title}</div>
              {m.card.lines.map((l, j) => (
                <div key={j} className="flex justify-between gap-3 py-0.5 text-[12px]">
                  <span className="text-fg-2">{l.label}</span>
                  <span className="shrink-0 text-fg">{l.value}</span>
                </div>
              ))}
              {m.card.total && <div className="mt-1.5 border-t border-line pt-1.5 text-[12px] font-medium text-brand">{m.card.total}</div>}
            </div>
          )}
        </Item>
      ))}
      {s.typing && (
        <div className={`bubble from-${s.typing} typing`} aria-label="Escribiendo">
          <i /><i /><i />
        </div>
      )}
      <div ref={end} />
    </div>
  );
}

function Crm({ def, s }: { def: SurfaceDef; s: CrmState }) {
  const fresh = useFresh();
  const stages = def.stages ?? [...new Set(s.cards.map((c) => c.stage))];
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap gap-1.5 px-3 pt-3">
        {stages.map((st) => {
          const n = s.cards.filter((c) => c.stage === st).length;
          return (
            <span key={st} className={`stage-pill ${n ? 'has' : ''}`}>
              {st} <b>{n}</b>
            </span>
          );
        })}
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto p-3">
        {[...s.cards].reverse().map((c) => (
          <Item key={c.id} fresh={fresh.current} className={`crm-card ${c.moved ? 'moved' : ''}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-fg">{c.title}</span>
              <motion.span key={c.stage} initial={fresh.current ? { scale: 0.8, opacity: 0 } : false} animate={{ scale: 1, opacity: 1 }} className="crm-stage">
                {c.stage}
              </motion.span>
            </div>
            {c.note && <div className="mt-0.5 text-[12px] text-fg-2">{c.note}</div>}
          </Item>
        ))}
      </div>
    </div>
  );
}

function Panel({ def, s }: { def: SurfaceDef; s: PanelState }) {
  const fresh = useFresh();
  const cols = def.columns ?? [];
  return (
    <div className="h-full overflow-y-auto px-3 py-2">
      {cols.length > 1 && (
        <div className="panel-row panel-head" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0,1fr)) auto` }}>
          {cols.map((c) => <span key={c}>{c}</span>)}
          <span />
        </div>
      )}
      {s.rows.map((r) => (
        <Item key={r.id} fresh={fresh.current}>
          <div className={`panel-row ${cols.length === 1 ? 'single' : ''}`} style={{ gridTemplateColumns: `repeat(${Math.max(cols.length, 1)}, minmax(0,1fr)) auto` }}>
            {r.cells.map((c, i) => <span key={i} className={i === 0 ? 'text-fg' : 'text-fg-2'}>{c}</span>)}
            {r.status ? <span className={`row-status st-${statusTone(r.status)}`}>{r.status}</span> : <span />}
          </div>
        </Item>
      ))}
      {!s.rows.length && <p className="px-1 py-6 text-center text-[12.5px] text-fg-3">Esperando datos de la simulación</p>}
    </div>
  );
}

const statusTone = (s: string) => (/sin|falta|no /i.test(s) ? 'warn' : /pend|revis|esper/i.test(s) ? 'wait' : 'ok');

function Store({ s }: { s: StoreState }) {
  if (!s.product) return <p className="px-4 py-8 text-center text-[12.5px] text-fg-3">La tienda espera una visita</p>;
  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="store-img" aria-hidden><Package size={44} strokeWidth={1.25} /></div>
      <div>
        <div className="text-[16px] font-semibold text-fg">{s.product}</div>
        {s.detail && <div className="mt-0.5 text-[12.5px] text-real">● {s.detail}</div>}
      </div>
      <div className="flex gap-2">
        <span className="store-btn primary">{s.cta ?? 'Consultar'}</span>
      </div>
      {s.orders.map((o) => (
        <div key={o.id} className="crm-card moved text-[12.5px]">
          Pedido {o.id}: {o.items.join(', ')} · <b>{o.total}</b>
        </div>
      ))}
    </div>
  );
}

function Agenda({ s }: { s: CalendarState }) {
  const fresh = useFresh();
  const days = [...new Set(s.slots.map((x) => x.day))];
  return (
    <div className="h-full overflow-y-auto px-3 py-2">
      {days.map((d) => (
        <div key={d} className="mb-2">
          <div className="px-1 py-1 text-[11.5px] font-medium text-fg-3">{d}</div>
          {s.slots.filter((x) => x.day === d).sort((a, b) => a.time.localeCompare(b.time)).map((x) => (
            <Item key={x.id} fresh={fresh.current} className={`slot ${x.cancelled ? 'cancelled' : ''}`}>
              <span className="w-12 shrink-0 font-mono text-[12px] text-fg-2">{x.time}</span>
              <span className="text-[13px] text-fg">{x.label}</span>
            </Item>
          ))}
        </div>
      ))}
    </div>
  );
}

function Ad({ s }: { s: AdState }) {
  if (!s.ad) return <p className="px-4 py-8 text-center text-[12.5px] text-fg-3">Sin campaña activa</p>;
  return (
    <div className="p-4">
      <div className="ad">
        <div className="flex items-center gap-2 px-3 py-2">
          <span className="h-7 w-7 rounded-full bg-ink-3" />
          <span className="text-[12.5px]">
            <b className="block font-semibold text-fg">{s.ad.body}</b>
            <span className="text-fg-3">Publicidad</span>
          </span>
        </div>
        <div className="ad-visual"><span>{s.ad.headline}</span></div>
        <div className="flex items-center justify-between px-3 py-2.5">
          <span className="text-[12px] text-fg-2">{s.clicked ? 'Alguien tocó el anuncio' : 'Visible para gente de la zona'}</span>
          <motion.span animate={s.clicked ? { scale: [1, 0.92, 1] } : {}} className={`store-btn primary ${s.clicked ? 'pressed' : ''}`}>
            {s.ad.cta}
          </motion.span>
        </div>
      </div>
    </div>
  );
}
