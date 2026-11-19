import type { DragEvent, KeyboardEvent, MouseEvent } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Job } from '@/lib/types'
import { PROJECT_LABEL, PROJECT_DOT, STATUS_LABEL } from './constants'
import { JOB_DRAG_TYPE, initials } from './jobs'

type Props = {
  job: Job
  /** 'chip' en mes y semana; 'row' en la agenda (filas más altas, con proyecto y estado en texto). */
  variant?: 'chip' | 'row'
  /** Nombre del responsable (ya resuelto). Vacío si no hay responsable. */
  assigneeName?: string
  /** Solo quien puede editar el trabajo puede arrastrarlo o moverlo con teclado. */
  editable?: boolean
  /** Arrastrable. Por defecto, igual que `editable`; la agenda no arrastra. */
  draggable?: boolean
  onOpen: (job: Job) => void
  onKeyMove?: (job: Job, days: -1 | 1) => void
  /** Chip con foco animado al entrar (solo mes/semana). */
  entering?: boolean
}

const STATUS_CLASS: Record<Job['status'], string> = {
  pendiente: '',
  en_curso: 'before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-[hsl(var(--en-curso,205_80%_62%))] before:content-[""]',
  hecho: 'opacity-70',
}

export function JobChip({
  job,
  variant = 'chip',
  assigneeName = '',
  editable = false,
  draggable,
  onOpen,
  onKeyMove,
  entering = false,
}: Props) {
  const canDrag = draggable ?? editable
  const time = job.allDay ? 'Día' : job.start || ''
  const who = assigneeName ? initials(assigneeName) : ''
  const tooltip = `${job.title} · Responsable: ${assigneeName || 'sin responsable'} · ${PROJECT_LABEL[job.project]} · ${STATUS_LABEL[job.status]}`

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    // Alternativa de teclado al arrastre: Shift+←/→ mueve el trabajo un día.
    if (e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && editable && onKeyMove) {
      e.preventDefault()
      onKeyMove(job, e.key === 'ArrowLeft' ? -1 : 1)
    }
  }

  const handleDragStart = (e: DragEvent<HTMLButtonElement>) => {
    if (!canDrag) {
      e.preventDefault()
      return
    }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData(JOB_DRAG_TYPE, job.id)
    e.dataTransfer.setData('text/plain', job.title)
  }

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    // No dejar que el clic llegue a la celda (que crea un trabajo nuevo).
    e.stopPropagation()
    onOpen(job)
  }

  return (
    <button
      type="button"
      data-job-id={job.id}
      data-testid="job-chip"
      draggable={canDrag}
      onDragStart={handleDragStart}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      title={tooltip}
      aria-label={`${job.title}, ${time ? `${time}, ` : ''}${PROJECT_LABEL[job.project]}, ${STATUS_LABEL[job.status]}`}
      className={cn(
        'relative flex min-w-0 max-w-full items-center gap-1.5 overflow-hidden rounded-sm border border-border bg-background/60 text-left text-xs leading-4 text-foreground transition-colors duration-150 hover:border-[#354650] hover:bg-accent',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        variant === 'chip' ? 'min-h-6 px-1.5 py-0.5' : 'min-h-11 w-full px-3 py-2 text-sm leading-5',
        STATUS_CLASS[job.status],
        entering && 'animate-in fade-in-0 duration-200 motion-reduce:animate-none',
      )}
    >
      {variant === 'chip' ? (
        <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', PROJECT_DOT[job.project])} />
      ) : null}
      {time ? (
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{time}</span>
      ) : null}
      {job.status === 'hecho' ? <Check className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
      <span className="min-w-0 flex-1 truncate">{job.title}</span>
      {who ? (
        <span
          aria-hidden="true"
          className="shrink-0 rounded-full border border-border px-1 font-mono text-xs leading-4 tabular-nums text-muted-foreground"
        >
          {who}
        </span>
      ) : null}
      {variant === 'row' ? (
        <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
          {PROJECT_LABEL[job.project]} · {STATUS_LABEL[job.status]}
        </span>
      ) : null}
    </button>
  )
}
