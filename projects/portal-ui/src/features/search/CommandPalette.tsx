import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  CalendarDays,
  FolderKanban,
  Home,
  LogOut,
  Plus,
  Briefcase,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { Job, Project } from '@/lib/types';
import { addDays, todayMontevideo } from '@/lib/format';
import { normalize } from './normalize';
import { substringFilter } from './filter';

/** Textos buscables: el original y su versión sin acentos (cmdk filtra por texto literal). */
function searchable(...texts: string[]): string[] {
  return Array.from(new Set(texts.flatMap((t) => [t, normalize(t)])));
}

function shortDate(ymd: string): string {
  const [, m, d] = ymd.split('-');
  return `${d}/${m}`;
}

type JobsState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; jobs: Job[] }
  | { status: 'error' };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Buscador Ctrl/⌘+K: navegación, proyectos, trabajos y acciones. El servidor ya filtra lo visible. */
export function CommandPalette({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { isAdmin } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [jobs, setJobs] = useState<JobsState>({ status: 'idle' });
  const requested = useRef(false);

  // Carga perezosa: la primera vez que se abre el buscador.
  useEffect(() => {
    if (!open || requested.current) return;
    requested.current = true;
    setJobs({ status: 'loading' });

    api<{ projects: Project[] }>('/api/projects')
      .then((res) => setProjects(res.projects))
      .catch(() => setProjects([]));

    const today = todayMontevideo();
    const from = addDays(today, -7);
    const to = addDays(today, 90);
    api<{ jobs: Job[] }>(`/api/calendar/jobs?from=${from}&to=${to}`)
      .then((res) => setJobs({ status: 'ready', jobs: res.jobs }))
      .catch(() => setJobs({ status: 'error' }));
  }, [open]);

  const close = () => onOpenChange(false);

  const go = (path: string) => {
    close();
    navigate(path);
  };

  const goProject = (project: Project) => {
    close();
    window.location.assign(project.url);
  };

  const goJob = (job: Job) => {
    close();
    navigate(`/calendario#/mes/${job.date.slice(0, 7)}?trabajo=${encodeURIComponent(job.id)}`);
  };

  const newJob = () => {
    const month = todayMontevideo().slice(0, 7);
    close();
    navigate(`/calendario#/mes/${month}?nuevo=1`);
  };

  const logout = async () => {
    close();
    try {
      await api('/auth/logout', { method: 'POST' });
      window.location.assign('/login');
    } catch {
      toast.error('No pudimos cerrar la sesión. Probá de nuevo.');
    }
  };

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? id;

  const itemClass = 'h-11 md:h-9';

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} label="Buscar en el portal" filter={substringFilter}>
        <CommandInput placeholder="Buscar páginas, proyectos, trabajos…" />
        <CommandList>
          <CommandEmpty>Sin resultados</CommandEmpty>

          <CommandGroup heading="Ir a">
            <CommandItem data-testid="command-item" value="nav-home" keywords={searchable('Inicio', 'página principal')} onSelect={() => go('/')} className={itemClass}>
              <Home className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Inicio
            </CommandItem>
            <CommandItem data-testid="command-item"
              value="nav-calendar"
              keywords={searchable('Calendario', 'trabajos', 'agenda')}
              onSelect={() => go('/calendario')}
              className={itemClass}
            >
              <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Calendario
            </CommandItem>
            <CommandItem data-testid="command-item"
              value="nav-account"
              keywords={searchable('Mi cuenta', 'contraseña', 'sesiones', 'perfil')}
              onSelect={() => go('/cuenta')}
              className={itemClass}
            >
              <UserRound className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Mi cuenta
            </CommandItem>
            {isAdmin && (
              <CommandItem data-testid="command-item"
                value="nav-admin"
                keywords={searchable('Administración', 'usuarios', 'permisos', 'mensajes')}
                onSelect={() => go('/administracion')}
                className={itemClass}
              >
                <ShieldCheck className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Administración
              </CommandItem>
            )}
          </CommandGroup>

          {projects.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Proyectos">
                {projects.map((project) => (
                  <CommandItem data-testid="command-item"
                    key={project.id}
                    value={`project-${project.id}`}
                    keywords={searchable(project.name, 'proyecto')}
                    onSelect={() => goProject(project)}
                    className={itemClass}
                  >
                    <FolderKanban className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    {project.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          <CommandSeparator />
          <CommandGroup heading="Trabajos" forceMount={jobs.status === 'loading' || jobs.status === 'error'}>
            {jobs.status === 'loading' && (
              <div className="p-2" aria-busy="true" aria-label="Cargando trabajos">
                <Skeleton className="h-9 w-full" />
              </div>
            )}
            {jobs.status === 'error' && (
              <p className="px-2 py-3 text-sm text-muted-foreground">No pudimos cargar los trabajos.</p>
            )}
            {jobs.status === 'ready' &&
              jobs.jobs.map((job) => (
                <CommandItem data-testid="command-item"
                  key={job.id}
                  value={`job-${job.id}`}
                  keywords={searchable(job.title, shortDate(job.date), projectName(job.project))}
                  onSelect={() => goJob(job)}
                  className={itemClass}
                >
                  <Briefcase className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="truncate">{job.title}</span>
                  <span className="ml-auto pl-3 font-mono text-xs text-muted-foreground tabular-nums">
                    {shortDate(job.date)}
                  </span>
                </CommandItem>
              ))}
          </CommandGroup>

          <CommandSeparator />
          <CommandGroup heading="Acciones">
            <CommandItem data-testid="command-item" value="action-new-job" keywords={searchable('Nuevo trabajo', 'crear', 'agregar')} onSelect={newJob} className={itemClass}>
              <Plus className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Nuevo trabajo
            </CommandItem>
            <CommandItem data-testid="command-item" value="action-logout" keywords={searchable('Cerrar sesión', 'salir')} onSelect={logout} className={itemClass}>
              <LogOut className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Cerrar sesión
            </CommandItem>
          </CommandGroup>
        </CommandList>

        <div className="flex flex-wrap items-center gap-4 border-t border-border px-3 py-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CommandShortcut className="ml-0 font-mono">↑↓</CommandShortcut> moverse
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CommandShortcut className="ml-0 font-mono">↵</CommandShortcut> abrir
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CommandShortcut className="ml-0 font-mono">Esc</CommandShortcut> cerrar
          </span>
        </div>
    </CommandDialog>
  );
}
