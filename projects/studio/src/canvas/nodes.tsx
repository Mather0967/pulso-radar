import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Check, Clock3, Minus, Plus, User, X, Zap } from 'lucide-react';
import { memo } from 'react';
import type { LaneData, MacroData, StepData } from '../engine/layout';
import type { Id, NodeStatus } from '../engine/types';
import { openNode, toggleExpand } from '../runtime/actions';
import { useStore } from '../runtime/store';
import { Icon } from '../ui/Icon';

const SIDES = [
  ['top', Position.Top], ['right', Position.Right], ['bottom', Position.Bottom], ['left', Position.Left],
] as const;

function Handles() {
  return (
    <>
      {SIDES.map(([s, p]) => (
        <span key={s}>
          <Handle id={`s-${s}`} type="source" position={p} className="rf-handle" isConnectable={false} />
          <Handle id={`t-${s}`} type="target" position={p} className="rf-handle" isConnectable={false} />
        </span>
      ))}
    </>
  );
}

/** Dim when a highlight is set and neither the node nor its owner is in it. */
function useDimmed(id: Id, owner?: Id) {
  return useStore((s) => {
    const h = s.scene.highlight;
    return !!h && !h.includes(id) && !(owner && h.includes(owner)) && !h.some((x) => x.startsWith(id + '/'));
  });
}

const rank: Record<NodeStatus, number> = { idle: 0, done: 1, failed: 2, waiting: 3, active: 4 };

/** Own status, or — when collapsed — the most "alive" status among its children. */
function useMacroStatus(id: Id): NodeStatus {
  return useStore((s) => {
    let best: NodeStatus = s.sim.nodes[id] ?? 'idle';
    const prefix = id + '/';
    for (const k in s.sim.nodes) if (k.startsWith(prefix) && rank[s.sim.nodes[k]] > rank[best]) best = s.sim.nodes[k];
    return best;
  });
}

function StatusBadge({ status }: { status: NodeStatus }) {
  if (status === 'done') return <span className="status-badge bg-brand/15 text-brand"><Check size={12} strokeWidth={3} /></span>;
  if (status === 'failed') return <span className="status-badge bg-fail/15 text-fail"><X size={12} strokeWidth={3} /></span>;
  if (status === 'waiting') return <span className="status-badge bg-wait/15 text-wait"><Clock3 size={12} strokeWidth={2.5} className="spin-slow" /></span>;
  return null;
}

export const MacroNode = memo(function MacroNode({ id, data }: NodeProps & { data: MacroData }) {
  const { macro: m, expanded } = data;
  const status = useMacroStatus(id);
  const dim = useDimmed(id);
  const steps = m.subflow.nodes.length;
  return (
    <div className={`node macro s-${status} ${expanded ? 'expanded' : ''} ${dim ? 'dim' : ''}`}>
      <Handles />
      <div className="macro-head" onClick={(e) => { e.stopPropagation(); openNode(id); }}>
        <span className="macro-icon"><Icon name={m.icon} size={20} /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold tracking-[-0.01em] text-fg">{m.label}</span>
          <span className="block truncate text-[12.5px] text-fg-2">{m.blurb}</span>
        </span>
        {!expanded && <StatusBadge status={status} />}
      </div>
      <button
        className="macro-toggle"
        onClick={(e) => { e.stopPropagation(); toggleExpand(id); }}
        aria-label={expanded ? `Cerrar ${m.label}` : `Abrir ${m.label}`}
      >
        {expanded ? <Minus size={13} /> : <Plus size={13} />}
        <span>{expanded ? 'Cerrar' : `${steps} pasos`}</span>
      </button>
    </div>
  );
});

const FATE: Record<string, { text: string; cls: string }> = {
  removed: { text: 'Ya no hace falta', cls: 'fate-removed' },
  automated: { text: 'Se hace solo', cls: 'fate-automated' },
  human: { text: 'Sigue decidiendo una persona', cls: 'fate-human' },
};

export const StepNode = memo(function StepNode({ id, data }: NodeProps & { data: StepData }) {
  const { step, owner, fate, showFate } = data;
  const status = useStore((s) => s.sim.nodes[id] ?? 'idle');
  const dim = useDimmed(id, owner);
  const f = showFate && fate ? FATE[fate] : null;
  return (
    <div
      className={`node step actor-${step.actor} s-${status} ${dim ? 'dim' : ''} ${f?.cls ?? ''}`}
      onClick={(e) => { e.stopPropagation(); openNode(id); }}
    >
      <Handles />
      <span className="step-actor" title={step.actor === 'human' ? 'Persona' : step.actor === 'ai' ? 'Inteligencia artificial' : 'Automático'}>
        {step.actor === 'human' ? <User size={14} /> : step.actor === 'ai' ? <span className="text-[10px] font-bold">IA</span> : <Zap size={13} />}
      </span>
      <span className="step-label">{step.label}</span>
      <StatusBadge status={status} />
      {f && <span className="fate-tag">{f.text}</span>}
    </div>
  );
});

export const LaneNode = memo(function LaneNode({ data }: NodeProps & { data: LaneData }) {
  return (
    <div className={`lane lane-${data.lane}`}>
      <span className="text-[22px] font-semibold leading-tight tracking-[-0.02em]">{data.title}</span>
      <span className="text-[13px] text-fg-2">{data.sub}</span>
    </div>
  );
});
