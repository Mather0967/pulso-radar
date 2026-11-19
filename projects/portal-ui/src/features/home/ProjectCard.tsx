import type { CSSProperties } from 'react';
import { ExternalLink } from 'lucide-react';
import landurBrand from '@/assets/landur-brand.png';
import symbolSvg from '@/assets/symbol.svg';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Project } from '@/lib/types';
import { cn } from '@/lib/utils';
import { toProjectKey } from './shared';

export type ProjectRow = Project & { access?: 'viewer' | 'editor' };

interface ProjectCardProps {
  project: ProjectRow;
  /** Acción mandarina («Para trabajar») o pizarra («Para mostrar»). */
  primary?: boolean;
  /** En celular, fila compacta (~56 px: símbolo, nombre, estado, un botón). En escritorio es tarjeta. */
  compact?: boolean;
  /** Retraso de la entrada escalonada, en segundos. */
  delay?: number;
}

// Símbolo del proyecto: tile 48 (44 en celular). Pulso y LANDUR usan sus marcas; Studio y Retail, letra.
function ProjectSymbol({ id, name }: { id: string; name: string }) {
  const key = toProjectKey(id);
  return (
    <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-background md:size-12" aria-hidden="true">
      {key === 'pulso' && <img src={symbolSvg} alt="" className="size-8" />}
      {key === 'landur' && <img src={landurBrand} alt="" className="h-[54px] w-auto max-w-none" />}
      {key === 'studio' && <span className="flex size-full items-center justify-center bg-primary/10 text-[22px] font-bold text-primary">S</span>}
      {key === 'retail' && <span className="flex size-full items-center justify-center bg-[#405c6b] text-[22px] font-bold text-[#e6eef2]">R</span>}
      {key === 'general' && <span className="flex size-full items-center justify-center bg-[#405c6b] text-[22px] font-bold text-[#e6eef2]">{name.slice(0, 1).toUpperCase()}</span>}
    </span>
  );
}

// La tarjeta entera es un enlace (stretched link): una sola acción visible, abre project.url.
export function ProjectCard({ project, primary = false, compact = false, delay = 0 }: ProjectCardProps) {
  const links = project.links ?? [];
  const status = (
    <>
      <span className="size-2 shrink-0 rounded-full border border-current" aria-hidden="true" />
      <span className="truncate">{project.status}</span>
    </>
  );

  return (
    <Card
      interactive
      data-testid={`project-card-${project.id}`}
      style={{ '--d': `${delay}s` } as CSSProperties}
      className={cn(
        'animate-card-in relative flex min-w-0 flex-col gap-3 p-5',
        compact && 'flex-row items-center gap-3 p-3 md:flex-col md:items-stretch md:gap-3 md:p-5',
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <ProjectSymbol id={project.id} name={project.name} />
        <div className="min-w-0 flex-1">
          <p className={cn('break-words font-mono text-xs font-medium uppercase leading-4 tracking-[0.08em] text-muted-foreground', compact && 'hidden md:block')}>
            {project.eyebrow}
          </p>
          <h3 className={cn('min-w-0 text-base font-semibold leading-6', !compact && 'mt-1')}>
            <a
              href={project.url}
              className="flex min-h-11 min-w-0 items-center rounded-sm after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none md:inline md:min-h-0"
            >
              <span className={cn('min-w-0', compact ? 'truncate md:whitespace-normal md:break-words' : 'break-words')}>{project.name}</span>
            </a>
          </h3>
          {compact && (
            <p className="mt-0.5 flex items-center gap-2 text-[13px] leading-5 text-muted-foreground md:hidden">{status}</p>
          )}
        </div>
        {project.access && (
          <Badge variant="outline" className={cn('shrink-0', compact && 'hidden md:inline-flex')}>
            {project.access === 'editor' ? 'Edición' : 'Solo lectura'}
          </Badge>
        )}
      </div>

      <p className={cn('text-sm leading-[22px] text-muted-foreground', compact && 'hidden md:block')}>{project.description}</p>

      {links.length > 0 && (
        <nav aria-label={`Accesos directos de ${project.name}`} className={cn('relative z-10 flex flex-wrap gap-x-4 gap-y-1 text-sm', compact && 'hidden md:flex')}>
          {links.map((link) => (
            <a key={link.url} href={link.url} className="inline-flex min-h-11 items-center rounded-sm underline-offset-4 md:min-h-0 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {link.label}
            </a>
          ))}
        </nav>
      )}

      <div className={cn('flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-3', compact ? 'md:mt-auto md:pt-2' : 'mt-auto pt-2')}>
        <span className={cn('min-w-0 items-center gap-2 text-[13px] leading-5 text-muted-foreground', compact ? 'hidden md:flex' : 'flex')}>{status}</span>
        <Button
          asChild
          size="sm"
          variant={primary ? 'default' : 'secondary'}
          className={cn('max-w-full whitespace-normal text-left min-h-11 md:min-h-0', compact && 'h-11 md:h-10')}
        >
          <span aria-hidden="true">
            Abrir {project.name}
            <ExternalLink className="size-4" />
          </span>
        </Button>
      </div>
    </Card>
  );
}
