import { compileSim } from './sim';
import type { Id, Scenario, SimStep, SurfaceEvent } from './types';

/** Every dangling id in a scenario, as human-readable errors. Empty = valid. */
export function validateScenario(sc: Scenario): string[] {
  const err: string[] = [];
  const nodes = new Set<Id>();
  const edges = new Set<Id>();
  const macroIds = new Set(sc.nodes.map((m) => m.id));
  const grid = new Set<string>();

  for (const m of sc.nodes) {
    nodes.add(m.id);
    const g = `${m.pos.col},${m.pos.row}`;
    if (grid.has(g)) err.push(`node ${m.id}: grid ${g} taken`);
    grid.add(g);
    if (m.surface && !sc.surfaces[m.surface]) err.push(`node ${m.id}: unknown surface ${m.surface}`);
    const local = new Set(m.subflow.nodes.map((s) => s.id));
    for (const s of m.subflow.nodes) nodes.add(`${m.id}/${s.id}`);
    for (const e of m.subflow.edges) {
      edges.add(`${m.id}/${e.id}`);
      if (!local.has(e.from) || !local.has(e.to)) err.push(`subedge ${m.id}/${e.id}: bad endpoint`);
    }
  }
  for (const e of sc.edges) {
    edges.add(e.id);
    if (!macroIds.has(e.from) || !macroIds.has(e.to)) err.push(`edge ${e.id}: bad endpoint`);
  }
  for (const c of sc.comparisons) {
    const local = new Set([...c.before.nodes, ...c.after.nodes].map((s) => s.id));
    local.forEach((id) => nodes.add(`${c.id}/${id}`));
    for (const e of [...c.before.edges, ...c.after.edges]) {
      edges.add(`${c.id}/${e.id}`);
      if (!local.has(e.from) || !local.has(e.to)) err.push(`cmp edge ${c.id}/${e.id}: bad endpoint`);
    }
    for (const s of [c.beforeSim, c.afterSim]) if (!sc.sims[s]) err.push(`cmp ${c.id}: unknown sim ${s}`);
  }

  const checkEvent = (where: string, e: SurfaceEvent) => {
    if (!sc.surfaces[e.surface]) err.push(`${where}: unknown surface ${e.surface}`);
  };
  Object.values(sc.surfaces).forEach((s) => s.seed?.forEach((e) => checkEvent('seed', e)));

  const walk = (sim: Id, steps: SimStep[]) => {
    for (const s of steps) {
      if (s.do === 'choice') s.options.forEach((o) => walk(sim, o.steps));
      else if (s.do === 'activate' && !nodes.has(s.node)) err.push(`sim ${sim}: unknown node ${s.node}`);
      else if (s.do === 'wait' && s.node && !nodes.has(s.node)) err.push(`sim ${sim}: unknown node ${s.node}`);
      else if (s.do === 'token') s.edges.filter((e) => !edges.has(e)).forEach((e) => err.push(`sim ${sim}: unknown edge ${e}`));
      else if (s.do === 'surface') checkEvent(`sim ${sim}`, s.event);
    }
  };
  for (const [k, sim] of Object.entries(sc.sims)) {
    if (k !== sim.id) err.push(`sim key ${k} != id ${sim.id}`);
    if (sim.continues && !sc.sims[sim.continues]) err.push(`sim ${k}: unknown continues ${sim.continues}`);
    walk(k, sim.steps);
  }
  for (const q of sc.quickSims) if (!sc.sims[q]) err.push(`quickSim ${q} unknown`);

  const chapters = new Set(sc.tour.chapters.map((c) => c.id));
  const cmps = new Set(sc.comparisons.map((c) => c.id));
  for (const f of [...sc.diagnosis, ...sc.services]) {
    f.nodes.filter((n) => !nodes.has(n)).forEach((n) => err.push(`focus ${f.id}: unknown node ${n}`));
    if (f.chapter && !chapters.has(f.chapter)) err.push(`focus ${f.id}: unknown chapter ${f.chapter}`);
    if (f.comparison && !cmps.has(f.comparison)) err.push(`focus ${f.id}: unknown comparison ${f.comparison}`);
  }

  for (const ch of sc.tour.chapters) {
    ch.beats.forEach((b, i) => {
      const at = `beat ${ch.id}#${i}`;
      b.expanded?.filter((id) => !macroIds.has(id)).forEach((id) => err.push(`${at}: expanded unknown ${id}`));
      b.highlight?.filter((id) => !nodes.has(id)).forEach((id) => err.push(`${at}: highlight unknown ${id}`));
      if (b.camera && b.camera !== 'all') b.camera.nodes.filter((id) => !nodes.has(id)).forEach((id) => err.push(`${at}: camera unknown ${id}`));
      b.surfaces?.filter((id) => !sc.surfaces[id]).forEach((id) => err.push(`${at}: unknown surface ${id}`));
      if (b.surfaces && b.surfaces.length > 2) err.push(`${at}: more than 2 surfaces`);
      if (b.view?.kind === 'compare' && !cmps.has(b.view.id)) err.push(`${at}: unknown comparison ${b.view.id}`);
      if (b.sim) {
        const sim = sc.sims[b.sim.sim];
        if (!sim) err.push(`${at}: unknown sim ${b.sim.sim}`);
        else if (!b.hold && compileSim(sim, b.sim.choices ?? {}).awaiting) err.push(`${at}: unresolved choice on non-hold beat`);
      }
    });
  }
  return err;
}
