import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { SessionInfo } from '@/lib/types';

export type SessionsState =
  | { status: 'loading' }
  | { status: 'ready'; sessions: SessionInfo[] }
  | { status: 'error'; message: string };

/** Sesiones activas del usuario (solo las propias). Un error de recarga no borra la lista ya cargada. */
export function useSessions() {
  const [state, setState] = useState<SessionsState>({ status: 'loading' });

  const load = useCallback(async () => {
    try {
      const res = await api<{ sessions: SessionInfo[] }>('/auth/sessions');
      setState({ status: 'ready', sessions: res.sessions });
    } catch {
      setState((prev) =>
        prev.status === 'ready' ? prev : { status: 'error', message: 'No pudimos cargar tus sesiones.' },
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Cierra una sesión ajena a la actual. Lanza si falla para que la UI avise. */
  const revoke = useCallback(
    async (id: string) => {
      await api('/auth/sessions/revoke', { method: 'POST', body: { id } });
      await load();
    },
    [load],
  );

  /** Cierra todas las demás sesiones; devuelve cuántas cerró. */
  const revokeOthers = useCallback(async () => {
    const res = await api<{ revoked: number }>('/auth/sessions/revoke-others', { method: 'POST' });
    await load();
    return res.revoked;
  }, [load]);

  return { state, reload: load, revoke, revokeOthers };
}
