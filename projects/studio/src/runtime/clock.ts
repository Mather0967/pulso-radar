/**
 * The single requestAnimationFrame loop: director tick + sim tick + token writer.
 * Continuous values live here as module variables; only discrete changes reach the store.
 */
import { compileSim, simStateAt, marksUpTo } from '../engine/sim';
import { beatAt, compileTour } from '../engine/tour';
import type { CompiledTour, Id, NodeStatus, Scenario, SimTimeline, SurfaceEvent } from '../engine/types';
import { foldSurfaces } from '../surfaces/reducers';
import { EMPTY_SIM, get, set } from './store';

/* ── edge registry: custom edges register their path + token dot for direct DOM writes ── */
export const edgeRegistry = new Map<Id, { path: SVGPathElement; dot: SVGGElement }>();

/* ── module state ── */
export const C = {
  sc: null as Scenario | null,
  tour: null as CompiledTour | null,
  t: 0,
  simT: null as number | null,
  holdReleased: -1,
};
let raf = 0;
let last = 0;
let lastTWrite = 0;
let lastSurfKey = '';
const tlCache = new Map<string, SimTimeline>();
const shown = new Set<Id>();

export function timeline(simId: Id, choices: Record<Id, Id>): SimTimeline {
  const key = simId + JSON.stringify(choices);
  let tl = tlCache.get(key);
  if (!tl) tlCache.set(key, (tl = compileSim(C.sc!.sims[simId], choices)));
  return tl;
}

/** Final state of the predecessor chain (Simulation.continues), so a story carries across chapters. */
function chainBase(simId: Id): { nodes: Record<Id, NodeStatus>; visited: Id[]; events: SurfaceEvent[] } {
  const prev = C.sc!.sims[simId].continues;
  if (!prev) return { nodes: {}, visited: [], events: [] };
  const base = chainBase(prev);
  const tl = timeline(prev, {});
  const s = simStateAt(tl, tl.end);
  return {
    nodes: { ...base.nodes, ...s.nodes },
    visited: [...new Set([...base.visited, ...s.visited])],
    events: [...base.events, ...marksUpTo(tl, tl.marks.length)],
  };
}
const baseCache = new Map<Id, ReturnType<typeof chainBase>>();
const baseOf = (id: Id) => baseCache.get(id) ?? (baseCache.set(id, chainBase(id)), baseCache.get(id)!);

export function load(sc: Scenario) {
  C.sc = sc;
  C.tour = compileTour(sc);
  C.t = 0;
  C.simT = null;
  C.holdReleased = -1;
  tlCache.clear();
  baseCache.clear();
  lastSurfKey = '';
  if (!raf) {
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
}

export function unload() {
  cancelAnimationFrame(raf);
  raf = 0;
  C.sc = C.tour = null;
}

const sameArr = (a: Id[], b: Id[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const sameRec = (a: Record<Id, string>, b: Record<Id, string>) => {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
};
const ease = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

// ponytail: loop runs while a scenario is open even when idle; per-frame idle cost is one sample + no writes.
function frame(now: number) {
  raf = requestAnimationFrame(frame);
  const s = get();
  const tour = C.tour;
  if (!tour || !C.sc) return;
  const dt = Math.min(now - last, 100) * s.tour.speed;
  last = now;
  let { playing, beatIndex } = s.tour;
  let scene = s.scene;

  if (s.tour.control === 'tour') {
    if (playing) {
      C.t += dt;
      const i = beatAt(tour, C.t);
      if (i !== beatIndex) {
        const cur = tour.beats[beatIndex];
        if (cur.hold && i > beatIndex && C.holdReleased !== beatIndex) {
          C.t = cur.t1 - 1;
          playing = false;
          C.holdReleased = beatIndex;
        } else {
          beatIndex = i;
          scene = tour.beats[i].scene;
        }
      }
      if (C.t >= tour.end) {
        C.t = tour.end;
        playing = false;
      }
      if (playing !== s.tour.playing || beatIndex !== s.tour.beatIndex || scene !== s.scene || now - lastTWrite > 100) {
        lastTWrite = now;
        set({ scene, animate: true, tour: { ...s.tour, t: C.t, playing, beatIndex } });
      }
    }
    C.simT = scene.sim ? C.t - scene.sim.t0 : null;
  } else if (scene.sim && C.simT !== null && !s.sim.awaiting) {
    C.simT += dt;
  }

  tickSim(scene.sim, C.simT);
}

function tickSim(run: { sim: Id; choices: Record<Id, Id> } | null, simT: number | null) {
  const s = get();
  const sc = C.sc!;
  if (!run || simT === null || !sc.sims[run.sim]) {
    if (lastSurfKey !== 'none') {
      lastSurfKey = 'none';
      set({ sim: { ...EMPTY_SIM, surfaces: foldSurfaces(sc.surfaces, []) } });
    }
    hideDots(new Set());
    return;
  }
  const tl = timeline(run.sim, run.choices);
  const st = simStateAt(tl, simT);
  const base = baseOf(run.sim);
  const nodes = { ...base.nodes, ...st.nodes };
  const visited = base.visited.length ? [...new Set([...base.visited, ...st.visited])] : st.visited;
  const done = simT >= tl.end && !st.awaiting;
  const surfKey = `${run.sim}|${JSON.stringify(run.choices)}|${st.nMarks}`;
  const cur = s.sim;
  const changed =
    !sameRec(nodes, cur.nodes) || !sameArr(st.active, cur.active) || !sameArr(visited, cur.visited) ||
    st.note !== cur.note || st.awaiting?.id !== cur.awaiting?.id || done !== cur.done || surfKey !== lastSurfKey;
  if (changed) {
    const surfaces = surfKey !== lastSurfKey ? foldSurfaces(sc.surfaces, [...base.events, ...marksUpTo(tl, st.nMarks)]) : cur.surfaces;
    lastSurfKey = surfKey;
    set({ sim: { nodes, active: st.active, visited, surfaces, note: st.note, awaiting: st.awaiting, done } });
  }

  // continuous: token dots, straight to the DOM
  const live = new Set<Id>();
  for (const tok of st.tokens) {
    const e = edgeRegistry.get(tok.edge);
    if (!e) continue;
    live.add(tok.edge);
    const len = e.path.getTotalLength();
    const pt = e.path.getPointAtLength(ease(tok.p) * len);
    e.dot.setAttribute('transform', `translate(${pt.x.toFixed(1)},${pt.y.toFixed(1)})`);
    if (!shown.has(tok.edge)) {
      e.dot.style.opacity = '1';
      const label = e.dot.querySelector('text');
      const bg = e.dot.querySelector('rect');
      if (label && bg) {
        label.textContent = tok.label ?? '';
        const w = tok.label ? tok.label.length * 6.4 + 20 : 0;
        bg.style.display = tok.label ? '' : 'none';
        bg.setAttribute('width', String(w));
        bg.setAttribute('x', String(-w / 2));
      }
      shown.add(tok.edge);
    }
  }
  hideDots(live);
}

function hideDots(live: Set<Id>) {
  for (const id of shown) {
    if (live.has(id)) continue;
    const e = edgeRegistry.get(id);
    if (e) e.dot.style.opacity = '0';
    shown.delete(id);
  }
}

/** Edges remount when layout changes; forget what we showed so the next frame re-shows it. */
export const forgetDot = (id: Id) => shown.delete(id);
