import { CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import type { CalendarMe, Job } from '@/lib/types'
import { JobChip } from './JobChip'
import { formatDayHeading, parseIso } from './dates'
import { canEditJob, groupByDate } from './jobs'

type Props = {
  jobs: Job[]
  me: CalendarMe | null
  onKeyMove: (job: Job, days: -1 | 1) => void
  todayKey: string
  assigneeName: (id: string) => string
  canCreate: boolean
  onOpen: (job: Job) => void
  onCreate: () => void
  animateKey: string
  /** Texto cuando no hay trabajos en el rango. */
  emptyText?: string
}

export function AgendaView({ jobs, me, onKeyMove, todayKey, assigneeName, canCreate, onOpen, onCreate, animateKey, emptyText }: Props) {
  if (jobs.length === 0) {
    return (
      <EmptyState
        className="rounded-lg border border-dashed border-border"
        icon={<CalendarDays />}
        title={emptyText ?? 'No hay trabajos en este rango.'}
        action={
          canCreate ? (
            <Button variant="outline" onClick={onCreate}>
              Crear trabajo
            </Button>
          ) : undefined
        }
      />
    )
  }

  return (
    <div key={animateKey} className="flex flex-col gap-6 animate-in fade-in-0 duration-200 motion-reduce:animate-none">
      {Array.from(groupByDate(jobs)).map(([key, list]) => {
        const date = parseIso(key)
        const isToday = key === todayKey
        return (
          <section key={key} data-date={key} aria-labelledby={`agenda-${key}`} className="flex flex-col gap-2">
            <h3
              id={`agenda-${key}`}
              className={cn('text-sm font-semibold leading-5', isToday ? 'text-primary' : 'text-foreground')}
            >
              {date ? formatDayHeading(date) : key}
              {isToday ? <span className="ml-2 font-normal text-muted-foreground">Hoy</span> : null}
            </h3>
            <ul className="flex flex-col gap-1.5">
              {list.map((job) => (
                <li key={job.id}>
                  <JobChip
                    job={job}
                    variant="row"
                    assigneeName={assigneeName(job.assignee)}
                    editable={canEditJob(me, job)}
                    draggable={false}
                    onOpen={onOpen}
                    onKeyMove={onKeyMove}
                  />
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
