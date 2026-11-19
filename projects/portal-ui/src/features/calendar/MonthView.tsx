import { cn } from '@/lib/utils'
import type { CalendarMe, Job } from '@/lib/types'
import { DayCell } from './DayCell'
import { JobChip } from './JobChip'
import { MONTHS_ES, SHORT_DAYS_ES, monthGrid, toIso } from './dates'
import { canEditJob, groupByDate } from './jobs'

export const MAX_CHIPS = 3

type Props = {
  cursor: Date
  jobs: Job[]
  me: CalendarMe | null
  todayKey: string
  assigneeName: (id: string) => string
  canCreate: boolean
  onOpen: (job: Job) => void
  onCreate: (date: Date) => void
  onMore: (date: Date) => void
  onDropJob: (jobId: string, dateKey: string) => void
  onKeyMove: (job: Job, days: -1 | 1) => void
  /** Cambia cuando cambia el mes o los datos, para reiniciar la animación de entrada. */
  animateKey: string
}

export function MonthView({
  cursor,
  jobs,
  me,
  todayKey,
  assigneeName,
  canCreate,
  onOpen,
  onCreate,
  onMore,
  onDropJob,
  onKeyMove,
  animateKey,
}: Props) {
  const byDate = groupByDate(jobs)
  const grid = monthGrid(cursor)

  return (
    <div role="group" aria-label={`Mes de ${MONTHS_ES[cursor.getMonth()]}`} key={animateKey} className="flex flex-col gap-1.5">
      <div className="grid grid-cols-7 gap-1.5" aria-hidden="true">
        {SHORT_DAYS_ES.map((label) => (
          <div key={label} className="px-1.5 text-xs font-medium text-muted-foreground">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {grid.map((date, i) => {
          const key = toIso(date)
          const list = byDate.get(key) ?? []
          const outside = date.getMonth() !== cursor.getMonth()
          return (
            <DayCell
              key={key}
              date={date}
              isToday={key === todayKey}
              isOutside={outside}
              onCreate={canCreate ? onCreate : undefined}
              onDropJob={onDropJob}
              className="min-h-[112px] animate-fade-in"
              style={{ animationDelay: `${Math.min(i, 12) * 18}ms` }}
            >
              <span className="flex items-center gap-1.5">
                <span className={cn('text-xs font-medium tabular-nums', key === todayKey ? 'text-foreground' : 'text-muted-foreground')}>
                  {date.getDate()}
                </span>
                {key === todayKey ? <span aria-label="Hoy" className="size-1.5 rounded-full bg-foreground" /> : null}
              </span>
              {list.slice(0, MAX_CHIPS).map((job) => (
                <JobChip
                  key={job.id}
                  job={job}
                  editable={canEditJob(me, job)}
                  assigneeName={assigneeName(job.assignee)}
                  onOpen={onOpen}
                  onKeyMove={onKeyMove}
                />
              ))}
              {list.length > MAX_CHIPS ? (
                <button
                  type="button"
                  title="Ver la semana completa"
                  aria-label={`Ver todos los trabajos de la semana del ${date.getDate()} de ${MONTHS_ES[date.getMonth()]}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onMore(date)
                  }}
                  className="self-start rounded-sm px-1.5 py-0.5 text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  +{list.length - MAX_CHIPS} más
                </button>
              ) : null}
            </DayCell>
          )
        })}
      </div>
    </div>
  )
}
