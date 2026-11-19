// Helpers puros del calendario. Sin dependencias de React ni del DOM.
// Las fechas se manejan como fecha local (medianoche) y se serializan como 'AAAA-MM-DD'.

export type CalView = 'month' | 'week' | 'agenda';

export const VIEWS: CalView[] = ['month', 'week', 'agenda'];
export const AGENDA_BACK = 7;
export const AGENDA_AHEAD = 60;
export const NARROW_QUERY = '(max-width: 699.98px)';
/** Bajo 1024 px la vista por defecto es Semana (el mes no entra con chips legibles). */
export const COMPACT_QUERY = '(max-width: 1023.98px)';

export const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
// Indexado por getDay() (0 = domingo).
export const WEEKDAYS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
// Lunes primero.
export const SHORT_DAYS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Fecha local -> 'AAAA-MM-DD'. */
export function toIso(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 'AAAA-MM-DD' -> fecha local, o null si no es una fecha real. */
export function parseIso(value: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = new Date(y, mo - 1, Number(m[3]));
  if (Number.isNaN(d.getTime()) || d.getMonth() !== mo - 1 || d.getDate() !== Number(m[3])) return null;
  return d;
}

export function addDays(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

/** Medianoche local de hoy (o de `now`). */
export function startOfDay(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Lunes de la semana de `date`. */
export function weekStart(date: Date): Date {
  const d = startOfDay(date);
  return addDays(d, -((d.getDay() + 6) % 7));
}

/** Siete días de la semana (lunes a domingo) que contiene `date`. */
export function weekDays(date: Date): Date[] {
  const s = weekStart(date);
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
}

/** Primer día de la cuadrícula mensual (lunes anterior o igual al día 1). */
export function monthStart(date: Date): Date {
  return weekStart(new Date(date.getFullYear(), date.getMonth(), 1));
}

/** Cuadrícula de 6 semanas (42 días) que muestra el mes de `date`. */
export function monthGrid(date: Date): Date[] {
  const s = monthStart(date);
  return Array.from({ length: 42 }, (_, i) => addDays(s, i));
}

/** Rango inclusivo que se pide al servidor para cada vista. */
export function rangeFor(view: CalView, cursor: Date, now: Date = new Date()): { from: string; to: string } {
  if (view === 'agenda') {
    const t = startOfDay(now);
    return { from: toIso(addDays(t, -AGENDA_BACK)), to: toIso(addDays(t, AGENDA_AHEAD)) };
  }
  if (view === 'week') {
    const s = weekStart(cursor);
    return { from: toIso(s), to: toIso(addDays(s, 6)) };
  }
  const grid = monthGrid(cursor);
  return { from: toIso(grid[0]), to: toIso(grid[grid.length - 1]) };
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Título de la barra. Solo la primera letra va en mayúscula. */
export function formatTitle(view: CalView, cursor: Date): string {
  if (view === 'agenda') return `Próximos ${AGENDA_AHEAD} días`;
  if (view === 'week') {
    const s = weekStart(cursor);
    const e = addDays(s, 6);
    if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
      return `${s.getDate()} al ${e.getDate()} de ${MONTHS_ES[e.getMonth()]} de ${e.getFullYear()}`;
    }
    const sYear = s.getFullYear() !== e.getFullYear() ? ` de ${s.getFullYear()}` : '';
    return `${s.getDate()} de ${MONTHS_ES[s.getMonth()]}${sYear} al ${e.getDate()} de ${MONTHS_ES[e.getMonth()]} de ${e.getFullYear()}`;
  }
  return capitalizeFirst(`${MONTHS_ES[cursor.getMonth()]} de ${cursor.getFullYear()}`);
}

/** Título de encabezado de día en la agenda: «Miércoles 18 de noviembre de 2026». */
export function formatDayHeading(date: Date): string {
  return capitalizeFirst(`${WEEKDAYS_ES[date.getDay()]} ${date.getDate()} de ${MONTHS_ES[date.getMonth()]} de ${date.getFullYear()}`);
}

/** Hash de ruta: #/mes/AAAA-MM, #/semana/AAAA-MM-DD, #/agenda. */
export function routeFor(view: CalView, cursor: Date): string {
  if (view === 'agenda') return '#/agenda';
  if (view === 'week') return `#/semana/${toIso(weekStart(cursor))}`;
  return `#/mes/${toIso(cursor).slice(0, 7)}`;
}

/** Separa el hash en ruta y consulta: «#/mes/2026-11?nuevo=1» → path «#/mes/2026-11». */
export function splitHash(hash: string): { path: string; query: URLSearchParams; hasQuery: boolean } {
  const h = hash || '';
  const i = h.indexOf('?');
  if (i < 0) return { path: h, query: new URLSearchParams(), hasQuery: false };
  return { path: h.slice(0, i), query: new URLSearchParams(h.slice(i + 1)), hasQuery: true };
}

/** Ruta de vista + intenciones de la consulta (nuevo=1, trabajo=<id>). La consulta no altera la ruta. */
export function parseHash(hash: string): {
  route: { view: CalView; cursor: Date | null } | null;
  nuevo: boolean;
  trabajo: string | null;
  path: string;
  hasQuery: boolean;
} {
  const { path, query, hasQuery } = splitHash(hash);
  const rawId = query.get('trabajo') ?? '';
  const trabajo = /^[A-Za-z0-9-]{1,64}$/.test(rawId) ? rawId : null;
  return {
    route: parseRoute(path),
    nuevo: query.get('nuevo') === '1',
    trabajo,
    path,
    hasQuery,
  };
}

/** Día para un trabajo nuevo: hoy si está en el rango visible; si no, el primer día del rango. */
export function defaultNewDate(range: { from: string; to: string }, now: Date = new Date()): Date {
  const t = startOfDay(now);
  const key = toIso(t);
  if (key >= range.from && key <= range.to) return t;
  return parseIso(range.from) ?? t;
}

export function parseRoute(hash: string): { view: CalView; cursor: Date | null } | null {
  const h = splitHash(hash || '').path;
  let m = /^#\/mes\/(\d{4})-(\d{2})$/.exec(h);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) {
    return { view: 'month', cursor: new Date(Number(m[1]), Number(m[2]) - 1, 1) };
  }
  m = /^#\/semana\/(\d{4}-\d{2}-\d{2})$/.exec(h);
  if (m) {
    const d = parseIso(m[1]);
    return d ? { view: 'week', cursor: d } : null;
  }
  if (h === '#/agenda') return { view: 'agenda', cursor: null };
  return null;
}
