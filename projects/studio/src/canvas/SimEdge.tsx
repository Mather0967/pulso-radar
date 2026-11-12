import { getBezierPath, type EdgeProps } from '@xyflow/react';
import { memo, useLayoutEffect, useRef } from 'react';
import { edgeRegistry, forgetDot } from '../runtime/clock';
import { useStore } from '../runtime/store';

/** Base path + a hidden token dot that the clock moves with direct DOM writes. */
export const SimEdge = memo(function SimEdge(p: EdgeProps & { data?: { sub: boolean } }) {
  const [d] = getBezierPath({
    sourceX: p.sourceX, sourceY: p.sourceY, sourcePosition: p.sourcePosition,
    targetX: p.targetX, targetY: p.targetY, targetPosition: p.targetPosition,
    curvature: 0.35,
  });
  const path = useRef<SVGPathElement>(null);
  const dot = useRef<SVGGElement>(null);
  const state = useStore((s) => (s.sim.active.includes(p.id) ? 'active' : s.sim.visited.includes(p.id) ? 'visited' : 'idle'));
  const dim = useStore((s) => {
    const h = s.scene.highlight;
    if (!h) return false;
    const touches = (id: string) => h.includes(id) || h.includes(id.split('/')[0]);
    return !(touches(p.source) && touches(p.target));
  });

  useLayoutEffect(() => {
    if (!path.current || !dot.current) return;
    const entry = { path: path.current, dot: dot.current };
    edgeRegistry.set(p.id, entry);
    forgetDot(p.id);
    return () => {
      if (edgeRegistry.get(p.id) === entry) edgeRegistry.delete(p.id);
    };
  }, [p.id, d]);

  return (
    <g className={`sim-edge e-${state} ${p.data?.sub ? 'sub' : ''} ${dim ? 'dim' : ''}`}>
      <path ref={path} d={d} className="edge-base" fill="none" />
      <path d={d} className="edge-flow" fill="none" />
      <g ref={dot} className="token" style={{ opacity: 0 }}>
        <circle r={11} className="token-halo" />
        <circle r={5} className="token-core" />
        <rect y={-34} height={22} rx={11} className="token-label-bg" />
        <text y={-19} textAnchor="middle" className="token-label" />
      </g>
    </g>
  );
});
