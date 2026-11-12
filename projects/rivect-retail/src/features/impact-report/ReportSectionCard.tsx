import type { ReportSection } from '@/domain/models'

export function ReportSectionCard({ section }: { section: ReportSection }) {
  return (
    <section className="print-panel rounded-2xl border border-line/90 bg-ink-850/60 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-sm font-semibold text-white">{section.title}</h3>
        <span className="text-[10px] uppercase tracking-[0.14em] text-slate-600">Rivect</span>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{section.summary}</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {section.metrics.map((metric) => (
          <div
            key={`${section.id}-${metric.label}`}
            className="rounded-xl border border-line/80 bg-ink-900/50 px-3 py-2"
          >
            <p className="text-[10px] uppercase tracking-wider text-slate-600">{metric.label}</p>
            <p className="mt-0.5 font-display text-sm font-semibold text-white">{metric.value}</p>
            {metric.hint ? <p className="text-[10px] text-slate-600">{metric.hint}</p> : null}
          </div>
        ))}
      </div>

      <ul className="mt-3 space-y-1.5 text-[11px] leading-relaxed text-slate-400">
        {section.bullets.map((bullet) => (
          <li key={bullet} className="flex gap-1.5">
            <span className="text-brand-400">·</span>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
