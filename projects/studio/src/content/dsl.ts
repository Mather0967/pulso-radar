/**
 * Authoring helpers + the shared node library. Scenario files are written with these.
 * Everything returns plain data (engine/types).
 */
import type { Actor, DocCard, Edge, Id, MacroNode, SimStep, StepNode, SurfaceEvent } from '../engine/types';

/* ── graph ── */

export const st = (id: Id, label: string, actor: Actor, col: number, row = 0, detail?: string): StepNode => ({
  id, label, actor, pos: { col, row }, detail,
});

export const edge = (from: Id, to: Id, label?: string): Edge => ({ id: `${from}>${to}`, from, to, label });

/** a>b, b>c, … */
export const chain = (...ids: Id[]): Edge[] => ids.slice(1).map((to, i) => edge(ids[i], to));

/**
 * Shared node library: one entry per kind of system RIVECT builds or connects.
 * The same entry is reused across businesses with business-specific labels and steps.
 */
export const LIB = {
  whatsapp: { icon: 'message-circle', integration: 'whatsapp', service: 'Automatización de WhatsApp' },
  assistant: { icon: 'scan-text', integration: 'assistant', service: 'Asistente con IA' },
  catalog: { icon: 'package', integration: 'catalog', service: 'Catálogo conectado' },
  quotes: { icon: 'file-text', integration: 'quotes', service: 'Presupuestos automáticos' },
  followup: { icon: 'bell-ring', integration: 'followup', service: 'Seguimiento automático' },
  crm: { icon: 'users', integration: 'crm', service: 'CRM a medida' },
  admin: { icon: 'database', integration: 'admin', service: 'Software administrativo' },
  web: { icon: 'globe', integration: 'web', service: 'Página web / tienda' },
  ads: { icon: 'megaphone', integration: 'ads', service: 'Marketing digital' },
  agenda: { icon: 'calendar', integration: 'calendar', service: 'Agenda online' },
  confirm: { icon: 'calendar-check', integration: 'followup', service: 'Confirmaciones automáticas' },
  records: { icon: 'clipboard', integration: 'admin', service: 'Fichas digitales' },
  kitchen: { icon: 'chef-hat', integration: 'admin', service: 'Pedidos a cocina' },
  menu: { icon: 'book-open', integration: 'catalog', service: 'Carta digital' },
  reviews: { icon: 'star', integration: 'followup', service: 'Reseñas y experiencia' },
} as const;
export type LibKey = keyof typeof LIB;

export function macro(
  lib: LibKey, id: Id, [col, row]: [number, number], label: string, blurb: string,
  steps: StepNode[], edges: Edge[] = chain(...steps.map((s) => s.id)), surface?: Id,
): MacroNode {
  const L = LIB[lib];
  return { id, lib, label, blurb, icon: L.icon, integration: L.integration, pos: { col, row }, subflow: { nodes: steps, edges }, surface };
}

/* ── simulation steps ── */

type O = { dur?: number; par?: boolean; note?: string };
export const act = (node: Id, note?: string, o: O & { outcome?: 'done' | 'failed' } = {}): SimStep => ({ do: 'activate', node, note, ...o });
export const fail = (node: Id, note?: string, o: O = {}): SimStep => act(node, note, { ...o, outcome: 'failed' });
export const tok = (edges: Id | Id[], label?: string, o: O = {}): SimStep => ({ do: 'token', edges: [edges].flat(), label, ...o });
export const wait = (dur: number, note?: string, node?: Id, o: O = {}): SimStep => ({ do: 'wait', dur, note, node, ...o });
export const ev = (event: SurfaceEvent, o: O = {}): SimStep => ({ do: 'surface', event, ...o });

/** Chat message. `from` defaults to the customer. */
export const msg = (surface: Id, text: string, from: 'customer' | 'business' | 'bot' = 'customer', card?: DocCard, o: O = {}): SimStep[] => [
  ev({ surface, type: 'chat.typing', from }, { dur: o.dur ?? 900, par: o.par }),
  ev({ surface, type: 'chat.message', from, text, card }, { dur: 600 }),
];
