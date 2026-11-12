import { compileSim, PACE } from './sim';
import type { CompiledTour, Scenario, Scene } from './types';

export const INITIAL_SCENE: Scene = {
  view: { kind: 'map' },
  expanded: [],
  camera: 'all',
  highlight: null,
  surfaces: [],
  caption: null,
  sim: null,
};

/** Pause after a sim ends before the next beat, so the result can be read. */
export const SIM_TAIL = 1600;

export function compileTour(sc: Scenario): CompiledTour {
  const beats: CompiledTour['beats'] = [];
  const chapters: CompiledTour['chapters'] = [];
  let scene = INITIAL_SCENE;
  let t = 0;
  sc.tour.chapters.forEach((ch, ci) => {
    chapters.push({ id: ch.id, title: ch.title, t0: t });
    for (const beat of ch.beats) {
      const { dur, hold, sim, ...patch } = beat;
      const next: Scene = { ...scene };
      for (const [k, v] of Object.entries(patch)) if (v !== undefined) (next as unknown as Record<string, unknown>)[k] = v;
      if (sim !== undefined) next.sim = sim ? { sim: sim.sim, choices: sim.choices ?? {}, t0: t } : null;
      scene = next;
      let d: number;
      if (dur === 'sim') {
        // until the running sim (possibly started beats ago) ends, plus a reading tail
        const s = scene.sim && sc.sims[scene.sim.sim];
        d = s ? Math.max(1200, scene.sim!.t0 + compileSim(s, scene.sim!.choices).end + SIM_TAIL - t) : 1000;
      } else d = dur * PACE;
      beats.push({ t0: t, t1: t + d, chapter: ci, hold: !!hold, scene });
      t += d;
    }
  });
  return { beats, chapters, end: t };
}

/** Index of the beat containing t (last beat for t >= end). */
export function beatAt(tour: CompiledTour, t: number): number {
  let lo = 0;
  let hi = tour.beats.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (tour.beats[mid].t0 <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
