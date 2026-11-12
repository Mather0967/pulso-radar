import type { Id, NodeStatus, SimStep, SimTimeline, Simulation, SurfaceEvent } from './types';

export const DEFAULT_DUR = { activate: 900, token: 700, wait: 1400, surface: 500 } as const;
/** Global tempo: content is authored at a brisk pace; presentations run a bit slower. */
export const PACE = 1.3;

export function compileSim(sim: Simulation, choices: Record<Id, Id>): SimTimeline {
  const out: SimTimeline = { spans: [], marks: [], notes: [], end: 0, awaiting: null };

  // returns end time, or null when it stopped at an open choice
  const walk = (steps: SimStep[], start: number): number | null => {
    let t = start;
    let prevT0 = start;
    for (const s of steps) {
      if (s.do === 'choice') {
        const opt = s.options.find((o) => o.id === choices[s.id]);
        if (!opt) {
          out.awaiting = { id: s.id, prompt: s.prompt, options: s.options.map(({ id, label }) => ({ id, label })) };
          out.end = t;
          return null;
        }
        const r = walk(opt.steps, t);
        if (r === null) return null;
        t = prevT0 = r;
        continue;
      }
      const t0 = s.par ? prevT0 : t;
      const t1 = t0 + (s.dur ?? DEFAULT_DUR[s.do]) * PACE;
      if (s.do === 'activate') out.spans.push({ kind: 'node', node: s.node, t0, t1, waiting: false, outcome: s.outcome ?? 'done' });
      else if (s.do === 'wait' && s.node) out.spans.push({ kind: 'node', node: s.node, t0, t1, waiting: true, outcome: 'done' });
      else if (s.do === 'token') for (const edge of s.edges) out.spans.push({ kind: 'token', edge, t0, t1, label: s.label });
      else if (s.do === 'surface') out.marks.push({ t: t0, event: s.event });
      if (s.note) out.notes.push({ t0, t1, text: s.note });
      prevT0 = t0;
      t = Math.max(t, t1);
    }
    return t;
  };

  const end = walk(sim.steps, 0);
  if (end !== null) out.end = end;
  out.marks.sort((a, b) => a.t - b.t);
  return out;
}

export interface SimState {
  nodes: Record<Id, NodeStatus>;
  tokens: Array<{ edge: Id; p: number; label?: string }>;
  active: Id[]; // edges carrying a token now
  visited: Id[]; // edges a token already passed
  nMarks: number;
  note: string | null;
  awaiting: SimTimeline['awaiting'];
}

/** Pure sample of a compiled timeline at time t. */
export function simStateAt(tl: SimTimeline, rawT: number): SimState {
  const t = Math.max(0, Math.min(rawT, tl.end));
  const nodes: Record<Id, NodeStatus> = {};
  const tokens: SimState['tokens'] = [];
  const active: Id[] = [];
  const visited = new Set<Id>();
  for (const s of tl.spans) {
    if (t < s.t0) continue;
    if (s.kind === 'node') {
      nodes[s.node] = t >= s.t1 ? s.outcome : s.waiting ? 'waiting' : 'active';
    } else if (t >= s.t1) {
      visited.add(s.edge);
    } else {
      tokens.push({ edge: s.edge, p: (t - s.t0) / (s.t1 - s.t0), label: s.label });
      active.push(s.edge);
    }
  }
  let nMarks = 0;
  while (nMarks < tl.marks.length && tl.marks[nMarks].t <= t) nMarks++;
  let note: string | null = null;
  for (const n of tl.notes) if (n.t0 <= t && t < n.t1) note = n.text;
  return {
    nodes,
    tokens,
    active,
    visited: [...visited],
    nMarks,
    note,
    awaiting: tl.awaiting && t >= tl.end ? tl.awaiting : null,
  };
}

export const marksUpTo = (tl: SimTimeline, n: number): SurfaceEvent[] => tl.marks.slice(0, n).map((m) => m.event);
