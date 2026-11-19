import { useState, type DragEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { toIso } from './dates'
import { JOB_DRAG_TYPE } from './jobs'

type Props = {
  date: Date
  isToday: boolean
  isOutside?: boolean
  /** Solo si el usuario puede crear: clic en la celda abre «Nuevo trabajo» para ese día. */
  onCreate?: (date: Date) => void
  /** Se llama al soltar un trabajo arrastrado sobre la celda. */
  onDropJob: (jobId: string, dateKey: string) => void
  className?: string
  children: ReactNode
}

function carriesJob(e: DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes(JOB_DRAG_TYPE)
}

export function DayCell({ date, isToday, isOutside = false, onCreate, onDropJob, className, children }: Props) {
  const dateKey = toIso(date)
  const [over, setOver] = useState(false)

  return (
    <div
      data-date={dateKey}
      data-today={isToday ? 'true' : undefined}
      tabIndex={-1}
      onClick={onCreate ? () => onCreate(date) : undefined}
      onDragOver={(e) => {
        if (!carriesJob(e)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        if (!over) setOver(true)
      }}
      onDragLeave={(e) => {
        if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return
        setOver(false)
      }}
      onDrop={(e) => {
        if (!carriesJob(e)) return
        e.preventDefault()
        setOver(false)
        const id = e.dataTransfer.getData(JOB_DRAG_TYPE)
        if (id) onDropJob(id, dateKey)
      }}
      className={cn(
        'relative flex min-w-0 flex-col gap-1 rounded-md border bg-card p-1.5 transition-colors duration-150',
        isToday ? 'border-foreground/50' : 'border-border',
        isOutside && 'opacity-50',
        over && 'border-primary bg-accent',
        onCreate && 'cursor-pointer hover:border-[#354650]',
        className,
      )}
    >
      {children}
    </div>
  )
}
