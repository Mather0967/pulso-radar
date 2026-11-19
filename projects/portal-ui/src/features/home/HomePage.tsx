import { useCallback, useEffect, useMemo, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { NoticesCard } from './NoticesCard';
import { ProjectCard, type ProjectRow } from './ProjectCard';
import { useDelayed } from './shared';

const GROUPS = [
  { id: 'operacion', title: 'Para trabajar', note: 'Herramientas del día a día. Lo que hagas acá queda guardado.' },
  { id: 'ventas', title: 'Para mostrar', note: 'Demos comerciales con datos de ejemplo. Solo administradores.' },
] as const;

export default function HomePage() {
  const { user } = useSession();
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api<{ projects: ProjectRow[] }>('/api/projects');
      setProjects(res.projects);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const showSkeleton = useDelayed(loading && projects === null);
  const firstName = (user.name ?? '').trim().split(/\s+/)[0] ?? '';
  const list = projects ?? [];
  const count = list.length;

  const groups = useMemo(
    () => GROUPS.map((g) => ({ ...g, items: list.filter((p) => p.group === g.id) })).filter((g) => g.items.length > 0),
    [list],
  );
  const primaryId = groups[0]?.items[0]?.id;

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1200px] flex-col gap-8">
      <section>
        <h1 className="text-2xl font-semibold leading-8 tracking-[-0.02em] md:text-[28px] md:leading-9">
          {firstName ? `Hola, ${firstName}` : 'Hola'}
        </h1>
        {projects !== null && (
          <p className="mt-2 text-sm leading-[22px] text-muted-foreground">
            {count === 0
              ? 'Todavía no tenés proyectos habilitados.'
              : count === 1
                ? 'Tenés un proyecto habilitado.'
                : `Tenés ${count} proyectos habilitados.`}
          </p>
        )}
      </section>

      <NoticesCard />

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm">
          <span>No se pudieron cargar tus proyectos. Revisá tu conexión e intentá de nuevo.</span>
          <Button variant="outline" size="sm" onClick={() => void loadProjects()}>Reintentar</Button>
        </div>
      )}

      {projects === null && !error && (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando proyectos">
          {showSkeleton && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Skeleton className="h-[168px] min-w-0 rounded-lg" />
              <Skeleton className="h-[168px] min-w-0 rounded-lg" />
            </div>
          )}
        </div>
      )}

      {projects !== null && groups.length === 0 && (
        <section aria-labelledby="empty-title" className="flex flex-col items-center gap-3 rounded-lg border bg-card px-6 py-10 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-muted">
            <FolderOpen className="size-4 text-muted-foreground" aria-hidden="true" />
          </span>
          <h2 id="empty-title" className="text-base font-semibold leading-6">Todavía no tenés proyectos asignados.</h2>
          <p className="max-w-md text-sm leading-[22px] text-muted-foreground">
            Solicitá acceso a un administrador. Tener cuenta en RIVECT no habilita proyectos automáticamente.
          </p>
        </section>
      )}

      {groups.map((group) => (
        <section key={group.id} aria-labelledby={`group-${group.id}`} className="flex flex-col gap-4">
          <header>
            <h2 id={`group-${group.id}`} className="text-lg font-semibold leading-7">{group.title}</h2>
            <p className="text-sm leading-[22px] text-muted-foreground">{group.note}</p>
          </header>
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
            {group.items.map((project) => (
              <ProjectCard key={project.id} project={project} primary={project.id === primaryId} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
