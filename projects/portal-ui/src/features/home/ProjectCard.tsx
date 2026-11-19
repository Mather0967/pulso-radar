import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Project } from '@/lib/types';
import { PROJECT_COLOR, toProjectKey } from './shared';

export type ProjectRow = Project & { access?: 'viewer' | 'editor' };

interface ProjectCardProps {
  project: ProjectRow;
  primary?: boolean;
  /** En celular, fila compacta (~56 px: nombre, estado, un botón). En escritorio es tarjeta. */
  compact?: boolean;
}

// La tarjeta entera es un enlace (stretched link): una sola acción visible, abre project.url.
export function ProjectCard({ project, primary = false, compact = false }: ProjectCardProps) {
  const color = PROJECT_COLOR[toProjectKey(project.id)];
  const links = project.links ?? [];
  const status = (
    <>
      <span className="size-2 shrink-0 rounded-full border border-current" aria-hidden="true" />
      <span className="truncate">{project.status}</span>
    </>
  );

  return (
    <article
      data-testid={`project-card-${project.id}`}
      className={
        compact
          ? 'relative flex min-w-0 items-center gap-3 rounded-lg border bg-card p-3 transition-colors duration-150 hover:border-[#354650] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background md:flex-col md:items-stretch md:gap-3 md:p-5'
          : 'relative flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-5 transition-colors duration-150 hover:border-[#354650] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background'
      }
    >
      <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={`break-words font-mono text-xs font-medium uppercase leading-4 tracking-[0.08em] text-muted-foreground${compact ? ' hidden md:block' : ''}`}>
            {project.eyebrow}
          </p>
          <h3 className={`flex min-w-0 items-center gap-2 text-base font-semibold leading-6${compact ? '' : ' mt-1'}`}>
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: `hsl(${color})` }} aria-hidden="true" />
            <a
              href={project.url}
              className={`min-w-0 rounded-sm after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none${compact ? ' truncate md:whitespace-normal md:break-words' : ' break-words'}`}
            >
              {project.name}
            </a>
          </h3>
          {compact && (
            <p className="mt-0.5 flex items-center gap-2 pl-[18px] text-[13px] leading-5 text-muted-foreground md:hidden">{status}</p>
          )}
        </div>
        {project.access && (
          <Badge variant="outline" className={`shrink-0${compact ? ' hidden md:inline-flex' : ''}`}>
            {project.access === 'editor' ? 'Edición' : 'Solo lectura'}
          </Badge>
        )}
      </div>

      <p className={`text-sm leading-[22px] text-muted-foreground${compact ? ' hidden md:block' : ''}`}>{project.description}</p>

      {links.length > 0 && (
        <nav aria-label={`Accesos directos de ${project.name}`} className={`relative z-10 flex flex-wrap gap-x-4 gap-y-1 text-sm${compact ? ' hidden md:flex' : ''}`}>
          {links.map((link) => (
            <a key={link.url} href={link.url} className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {link.label}
            </a>
          ))}
        </nav>
      )}

      <div className={`flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-3 md:mt-auto md:pt-2${compact ? '' : ' mt-auto pt-2'}`}>
        <span className={`min-w-0 items-center gap-2 text-[13px] leading-5 text-muted-foreground${compact ? ' hidden md:flex' : ' flex'}`}>{status}</span>
        <Button
          asChild
          size="sm"
          variant={primary ? 'default' : 'secondary'}
          className={`max-w-full whitespace-normal text-left${compact ? ' h-10 md:h-8' : ''}`}
        >
          <span aria-hidden="true">
            Abrir {project.name}
            <ExternalLink className="size-4" />
          </span>
        </Button>
      </div>
    </article>
  );
}
