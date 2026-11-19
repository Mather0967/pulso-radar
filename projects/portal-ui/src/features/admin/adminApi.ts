// Llamadas a la API de administración. Todas pasan por `call`, así que cambiar el cliente
// compartido (@/lib/api) solo toca este archivo. Payloads y rutas idénticos al legacy.
import { api } from '@/lib/api';
import type { AdminUser, Grants, InviteResponse, MessagesResponse, ProjectKey, AdminMessage } from './types';

type Body = Record<string, unknown>;

function call<T>(method: 'GET' | 'POST' | 'PUT', path: string, body?: Body): Promise<T> {
  // El cliente compartido agrega Content-Type, credentials y x-csrf-token en escrituras.
  return api<T>(path, { method, body });
}

export async function fetchUsers(): Promise<AdminUser[]> {
  const data = await call<{ users: AdminUser[] }>('GET', '/api/admin/users');
  return data.users;
}

export interface SaveUserPatch {
  role?: 'admin' | 'member';
  active?: boolean;
}

/** PUT /api/admin/users. Siempre cierra las sesiones del usuario en el servidor. */
export function saveUser(id: string, patch: SaveUserPatch): Promise<{ saved: true; selfChanged: boolean }> {
  return call('PUT', '/api/admin/users', { id, ...patch });
}

/** PUT /api/admin/project-access. `null` quita el grant. Devuelve los grants completos. */
export function saveProjectAccess(
  id: string,
  projects: Record<ProjectKey, 'viewer' | 'editor' | null>,
): Promise<{ saved: true; projects: Grants }> {
  return call('PUT', '/api/admin/project-access', { id, projects });
}

export function createInvite(input: {
  email: string;
  role: 'admin' | 'member';
  projects: Record<ProjectKey, 'viewer' | 'editor' | null>;
}): Promise<InviteResponse> {
  return call('POST', '/api/admin/invite', input);
}

export function fetchMessages(): Promise<MessagesResponse> {
  return call('GET', '/api/admin/messages');
}

export function sendMessage(input: { to: string; body: string }): Promise<{ message: AdminMessage }> {
  return call('POST', '/api/admin/messages', input);
}

/** Marca como leídos ids concretos, o todos si `ids` es null. */
export function markMessagesRead(ids: string[] | null): Promise<{ marked: number }> {
  return call('POST', '/api/admin/messages/read', ids ? { ids } : { all: true });
}
