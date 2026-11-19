import {
  GRANT_PROJECTS,
  type AccessLevel,
  type AdminMessage,
  type AdminUser,
  type GrantFormValue,
  type Grants,
  type ProjectKey,
} from './types';

export const MESSAGE_MAX_LENGTH = 2000;
export const EMAIL_MAX_LENGTH = 254;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ACCESS_LABELS: Record<AccessLevel, string> = {
  editor: 'Edición',
  viewer: 'Solo lectura',
  none: 'Sin acceso',
};

export const GRANT_OPTIONS: { value: GrantFormValue; label: string }[] = [
  { value: '', label: 'Sin acceso' },
  { value: 'viewer', label: 'Solo lectura' },
  { value: 'editor', label: 'Edición' },
];

/** Texto para comparar en búsquedas: sin acentos, sin mayúsculas, sin espacios sobrantes. */
export function normalizeText(text: string): string {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Filtra usuarios por nombre o correo. Consulta vacía devuelve todos. */
export function filterUsers(users: AdminUser[], rawQuery: string): AdminUser[] {
  const query = normalizeText(rawQuery);
  if (!query) return users;
  return users.filter(
    (u) => normalizeText(u.name).includes(query) || normalizeText(u.email).includes(query),
  );
}

export function usersCountLabel(shown: number, total: number): string {
  return `${shown} de ${total} ${total === 1 ? 'usuario' : 'usuarios'}`;
}

export function emptyUsersMessage(total: number, rawQuery: string): string {
  return total > 0
    ? `Ningún usuario coincide con «${rawQuery.trim()}»`
    : 'Todavía no hay usuarios.';
}

/** Nivel efectivo de un usuario en un proyecto. Admin = edición en ambos. */
export function accessLevel(user: Pick<AdminUser, 'role' | 'projects'>, project: ProjectKey): AccessLevel {
  if (user.role === 'admin') return 'editor';
  return user.projects?.[project] ?? 'none';
}

export function isAdminUser(user: Pick<AdminUser, 'role'> | undefined): boolean {
  return user?.role === 'admin';
}

export function statsFromUsers(users: AdminUser[]) {
  return {
    active: users.filter((u) => u.active).length,
    admins: users.filter((u) => u.role === 'admin' && u.active).length,
    inactive: users.filter((u) => !u.active).length,
  };
}

/** Iniciales para el avatar: primera letra del primer y del último nombre. */
export function initials(name: string | undefined | null): string {
  const words = String(name ?? '?').trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? '?';
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/** Tono estable (0-359) por nombre: mismo nombre, mismo color. */
export function hueFromName(name: string): number {
  let hash = 0;
  for (const ch of String(name)) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  return hash % 360;
}

/** «recién», «hace N min», «hace N h» y después fecha corta. */
export function relativeTime(ms: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ms);
  const min = Math.round(diff / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `hace ${hours} h`;
  return new Date(ms).toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

/** Texto de vencimiento de una invitación. Acepta horas, «48 horas» o una fecha. */
export function expiryText(expires: number | string): string {
  const raw = String(expires);
  if (typeof expires === 'number' || /^\d+$/.test(raw)) return `Vence en ${raw} horas`;
  if (/^\d+\s+(horas|días|minutos)$/.test(raw)) return `Vence en ${raw}`;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? `Vence ${raw}` : `Vence el ${date.toLocaleString('es')}`;
}

export function isValidEmail(email: string): boolean {
  const value = email.trim();
  return value.length > 0 && value.length <= EMAIL_MAX_LENGTH && EMAIL_RE.test(value);
}

/** Valores del formulario de permisos a partir de un usuario. */
export function grantFormValues(user: AdminUser | undefined): Record<ProjectKey, GrantFormValue> {
  const pick = (project: ProjectKey): GrantFormValue => {
    if (!user) return '';
    if (user.role === 'admin') return 'editor';
    return user.projects?.[project] ?? '';
  };
  return { pulso: pick('pulso'), landur: pick('landur') };
}

/** Cuerpo de PUT /api/admin/project-access: ambos proyectos, null = sin acceso. */
export function grantsPayload(values: Record<ProjectKey, GrantFormValue>): Record<ProjectKey, 'viewer' | 'editor' | null> {
  return {
    pulso: values.pulso || null,
    landur: values.landur || null,
  };
}

/** Aplica cambios de proyectos sobre los grants actuales (null quita el grant). */
export function mergeGrants(current: Grants, changes: Partial<Record<ProjectKey, 'viewer' | 'editor' | null>>): Grants {
  const next: Grants = { ...current };
  for (const project of GRANT_PROJECTS) {
    if (!(project in changes)) continue;
    const value = changes[project];
    if (value === null || value === undefined) delete next[project];
    else next[project] = value;
  }
  return next;
}

const RANK: Record<AccessLevel, number> = { none: 0, viewer: 1, editor: 2 };

/** True si el cambio quita o baja algún acceso (lo que pide confirmación). */
export function isAccessRevocation(before: Grants, after: Grants): boolean {
  return GRANT_PROJECTS.some((project) => {
    const from = RANK[before[project] ?? 'none'];
    const to = RANK[after[project] ?? 'none'];
    return to < from;
  });
}

/** Lista legible de los proyectos cuyo acceso baja o se quita. */
export function revokedProjectsLabel(before: Grants, after: Grants): string[] {
  return GRANT_PROJECTS.filter((project) => RANK[after[project] ?? 'none'] < RANK[before[project] ?? 'none']).map(
    (project) => (project === 'pulso' ? 'Pulso' : 'LANDUR'),
  );
}

export function unreadBadgeText(count: number): string {
  return count > 99 ? '99+' : String(count);
}

export function messageCounterText(length: number): string {
  return `${length}/${MESSAGE_MAX_LENGTH}`;
}

/** Valida el cuerpo antes de enviar. Devuelve el error en español o null. */
export function messageBodyError(raw: string): string | null {
  const body = raw.trim();
  if (!body) return 'Escribí un mensaje.';
  if (body.length > MESSAGE_MAX_LENGTH) return `El mensaje supera los ${MESSAGE_MAX_LENGTH} caracteres.`;
  return null;
}

export function senderLabel(message: Pick<AdminMessage, 'mine' | 'fromName'>): string {
  return message.mine ? 'Vos' : message.fromName;
}

export function recipientLabel(message: Pick<AdminMessage, 'to' | 'toName' | 'mine'>): string {
  if (message.to === 'all') return 'a todos';
  return `a ${message.mine ? message.toName : 'vos'}`;
}

/** Marca como leídos los mensajes indicados (o todos) sin tocar los demás. */
export function markMessagesRead(messages: AdminMessage[], ids: string[] | null): AdminMessage[] {
  return messages.map((m) => (ids === null || ids.includes(m.id) ? { ...m, read: true } : m));
}

export function unreadCount(messages: AdminMessage[]): number {
  return messages.filter((m) => !m.read && !m.mine).length;
}
