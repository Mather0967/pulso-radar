import type { ReactNode } from 'react'
import { cn } from '@/utils/format'
import { SpotlightCard } from '@/components/reactbits/SpotlightCard'

export function Panel({
  children,
  className,
  spotlight = false,
  hoverLift = false,
}: {
  children: ReactNode
  className?: string
  spotlight?: boolean
  /** Eleva la tarjeta al pasar el cursor (sombra y desplazamiento leve). */
  hoverLift?: boolean
}) {
  if (spotlight) {
    return <SpotlightCard className={className}>{children}</SpotlightCard>
  }
  return (
    <div
      className={cn(
        'panel',
        hoverLift &&
          'hover:-translate-y-0.5 hover:border-brand-500/30 hover:shadow-[0_24px_56px_-18px_rgba(0,0,0,0.85)]',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function PanelHeader({
  title,
  subtitle,
  action,
  icon,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="flex items-start gap-3">
        {icon ? (
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-ink-800 text-brand-300 transition-transform duration-300 hover:scale-105">
            {icon}
          </div>
        ) : null}
        <div>
          <h2 className="font-display text-[15px] font-semibold tracking-tight text-white">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? <p className="kpi-label text-brand-400">{eyebrow}</p> : null}
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-white sm:text-[28px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  )
}
