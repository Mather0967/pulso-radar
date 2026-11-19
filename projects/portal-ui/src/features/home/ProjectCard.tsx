import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Project } from '@/lib/types';
import { PROJECT_COLOR, toProjectKey } from './shared';

export type ProjectRow = Project & { access?: 'viewer' | 'editor' };

interface ProjectCardProps {
  project: ProjectRow;
  primary?: boolean;
}

// La tarjeta entera es un enlace (stretched link): una sola acción visible, abre project.url.
export function ProjectCard({ project, primary = false }: ProjectCardProps) {
  const color = PROJECT_COLOR[toProjectKey(project.id)];
  const links = project.links ?? [];

  return (
    <article
      data-testid={`project-card-${project.id}`}
      className="relative flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-5 transition-colors duration-150 hover:border-[#354650] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words font-mono text-[11px] font-medium uppercase leading-4 tracking-[0.08em] text-muted-foreground">
            {project.eyebrow}
          </p>
          <h3 className="mt-1 flex min-w-0 items-center gap-2 text-base font-semibold leading-6">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: `hsl(${color})` }} aria-hidden="true" />
            <a
              href={project.url}
              className="min-w-0 break-words rounded-sm after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none"
            >
              {project.name}
            </a>
          </h3>
        </div>
        {project.access && (
          <Badge variant="outline" className="shrink-0">
            {project.access === 'editor' ? 'Edición' : 'Solo lectura'}
          </Badge>
        )}
      </div>

      <p className="text-sm leading-[22px] text-muted-foreground">{project.description}</p>

      {links.length > 0 && (
        <nav aria-label={`Accesos directos de ${project.name}`} className="relative z-10 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {links.map((link) => (
            <a key={link.url} href={link.url} className="underline-offset-4 hover:underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {link.label}
            </a>
          ))}
        </nav>
      )}

      <div className="mt-auto flex min-w-0 flex-wrap items-center justify-between gap-3 pt-2">
        <span className="flex min-w-0 items-center gap-2 text-[13px] leading-5 text-muted-foreground">
          <span className="size-2 shrink-0 rounded-full border border-current" aria-hidden="true" />
          <span className="truncate">{project.status}</span>
        </span>
        <Button asChild size="sm" variant={primary ? 'default' : 'secondary'} className="max-w-full whitespace-normal text-left">
          <span aria-hidden="true">
            Abrir {project.name}
            <ExternalLink className="size-4" />
          </span>
        </Button>
      </div>
    </article>
  );
}
