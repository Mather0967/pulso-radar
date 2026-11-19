import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';
import { fetchUsers, saveProjectAccess, saveUser, type SaveUserPatch } from './adminApi';
import type { AdminUser, Grants, ProjectKey } from './types';

export type LoadStatus = 'loading' | 'ready' | 'error';

export interface SaveUserResult {
  /** El admin se cambió a sí mismo: el servidor cerró su sesión y hay que volver a entrar. */
  selfChanged: boolean;
}

/**
 * Lista de usuarios del portal y las mutaciones que la modifican.
 * Cada mutación actualiza la lista local solo si el servidor respondió 200.
 */
export function useUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [error, setError] = useState<string>('');
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setStatus('loading');
    setError('');
    try {
      const list = await fetchUsers();
      if (!mounted.current) return;
      setUsers(list);
      setStatus('ready');
    } catch (e) {
      if (!mounted.current) return;
      setError(messageOf(e));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateUser = useCallback(async (user: AdminUser, patch: SaveUserPatch): Promise<SaveUserResult> => {
    const result = await saveUser(user.id, patch);
    setUsers((list) => list.map((u) => (u.id === user.id ? { ...u, ...patch } : u)));
    return { selfChanged: result.selfChanged };
  }, []);

  const updateGrants = useCallback(
    async (user: AdminUser, projects: Record<ProjectKey, 'viewer' | 'editor' | null>): Promise<Grants> => {
      const saved = await saveProjectAccess(user.id, projects);
      setUsers((list) => list.map((u) => (u.id === user.id ? { ...u, projects: saved.projects } : u)));
      return saved.projects;
    },
    [],
  );

  return { users, status, error, reload: load, updateUser, updateGrants };
}

export function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'No se pudo completar la solicitud.';
}
