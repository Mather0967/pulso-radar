import { describe, expect, it } from 'vitest';
import { scenarios } from '../content/scenarios';
import { buildGraph } from './layout';
import { compileSim, simStateAt } from './sim';
import { beatAt, compileTour } from './tour';
import { validateScenario } from './validate';

describe.each(scenarios.map((s) => [s.id, s] as const))('%s', (_, sc) => {
  it('has no dangling ids', () => expect(validateScenario(sc)).toEqual([]));

  it('sims are pure functions of t', () => {
    for (const sim of Object.values(sc.sims)) {
      const tl = compileSim(sim, {});
      for (const t of [0, tl.end / 3, tl.end / 2, tl.end]) expect(simStateAt(tl, t)).toEqual(simStateAt(tl, t));
      // choosing a branch never changes the timeline before the choice
      if (tl.awaiting) {
        const tl2 = compileSim(sim, { [tl.awaiting.id]: tl.awaiting.options[0].id });
        expect(simStateAt(tl2, tl.end - 1).nodes).toEqual(simStateAt(tl, tl.end - 1).nodes);
      }
    }
  });

  it('tour beats are contiguous and beatAt finds them', () => {
    const tour = compileTour(sc);
    tour.beats.forEach((b, i) => {
      expect(b.t1).toBeGreaterThan(b.t0);
      if (i) expect(b.t0).toBe(tour.beats[i - 1].t1);
      // a caption must stay long enough to be read
      if (b.scene.caption && b.scene.caption !== tour.beats[i - 1]?.scene.caption) expect(b.t1 - b.t0, b.scene.caption).toBeGreaterThan(2800);
      expect(beatAt(tour, b.t0 + 1)).toBe(i);
    });
    expect(tour.end / 1000).toBeGreaterThan(150); // ~3–6 min tour
    expect(tour.end / 1000).toBeLessThan(400);
  });

  it('layout: parents before children, no overlaps with any single node expanded', () => {
    for (const m of [null, ...sc.nodes]) {
      const g = buildGraph(sc, { view: { kind: 'map' }, expanded: m ? [m.id] : [] });
      const seen = new Set<string>();
      for (const n of g.nodes) {
        if ('parentId' in n && n.parentId) expect(seen.has(n.parentId)).toBe(true);
        seen.add(n.id);
      }
      const macros = sc.nodes.map((n) => g.rects[n.id]);
      for (let i = 0; i < macros.length; i++)
        for (let j = i + 1; j < macros.length; j++) {
          const a = macros[i], b = macros[j];
          const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
          expect(overlap).toBe(false);
        }
    }
  });
});
