import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/lib/session';
import { dateChip, dateText, timeText, toProjectKey, PROJECT_COLOR, PROJECT_LABEL, useDelayed } from './shared';
import { useNotices } from './useNotices';

const MAX_ROWS = 5;

export function NoticesCard() {
  const { isAdmin } = useSession();
  const { data, error, loading, refresh } = useNotices();
  const showSkeleton = useDelayed(loading && !data && !error);

  const upcoming = data?.upcoming ?? [];
  const unread = isAdmin ? (data?.unreadMessages ?? 0) : 0;
  const visible = upcoming.slice(0, MAX_ROWS);

  return (
    <section data-testid="notices-card" aria-labelledby="notices-title" className="glass-panel rounded-2xl p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="notices-title" className="text-lg font-semibold leading-7">Centro de avisos</h2>
          <p className="text-sm text-muted-foreground">Trabajos de los próximos 7 días y mensajes del equipo.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/calendario">Ver calendario</Link>
        </Button>
      </header>

      <div className="mt-4">
        {error && (
          <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
            <span>No se pudieron cargar los avisos.</span>
            <Button variant="outline" size="sm" onClick={refresh}>Reintentar</Button>
          </div>
        )}

        {!data && !error && showSkeleton && (
          <div className="flex flex-col gap-2" aria-busy="true" aria-label="Cargando avisos">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-md" />
            ))}
          </div>
        )}

        {data && (
          <>
            {visible.length === 0 && unread === 0 && (
              <p className="py-3 text-sm text-muted-foreground">No hay nada que vencer esta semana.</p>
            )}

            {visible.length > 0 && (
              <ul className="divide-y">
                {visible.map((job, i) => {
                  const chip = dateChip(job.date);
                  const time = timeText(job);
                  return (
                    <li key={job.id} data-testid="notice-item" className="animate-fade-in flex items-center gap-3 py-2.5" style={{ '--d': `${0.35 + i * 0.045}s` } as CSSProperties}>
                      <div className="flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-md border bg-muted/40 font-mono tabular-nums">
                        <span className="text-xs uppercase leading-4 text-muted-foreground">{chip.top}</span>
                        <span className="text-sm font-semibold leading-5">{chip.bottom}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium leading-5">{job.title}</p>
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-5 text-muted-foreground">
                          <span className="font-mono tabular-nums">{dateText(job.date)}{time ? ` · ${time}` : ''}</span>
                        </p>
                        <Badge
                          variant={toProjectKey(job.project)}
                          className="mt-1 max-w-full"
                          style={{ boxShadow: `0 0 12px -4px hsl(${PROJECT_COLOR[toProjectKey(job.project)]} / 0.45)` }}
                        >
                          {PROJECT_LABEL[toProjectKey(job.project)]}
                        </Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {upcoming.length > MAX_ROWS && (
              <p className="pt-2 text-[13px]">
                <Link to="/calendario" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  Ver los {upcoming.length - MAX_ROWS} restantes en el calendario
                </Link>
              </p>
            )}

            {unread > 0 && (
              <Link
                to="/administracion?tab=messages"
                data-testid="unread-badge"
                className="mt-2 flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors duration-150 hover:border-[#354650] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span>{unread === 1 ? 'Tenés 1 mensaje sin leer.' : `Tenés ${unread} mensajes sin leer.`}</span>
                <span className="text-muted-foreground">Ver mensajes</span>
              </Link>
            )}
          </>
        )}
      </div>
    </section>
  );
}
