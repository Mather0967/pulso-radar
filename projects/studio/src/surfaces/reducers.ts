import type { DocCard, Id, SurfaceDef, SurfaceEvent, SurfaceKind } from '../engine/types';

type From = 'customer' | 'business' | 'bot';
export interface ChatState { messages: Array<{ from: From; text: string; card?: DocCard }>; typing: From | null }
export interface CrmState { cards: Array<{ id: Id; stage: string; title: string; note?: string; moved: boolean }> }
export interface PanelState { rows: Array<{ id: Id; cells: string[]; status?: string }> }
export interface StoreState { product: string | null; detail?: string; cta?: string; orders: Array<{ id: Id; items: string[]; total: string }> }
export interface CalendarState { slots: Array<{ id: Id; day: string; time: string; label: string; cancelled: boolean }> }
export interface AdState { ad: { headline: string; body: string; cta: string } | null; clicked: boolean }

const upsert = <T extends { id: Id }>(list: T[], item: T) =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? { ...x, ...item } : x)) : [...list, item];

const reducers: { [K in SurfaceKind]: { initial: unknown; reduce: (s: never, e: SurfaceEvent) => unknown } } = {
  chat: {
    initial: { messages: [], typing: null } satisfies ChatState,
    reduce: (s: ChatState, e): ChatState =>
      e.type === 'chat.typing' ? { ...s, typing: e.from }
      : e.type === 'chat.message' ? { messages: [...s.messages, { from: e.from, text: e.text, card: e.card }], typing: null }
      : s,
  },
  crm: {
    initial: { cards: [] } satisfies CrmState,
    reduce: (s: CrmState, e): CrmState =>
      e.type === 'crm.card' ? { cards: upsert(s.cards, { id: e.id, stage: e.stage, title: e.title, note: e.note, moved: false }) }
      : e.type === 'crm.move' ? { cards: s.cards.map((c) => (c.id === e.id ? { ...c, stage: e.stage, note: e.note ?? c.note, moved: true } : c)) }
      : s,
  },
  panel: {
    initial: { rows: [] } satisfies PanelState,
    reduce: (s: PanelState, e): PanelState =>
      e.type === 'panel.row' ? { rows: upsert(s.rows, { id: e.id, cells: e.cells, status: e.status }) }
      : e.type === 'panel.status' ? { rows: s.rows.map((r) => (r.id === e.id ? { ...r, status: e.status } : r)) }
      : s,
  },
  store: {
    initial: { product: null, orders: [] } satisfies StoreState,
    reduce: (s: StoreState, e): StoreState =>
      e.type === 'store.view' ? { ...s, product: e.product, detail: e.detail, cta: e.cta }
      : e.type === 'store.order' ? { ...s, orders: upsert(s.orders, { id: e.id, items: e.items, total: e.total }) }
      : s,
  },
  calendar: {
    initial: { slots: [] } satisfies CalendarState,
    reduce: (s: CalendarState, e): CalendarState =>
      e.type === 'calendar.book' ? { slots: upsert(s.slots, { id: e.id, day: e.day, time: e.time, label: e.label, cancelled: false }) }
      : e.type === 'calendar.cancel' ? { slots: s.slots.map((x) => (x.id === e.id ? { ...x, cancelled: true } : x)) }
      : s,
  },
  ad: {
    initial: { ad: null, clicked: false } satisfies AdState,
    reduce: (s: AdState, e): AdState =>
      e.type === 'ad.show' ? { ad: { headline: e.headline, body: e.body, cta: e.cta }, clicked: false }
      : e.type === 'ad.click' ? { ...s, clicked: true }
      : s,
  },
};

/** Surface state = seed events + simulation events, folded through each kind's reducer. Pure. */
export function foldSurfaces(defs: Record<Id, SurfaceDef>, events: SurfaceEvent[]): Record<Id, unknown> {
  const out: Record<Id, unknown> = {};
  for (const [id, def] of Object.entries(defs)) {
    const r = reducers[def.kind];
    let s = r.initial;
    for (const e of [...(def.seed ?? []), ...events]) if (e.surface === id) s = r.reduce(s as never, e);
    out[id] = s;
  }
  return out;
}
