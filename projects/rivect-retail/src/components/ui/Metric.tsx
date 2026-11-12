import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { CountUp } from '@/components/reactbits/CountUp'
import { cn } from '@/utils/format'

export function StatTile({
  label,
  value,
  prefix,
  suffix,
  decimals = 0,
  icon,
  hint,
  tone = 'brand',
  delta,
  className,
  separator = true,
}: {
  label: string
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
  icon?: ReactNode
  hint?: ReactNode
  tone?: 'brand' | 'mint' | 'amber' | 'coral' | 'neutral' | 'violet'
  delta?: number
  className?: string
  separator?: boolean
}) {
  const toneRing: Record<string, string> = {
    brand: 'text-brand-300 border-brand-500/25 bg-brand-500/10',
    mint: 'text-mint-400 border-mint-500/25 bg-mint-500/10',
    amber: 'text-amber-400 border-amber-500/25 bg-amber-500/10',
    coral: 'text-coral-400 border-coral-500/25 bg-coral-500/10',
    violet: 'text-violet-300 border-violet-500/25 bg-violet-500/10',
    neutral: 'text-slate-400 border-line bg-ink-800',
  }

  return (
    <div
      className={cn(
        'panel group relative overflow-hidden p-4 transition-colors hover:border-brand-500/30 sm:p-5',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="kpi-label leading-relaxed">{label}</p>
        {icon ? (
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
              toneRing[tone],
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-3 font-display text-2xl font-semibold tracking-tight text-white sm:text-[26px]">
        <CountUp
          value={value}
          decimals={decimals}
          prefix={prefix}
          suffix={suffix}
          separator={separator}
        />
      </p>
      <div className="mt-1 flex items-center gap-2">
        {typeof delta === 'number' ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-[11px] font-medium',
              delta >= 0 ? 'text-mint-400' : 'text-coral-400',
            )}
          >
            {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        ) : null}
        {hint ? <p className="text-[11px] leading-relaxed text-slate-500">{hint}</p> : null}
      </div>
    </div>
  )
}

export function MetricRow({
  label,
  value,
  hint,
}: {
  label: string
  value: ReactNode
  hint?: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line/60 py-2.5 last:border-0">
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        {hint ? <p className="mt-0.5 text-[11px] text-slate-600">{hint}</p> : null}
      </div>
      <p className="font-display text-sm font-semibold text-white">{value}</p>
    </div>
  )
}
