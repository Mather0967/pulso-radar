import type { Comparison, Edge, Fate, GridPos, Id, MacroNode, Scenario, Scene, StepNode } from './types';

export const MACRO_W = 272;
export const MACRO_H = 100;
export const STEP_W = 208;
export const STEP_H = 68;
const STEP_GX = 44;
const STEP_GY = 34;
const PAD = 28;
export const HEADER = 92;
const GAP_X = 150;
const GAP_Y = 110;
const LANE_W = 160;
const CMP_GX = 44;
const LANE_GAP = 130;

export type Side = 'top' | 'right' | 'bottom' | 'left';
export interface Rect { x: number; y: number; w: number; h: number }

export type MacroData = { macro: MacroNode; expanded: boolean };
export type StepData = { step: StepNode; owner: Id; fate?: Fate; lane?: 'before' | 'after'; showFate?: boolean };
export type LaneData = { title: string; sub: string; lane: 'before' | 'after' };

export type GNode =
  | { id: Id; type: 'macro'; position: { x: number; y: number }; width: number; height: number; data: MacroData; zIndex?: number }
  | { id: Id; type: 'step'; position: { x: number; y: number }; width: number; height: number; data: StepData; parentId?: Id; extent?: 'parent'; zIndex?: number }
  | { id: Id; type: 'lane'; position: { x: number; y: number }; width: number; height: number; data: LaneData; selectable: false };

export interface GEdge {
  id: Id;
  source: Id;
  target: Id;
  sourceHandle: string;
  targetHandle: string;
  type: 'sim';
  zIndex?: number;
  data: { sub: boolean; label?: string };
}

export interface Graph { nodes: GNode[]; edges: GEdge[]; rects: Record<Id, Rect> }

/** Handle sides from grid direction. */
export function sides(a: GridPos, b: GridPos): [Side, Side] {
  const dx = b.col - a.col;
  const dy = b.row - a.row;
  // mostly-vertical moves use top/bottom so diagonal edges run through row gaps, not through nodes
  if (dx === 0 || Math.abs(dy) >= Math.abs(dx)) return dy >= 0 ? ['bottom', 'top'] : ['top', 'bottom'];
  return dx > 0 ? ['right', 'left'] : ['left', 'right'];
}

const span = (ns: { pos: GridPos }[], k: 'col' | 'row') => (ns.length ? Math.max(...ns.map((n) => n.pos[k])) + 1 : 1);

function macroSize(m: MacroNode, expanded: boolean) {
  if (!expanded) return { w: MACRO_W, h: MACRO_H };
  const cols = span(m.subflow.nodes, 'col');
  const rows = span(m.subflow.nodes, 'row');
  return {
    w: Math.max(MACRO_W, PAD * 2 + cols * STEP_W + (cols - 1) * STEP_GX),
    h: HEADER + rows * STEP_H + (rows - 1) * STEP_GY + PAD,
  };
}

function edge(owner: Id | null, e: Edge, posOf: (id: Id) => GridPos, sub: boolean, z?: number): GEdge {
  const p = (id: Id) => (owner ? `${owner}/${id}` : id);
  const [s, t] = sides(posOf(e.from), posOf(e.to));
  return {
    id: p(e.id), source: p(e.from), target: p(e.to),
    sourceHandle: `s-${s}`, targetHandle: `t-${t}`,
    type: 'sim', zIndex: z, data: { sub, label: e.label },
  };
}

export function buildGraph(sc: Scenario, scene: Pick<Scene, 'view' | 'expanded'>): Graph {
  if (scene.view.kind === 'compare') {
    const cmp = sc.comparisons.find((c) => c.id === (scene.view as { id: Id }).id);
    if (cmp) return buildCompare(cmp, scene.view.phase);
  }
  const exp = new Set(scene.expanded);
  const sizes = new Map(sc.nodes.map((m) => [m.id, macroSize(m, exp.has(m.id))]));
  const nCols = span(sc.nodes, 'col');
  const nRows = span(sc.nodes, 'row');
  const colW = Array.from({ length: nCols }, () => MACRO_W);
  const rowH = Array.from({ length: nRows }, () => MACRO_H);
  for (const m of sc.nodes) {
    const s = sizes.get(m.id)!;
    colW[m.pos.col] = Math.max(colW[m.pos.col], s.w);
    rowH[m.pos.row] = Math.max(rowH[m.pos.row], s.h);
  }
  const colX = colW.map((_, i) => colW.slice(0, i).reduce((a, w) => a + w + GAP_X, 0));
  const rowY = rowH.map((_, i) => rowH.slice(0, i).reduce((a, h) => a + h + GAP_Y, 0));

  const macros: GNode[] = [];
  const children: GNode[] = [];
  const edges: GEdge[] = [];
  const rects: Record<Id, Rect> = {};

  for (const m of sc.nodes) {
    const { w, h } = sizes.get(m.id)!;
    const x = colX[m.pos.col] + (colW[m.pos.col] - w) / 2;
    const y = rowY[m.pos.row] + (rowH[m.pos.row] - h) / 2;
    const isExp = exp.has(m.id);
    macros.push({ id: m.id, type: 'macro', position: { x, y }, width: w, height: h, data: { macro: m, expanded: isExp }, zIndex: isExp ? 1 : 0 });
    rects[m.id] = { x, y, w, h };
    if (!isExp) continue;
    const cols = span(m.subflow.nodes, 'col');
    const innerW = cols * STEP_W + (cols - 1) * STEP_GX;
    const ox = (w - innerW) / 2;
    for (const s of m.subflow.nodes) {
      const rx = ox + s.pos.col * (STEP_W + STEP_GX);
      const ry = HEADER + s.pos.row * (STEP_H + STEP_GY);
      const id = `${m.id}/${s.id}`;
      children.push({ id, type: 'step', parentId: m.id, extent: 'parent', position: { x: rx, y: ry }, width: STEP_W, height: STEP_H, data: { step: s, owner: m.id }, zIndex: 2 });
      rects[id] = { x: x + rx, y: y + ry, w: STEP_W, h: STEP_H };
    }
    const pos = new Map(m.subflow.nodes.map((n) => [n.id, n.pos]));
    for (const e of m.subflow.edges) edges.push(edge(m.id, e, (id) => pos.get(id)!, true, 3));
  }
  const mpos = new Map(sc.nodes.map((n) => [n.id, n.pos]));
  for (const e of sc.edges) edges.unshift(edge(null, e, (id) => mpos.get(id)!, false));

  return { nodes: [...macros, ...children], edges, rects };
}

function buildCompare(cmp: Comparison, phase: 'before' | 'shift' | 'after'): Graph {
  const nodes: GNode[] = [];
  const edges: GEdge[] = [];
  const rects: Record<Id, Rect> = {};
  const x0 = LANE_W + 36;
  const laneH = (ns: { pos: GridPos }[]) => span(ns, 'row') * STEP_H + (span(ns, 'row') - 1) * STEP_GY;
  const lanes: Array<{ lane: 'before' | 'after'; ns: Array<StepNode & { fate?: Fate }>; es: Edge[]; y: number }> = [
    { lane: 'before', ns: cmp.before.nodes, es: cmp.before.edges, y: 0 },
  ];
  if (phase !== 'before') lanes.push({ lane: 'after', ns: cmp.after.nodes, es: cmp.after.edges, y: laneH(cmp.before.nodes) + LANE_GAP });

  for (const L of lanes) {
    const h = laneH(L.ns);
    const laneId = `lane:${L.lane}`;
    const title = L.lane === 'before' ? 'Hoy' : 'Con RIVECT';
    const sub = L.lane === 'before' ? 'Así se resuelve a mano' : 'El mismo caso, ordenado';
    nodes.push({ id: laneId, type: 'lane', position: { x: 0, y: L.y }, width: LANE_W, height: h, data: { title, sub, lane: L.lane }, selectable: false });
    rects[laneId] = { x: 0, y: L.y, w: LANE_W, h };
    for (const s of L.ns) {
      const id = `${cmp.id}/${s.id}`;
      const x = x0 + s.pos.col * (STEP_W + CMP_GX);
      const y = L.y + s.pos.row * (STEP_H + STEP_GY);
      nodes.push({ id, type: 'step', position: { x, y }, width: STEP_W, height: STEP_H, data: { step: s, owner: cmp.id, fate: s.fate, lane: L.lane, showFate: phase !== 'before' } });
      rects[id] = { x, y, w: STEP_W, h: STEP_H };
    }
    const pos = new Map(L.ns.map((n) => [n.id, n.pos]));
    for (const e of L.es) edges.push(edge(cmp.id, e, (id) => pos.get(id)!, true));
  }
  return { nodes, edges, rects };
}

export function unionRect(rs: Rect[]): Rect | null {
  if (!rs.length) return null;
  const x = Math.min(...rs.map((r) => r.x));
  const y = Math.min(...rs.map((r) => r.y));
  const x2 = Math.max(...rs.map((r) => r.x + r.w));
  const y2 = Math.max(...rs.map((r) => r.y + r.h));
  return { x, y, w: x2 - x, h: y2 - y };
}
