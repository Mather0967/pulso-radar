import { useEffect, useState } from 'react';
import { Loader2, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import type { SessionInfo } from '@/lib/types';
import { sessionDateLabel, sessionTitle } from './helpers';
import { useSessions } from './useSessions';

type Props = {
  /** Cambiar este valor vuelve a cargar la lista (p. ej. tras cambiar la contraseña). */
  refreshKey?: number;
};

export function SessionsCard({ refreshKey = 0 }: Props) {
  const { state, reload, revoke, revokeOthers } = useSessions();
  const [target, setTarget] = useState<SessionInfo | null>(null);
  const [busy, setBusy] = useState<'others' | 'one' | null>(null);
  const [confirmOthers, setConfirmOthers] = useState(false);

  useEffect(() => {
    if (refreshKey > 0) void reload();
  }, [refreshKey, reload]);

  const sessions = state.status === 'ready' ? state.sessions : [];
  const hasOthers = sessions.some((s) => !s.current);

  async function confirmRevoke() {
    if (!target) return;
    setBusy('one');
    try {
      await revoke(target.id);
      toast.success('Sesión cerrada.');
      setTarget(null);
    } catch {
      toast.error('No pudimos cerrar la sesión. Probá de nuevo.');
    } finally {
      setBusy(null);
    }
  }

  async function onRevokeOthers() {
    setBusy('others');
    try {
      const n = await revokeOthers();
      if (n === 0) toast.success('No había otras sesiones abiertas.');
      else toast.success(n === 1 ? 'Se cerró 1 sesión.' : `Se cerraron ${n} sesiones.`);
      setConfirmOthers(false);
    } catch {
      toast.error('No pudimos cerrar las demás sesiones. Probá de nuevo.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="sessions-title" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id="sessions-title" className="text-lg font-semibold leading-7">
            Sesiones activas
          </h2>
          <p className="text-sm text-muted-foreground">Dispositivos donde tu cuenta tiene la sesión abierta.</p>
        </div>
        {state.status === 'ready' && (
          <Button
            variant="outline"
            data-testid="revoke-others"
            onClick={() => setConfirmOthers(true)}
            disabled={!hasOthers || busy !== null}
            className="min-h-10 border-destructive/60 text-destructive hover:text-destructive md:min-h-9"
          >
            {busy === 'others' && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            Cerrar las demás sesiones
          </Button>
        )}
      </div>

      {state.status === 'loading' && (
        <div className="space-y-2" aria-busy="true" aria-label="Cargando sesiones">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {state.status === 'error' && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/50 px-3 py-3">
          <p className="text-sm text-destructive">{state.message}</p>
          <Button variant="outline" onClick={() => void reload()}>
            Reintentar
          </Button>
        </div>
      )}

      {state.status === 'ready' && sessions.length === 0 && (
        <EmptyState
          icon={<Monitor className="h-4 w-4" aria-hidden="true" />}
          title="No hay sesiones activas."
          description="Cuando inicies sesión en un dispositivo, aparecerá acá."
        />
      )}

      {state.status === 'ready' && sessions.length > 0 && (
        <ul data-testid="sessions-list" className="divide-y divide-border rounded-lg border border-border bg-card">
          {sessions.map((s) => (
            <li
              key={s.id}
              data-testid="session-row"
              data-session-id={s.id}
              className="flex min-h-12 items-center gap-3 px-4 py-3"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                <Monitor className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{sessionTitle(s.browser)}</p>
                <p className="truncate font-mono text-xs text-muted-foreground tabular-nums">
                  {sessionDateLabel(s.createdAt)}
                </p>
              </div>
              {s.current ? (
                <Badge variant="outline" className="shrink-0 whitespace-nowrap">Esta sesión</Badge>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="session-revoke"
                  aria-label={`Cerrar la sesión de ${sessionTitle(s.browser)}`}
                  onClick={() => setTarget(s)}
                  className="min-h-10 shrink-0 border-destructive/60 text-destructive hover:text-destructive md:min-h-8"
                >
                  Cerrar
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={confirmOthers} onOpenChange={(open) => !open && setConfirmOthers(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cerrar las demás sesiones?</DialogTitle>
            <DialogDescription>
              Todos los otros dispositivos dejarán de tener acceso al portal. Esta sesión sigue abierta.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button
              variant="destructive"
              data-testid="revoke-others-confirm"
              onClick={onRevokeOthers}
              disabled={busy !== null}
            >
              {busy === 'others' && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Cerrar las demás sesiones
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cerrar esta sesión?</DialogTitle>
            <DialogDescription>
              {target ? sessionTitle(target.browser) : ''} dejará de tener acceso al portal. Si la está usando, tendrá
              que volver a iniciar sesión.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button
              variant="destructive"
              data-testid="session-revoke-confirm"
              onClick={confirmRevoke}
              disabled={busy !== null}
            >
              {busy === 'one' && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Cerrar sesión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
