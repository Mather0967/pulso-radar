import { money } from '@/utils/format'

export interface FunnelStep {
  label: string
  count: number
  value: number
  status?: string
}

export function Funnel({ steps }: { steps: FunnelStep[] }) {
  const max = Math.max(1, ...steps.map((s) => s.count))

  return (
    <div className="space-y-2.5">
      {steps.map((step, index) => {
        const width = Math.max(6, (step.count / max) * 100)
        const opacity = 1 - index * 0.09
        return (
          <div key={step.label} className="group">
            <div className="mb-1 flex items-center justify-between gap-3 text-[11px]">
              <span className="text-slate-400">{step.label}</span>
              <span className="flex items-center gap-2 text-slate-500">
                <span className="font-semibold text-slate-200">{step.count}</span>
                <span className="text-slate-600">·</span>
                <span>{money(step.value)}</span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-ink-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-500 via-brand-400 to-brand-300 transition-all duration-700"
                style={{ width: `${width}%`, opacity }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
