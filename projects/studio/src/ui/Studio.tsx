import { ChevronLeft, ChevronRight, Hand, Pause, Play, Rewind } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { Canvas } from '../canvas/Canvas';
import type { Scenario } from '../engine/types';
import * as A from '../runtime/actions';
import { C } from '../runtime/clock';
import { useStore } from '../runtime/store';
import { Dock } from '../surfaces/Dock';
import { CompareOverlay, FocusCard, NodeDetail, PanelHost } from './Panels';

export function Studio({ sc }: { sc: Scenario }) {
  useKeys();
  return (
    <div className="studio relative h-full w-full overflow-hidden">
      <Canvas sc={sc} />
      <TopBar sc={sc} />
      <Dock sc={sc} />
      <NodeDetail sc={sc} />
      <CompareOverlay sc={sc} />
      <PanelHost sc={sc} />
      <BottomStack sc={sc} />
    </div>
  );
}

function useKeys() {
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea')) return;
      if (e.key === ' ') { e.preventDefault(); A.togglePlay(); }
      else if (e.key === 'ArrowRight') A.nextChapter();
      else if (e.key === 'ArrowLeft') A.prevChapter();
      else if (e.key === 'Escape') { A.openNode(null); useStore.setState({ panel: null }); }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);
}

function TopBar({ sc }: { sc: Scenario }) {
  const panel = useStore((s) => s.panel);
  const control = useStore((s) => s.tour.control);
  const visitCount = useStore((s) => (s.visit ? s.visit.problems.length + s.visit.modules.length : 0));
  const inCompare = useStore((s) => s.scene.view.kind === 'compare');
  const tab = (id: NonNullable<typeof panel>, label: string, extra?: number) => (
    <button className={`top-btn ${panel === id ? 'on' : ''}`} onClick={() => A.setPanel(id)}>
      {label}
      {!!extra && <span className="count">{extra}</span>}
    </button>
  );
  return (
    <header className="absolute inset-x-0 top-0 z-30 flex h-14 items-center gap-3 px-4">
      <button className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 hover:bg-ink-2" onClick={A.exitToPicker} title="Elegir otro rubro">
        <Mark />
        <span className="text-[14px] font-semibold tracking-[-0.01em]">RIVECT Studio</span>
      </button>
      <span className="h-5 w-px bg-line" />
      <span className="text-[14px] text-fg-2">{sc.business.label}</span>
      <div className="ml-auto flex items-center gap-1.5">
        {tab('diagnosis', 'Diagnóstico')}
        {tab('services', 'Servicios')}
        <button className={`top-btn ${inCompare && control === 'manual' ? 'on' : ''}`} onClick={() => (inCompare ? A.showMap() : A.startCompare(sc.comparisons[0]?.id))}>
          {inCompare ? 'Volver al mapa' : 'Antes y después'}
        </button>
        <button className="top-btn primary" onClick={() => A.runSim(sc.quickSims[0])}>
          {sc.sims[sc.quickSims[0]]?.label ?? 'Simular'}
        </button>
        {tab('visit', 'Lo que vimos', visitCount)}
      </div>
    </header>
  );
}

export const Mark = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
    <rect x="1" y="1" width="20" height="20" rx="6" fill="var(--color-brand)" />
    <circle cx="7" cy="11" r="2.2" fill="#101318" />
    <circle cx="15" cy="7" r="2.2" fill="#101318" />
    <circle cx="15" cy="15" r="2.2" fill="#101318" />
    <path d="M9 10.2 13 7.8M9 11.8l4 2.4" stroke="#101318" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

function BottomStack({ sc }: { sc: Scenario }) {
  const caption = useStore((s) => s.scene.caption);
  const note = useStore((s) => s.sim.note);
  const awaiting = useStore((s) => s.sim.awaiting);
  const focus = useStore((s) => s.focus);
  const beat = useStore((s) => s.tour.beatIndex);
  const control = useStore((s) => s.tour.control);
  const ended = useStore((s) => s.tour.control === 'tour' && !s.tour.playing && !!C.tour && s.tour.t >= C.tour.end - 1);
  const chapterIdx = C.tour?.beats[beat]?.chapter ?? 0;
  const chapter = C.tour?.chapters[chapterIdx];
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col gap-3 px-6 pb-4">
      <AnimatePresence>
        {awaiting && (
          <motion.div
            key={awaiting.id}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            className="choice pointer-events-auto self-start"
          >
            <p className="text-[19px] font-semibold tracking-[-0.01em] text-fg">{awaiting.prompt}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {awaiting.options.map((o) => (
                <button key={o.id} className="choice-btn" onClick={() => A.choose(o.id)}>{o.label}</button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-[86px] max-w-[min(900px,calc(100%-420px))]">
        {focus ? <FocusCard sc={sc} /> : (
          <>
            <div className="mb-1.5 flex h-5 items-center gap-3 text-[12.5px] text-fg-3">
              {control === 'tour' && chapter && <span>{chapterIdx + 1}/{C.tour!.chapters.length}&nbsp;&nbsp;{chapter.title}</span>}
              <AnimatePresence mode="wait">
                {note && (
                  <motion.span key={note} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-fg-2">
                    <i className="live-dot" />{note}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <AnimatePresence mode="wait">
              {caption && (
                <motion.p
                  key={caption}
                  initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -6, filter: 'blur(4px)' }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="caption"
                >
                  {caption}
                </motion.p>
              )}
            </AnimatePresence>
            {ended && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="pointer-events-auto mt-4 flex gap-2">
                <button className="btn primary" onClick={() => A.setPanel('visit')}>Guardar lo que vimos</button>
                <button className="btn" onClick={A.showMap}>Explorar libre</button>
                <button className="btn ghost" onClick={A.exitToPicker}>Ver otro rubro</button>
              </motion.div>
            )}
          </>
        )}
      </div>
      <TourBar />
    </div>
  );
}

const SPEEDS = [
  { v: 0.75, label: 'Ritmo tranquilo' },
  { v: 1, label: 'Ritmo normal' },
  { v: 1.5, label: 'Ritmo rápido' },
];

function TourBar() {
  const { t, playing, speed, control, beatIndex } = useStore((s) => s.tour);
  const tour = C.tour;
  if (!tour) return null;
  const sp = SPEEDS.find((x) => x.v === speed) ?? SPEEDS[1];
  const manual = control === 'manual';
  const holding = !playing && !manual && tour.beats[beatIndex]?.hold && t >= tour.beats[beatIndex].t1 - 5;
  return (
    <div className="tourbar pointer-events-auto">
      <button className="tb-btn" onClick={A.prevChapter} title="Volver al capítulo anterior (←)"><ChevronLeft size={18} /></button>
      <button className="tb-btn play" onClick={A.togglePlay} title={playing ? 'Pausar recorrido (espacio)' : 'Continuar recorrido (espacio)'}>
        {playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
      </button>
      <button className="tb-btn" onClick={A.nextChapter} title="Saltar al próximo capítulo (→)"><ChevronRight size={18} /></button>
      <button className="tb-btn" onClick={A.back} title="Retroceder un paso"><Rewind size={16} /></button>

      <div className="mx-2 flex h-9 flex-1 items-stretch gap-1">
        {tour.chapters.map((ch, i) => {
          const t1 = tour.chapters[i + 1]?.t0 ?? tour.end;
          const p = Math.max(0, Math.min(1, (t - ch.t0) / (t1 - ch.t0)));
          return (
            <button
              key={ch.id}
              className={`seg ${p > 0 && p < 1 ? 'cur' : ''}`}
              style={{ flexGrow: t1 - ch.t0 }}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                A.seek(ch.t0 + ((e.clientX - r.left) / r.width) * (t1 - ch.t0));
              }}
              title={ch.title}
            >
              <span className="seg-fill" style={{ transform: `scaleX(${p})` }} />
              <span className="seg-label">{ch.title}</span>
            </button>
          );
        })}
      </div>

      <button className="tb-btn wide" onClick={() => A.setSpeed(SPEEDS[(SPEEDS.indexOf(sp) + 1) % SPEEDS.length].v)}>{sp.label}</button>
      {manual ? (
        <button className="tb-btn wide resume" onClick={A.resume}><Play size={14} fill="currentColor" /> Volver al recorrido</button>
      ) : holding ? (
        <span className="px-2 text-[12.5px] text-brand">Elegí una opción o continuá</span>
      ) : (
        <button className="tb-btn wide" onClick={A.takeover}><Hand size={15} /> Tomar el control</button>
      )}
    </div>
  );
}
