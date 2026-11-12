import { Background, BackgroundVariant, ReactFlow, ReactFlowProvider, useNodesState, useReactFlow, type Node } from '@xyflow/react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { buildGraph, unionRect, type Rect } from '../engine/layout';
import type { Scenario } from '../engine/types';
import { openNode, takeover } from '../runtime/actions';
import { useStore } from '../runtime/store';
import { dockWidth } from '../surfaces/Dock';
import { LaneNode, MacroNode, StepNode } from './nodes';
import { SimEdge } from './SimEdge';

const nodeTypes = { macro: MacroNode, step: StepNode, lane: LaneNode };
const edgeTypes = { sim: SimEdge };

export const TOP_INSET = 72;
export const BOTTOM_INSET = 170;

/** Fit a rect into the unobstructed part of the pane (between top bar, dock and caption). */
function viewportFor(r: Rect, pane: { w: number; h: number }, right: number, maxZoom: number, top = 0) {
  const pad = 48;
  const availW = Math.max(200, pane.w - right - pad * 2);
  const availH = Math.max(200, pane.h - TOP_INSET - top - BOTTOM_INSET - pad * 2);
  const zoom = Math.max(0.3, Math.min(availW / r.w, availH / r.h, maxZoom));
  const cx = pad + availW / 2;
  const cy = TOP_INSET + top + pad + availH / 2;
  return { x: cx - (r.x + r.w / 2) * zoom, y: cy - (r.y + r.h / 2) * zoom, zoom };
}

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

function Flow({ sc }: { sc: Scenario }) {
  const view = useStore((s) => s.scene.view);
  const expanded = useStore((s) => s.scene.expanded);
  const camera = useStore((s) => s.scene.camera);
  const dockOpen = useStore((s) => s.scene.surfaces.length > 0);
  const animate = useStore((s) => s.animate);
  const speed = useStore((s) => s.tour.speed);
  const graph = useMemo(() => buildGraph(sc, { view, expanded }), [sc, view, expanded]);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const rf = useReactFlow();
  const wrap = useRef<HTMLDivElement>(null);
  const [pane, setPane] = useState({ w: 0, h: 0 });
  const current = useRef<Node[]>([]);
  current.current = nodes;

  useLayoutEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(() => setPane({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // layout tween: existing nodes glide to their new rect, new ones appear in place (CSS fades them in)
  useEffect(() => {
    const target = graph.nodes as unknown as Node[];
    const prev = new Map(current.current.map((n) => [n.id, n]));
    if (!animate || prev.size === 0) {
      setNodes(target);
      return;
    }
    const from = target.map((n) => prev.get(n.id) ?? n);
    const dur = 520 / speed;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = ease(Math.min(1, (now - t0) / dur));
      setNodes(target.map((n, i) => {
        const a = from[i];
        if (a === n) return n;
        return {
          ...n,
          position: { x: a.position.x + (n.position.x - a.position.x) * k, y: a.position.y + (n.position.y - a.position.y) * k },
          width: (a.width ?? 0) + ((n.width ?? 0) - (a.width ?? 0)) * k,
          height: (a.height ?? 0) + ((n.height ?? 0) - (a.height ?? 0)) * k,
        };
      }));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [graph]); // eslint-disable-line react-hooks/exhaustive-deps

  // camera: targets the FINAL layout immediately, glides while nodes tween
  const target = useMemo(() => {
    const ids = camera === 'all' ? Object.keys(graph.rects).filter((id) => !id.includes('/') || view.kind === 'compare') : camera.nodes;
    const rects = ids.map((id) => graph.rects[id] ?? graph.rects[id.split('/')[0]]).filter(Boolean);
    return { rect: unionRect(rects), maxZoom: camera === 'all' ? 1 : camera.maxZoom ?? 1.25 };
  }, [camera, graph, view.kind]);

  useEffect(() => {
    if (!target.rect || !pane.w) return;
    const right = dockOpen ? dockWidth(pane.w) + 24 : 0;
    const top = view.kind === 'compare' ? 56 : 0; // room for the compare summary card
    rf.setViewport(viewportFor(target.rect, pane, right, target.maxZoom, top), { duration: animate ? 1100 / speed : 0 });
  }, [target, pane, dockOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={wrap} className="absolute inset-0">
      <ReactFlow
        nodes={nodes}
        edges={graph.edges}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onMoveStart={(e) => e && takeover()}
        onPaneClick={() => openNode(null)}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnDoubleClick={false}
        deleteKeyCode={null}
        minZoom={0.3}
        maxZoom={1.8}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={28} size={1.2} color="#262c37" />
      </ReactFlow>
    </div>
  );
}

export function Canvas({ sc }: { sc: Scenario }) {
  return (
    <ReactFlowProvider>
      <Flow sc={sc} />
    </ReactFlowProvider>
  );
}
