import type { CalendarMe, Job } from '@/lib/types'
import { DayCell } from './DayCell'
import { JobChip } from './JobChip'
import { SHORT_DAYS_ES, toIso, weekDays } from './dates'
import { canEditJob, groupByDate } from './jobs'

type Props = {
  cursor: Date
  jobs: Job[]
  me: CalendarMe | null
  todayKey: string
  assigneeName: (id: string) => string
  canCreate: boolean
  onOpen: (job: Job) => void
  onCreate: (date: Date) => void
  onDropJob: (jobId: string, dateKey: string) => void
  onKeyMove: (job: Job, days: -1 | 1) => void
  animateKey: string
}

export function WeekView({
  cursor,
  jobs,
  me,
  todayKey,
  assigneeName,
  canCreate,
  onOpen,
  onCreate,
  onDropJob,
  onKeyMove,
  animateKey,
}: Props) {
  const byDate = groupByDate(jobs)
  const days = weekDays(cursor)

  return (
    <div
      role="group"
      aria-label="Semana"
      key={animateKey}
      className="grid grid-cols-7 gap-1.5 animate-in fade-in-0 duration-200 motion-reduce:animate-none"
    >
      {days.map((date, i) => {
        const key = toIso(date)
        const list = byDate.get(key) ?? []
        return (
          <DayCell
            key={key}
            date={date}
            isToday={key === todayKey}
            onCreate={canCreate ? onCreate : undefined}
            onDropJob={onDropJob}
            className="min-h-[240px]"
          >
            <div className="flex items-baseline gap-1.5 px-0.5">
              <span className="text-xs font-medium text-muted-foreground">{SHORT_DAYS_ES[i]}</span>
              <span className="flex items-center gap-1.5 text-sm font-medium tabular-nums text-foreground">
                {date.getDate()}
                {key === todayKey ? <span aria-label="Hoy" className="size-1.5 rounded-full bg-foreground" /> : null}
              </span>
            </div>
            {list.map((job) => (
              <JobChip
                key={job.id}
                job={job}
                editable={canEditJob(me, job)}
                assigneeName={assigneeName(job.assignee)}
                onOpen={onOpen}
                onKeyMove={onKeyMove}
              />
            ))}
          </DayCell>
        )
      })}
    </div>
  )
}
