import { Banknote, Clock, Gauge, Timer, Users } from 'lucide-react'
import type { SimulatorMetrics, StoreProfile } from '@/domain/models'
import { CompareBars } from '@/components/charts/CompareBars'
import { Panel, PanelHeader } from '@/components/ui/Card'
import { StatTile } from '@/components/ui/Metric'
import { Badge } from '@/components/ui/Badge'
import { money, num, pct } from '@/utils/format'

export function SimulatorResults({
  metrics,
  profile,
}: {
  metrics: SimulatorMetrics
  profile: StoreProfile
}) {
  const hoursData = [
    { name: 'Hoy', horas: metrics.manualHours },
    { name: 'Con Rivect', horas: Math.max(0, metrics.manualHours - metrics.recoverableHours) },
  ]
  const marginData = [
    { name: 'Hoy', margen: metrics.currentContribution },
    { name: 'Proyectado', margen: metrics.projectedContribution },
  ]
  const remainingHours = Math.max(0, metrics.manualHours - metrics.recoverableHours)

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <StatTile
          label="Horas mensuales en atención"
          value={metrics.manualHours}
          decimals={1}
          suffix=" h"
          icon={<Clock className="h-4 w-4" />}
          hint={`${num(metrics.hoursPerEmployee, 1)} h por persona`}
        />
        <StatTile
          label="Horas recuperables"
          value={metrics.recoverableHours}
          decimals={1}
          suffix=" h"
          tone="mint"
          icon={<Timer className="h-4 w-4" />}
          hint={`${pct(profile.automationPercentage)} de automatización`}
        />
        <StatTile
          label="Capacidad adicional"
          value={metrics.additionalCapacity}
          suffix=" consultas"
          tone="brand"
          icon={<Gauge className="h-4 w-4" />}
          hint="Operaciones posibles, no ventas cerradas"
        />
        <StatTile
          label="Margen adicional potencial"
          value={metrics.additionalContribution}
          prefix="$ "
          tone="amber"
          icon={<Banknote className="h-4 w-4" />}
          hint={`${num(profile.recoveredSales)} ventas recuperadas × ${money(profile.averageTicket)}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="panel-pad">
          <PanelHeader
            title="Horas de atención por mes"
            subtitle="Operación actual vs. horas remanentes con automatización."
            icon={<Clock className="h-4 w-4" />}
            action={<Badge tone="mint">−{num(metrics.recoverableHours, 0)} h</Badge>}
          />
          <div className="mt-4">
            <CompareBars
              data={hoursData}
              series={[{ key: 'horas', label: 'Horas', color: '#5b95ff' }]}
              colors={['#5b95ff', '#4ade9f']}
              height={190}
              formatter={(value) => `${num(value, 0)} h`}
            />
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            {num(metrics.manualHours, 1)} h → {num(remainingHours, 1)} h ·{' '}
            {num(metrics.fullWorkdaysRecovered, 1)} jornadas de 8 h liberadas por mes.
          </p>
        </Panel>

        <Panel className="panel-pad">
          <PanelHeader
            title="Margen de contribución"
            subtitle="Margen actual vs. margen con ventas recuperadas."
            icon={<Banknote className="h-4 w-4" />}
            action={<Badge tone="brand">+{pct(metrics.upliftPct, 1)}</Badge>}
          />
          <div className="mt-4">
            <CompareBars
              data={marginData}
              series={[{ key: 'margen', label: 'Margen', color: '#f7bd54' }]}
              colors={['#5b95ff', '#f7bd54']}
              height={190}
              formatter={(value) => money(value)}
            />
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            El margen adicional proviene de las ventas recuperadas, no del ahorro de horas.
          </p>
        </Panel>
      </div>

      <Panel className="panel-pad">
        <PanelHeader
          title="Detalle del cálculo"
          subtitle="Cada indicador tiene una fórmula verificable con los datos ingresados."
          icon={<Users className="h-4 w-4" />}
        />
        <div className="mt-4 space-y-2.5 font-mono text-[11px] leading-relaxed text-slate-400">
          <Formula
            label="Consultas mensuales"
            expression={`${num(profile.dailyQueries)} consultas/día × ${num(profile.workingDays)} días`}
            result={`${num(metrics.monthlyQueries)}`}
          />
          <Formula
            label="Horas manuales"
            expression={`(${num(metrics.monthlyQueries)} × ${num(profile.averageMinutesPerQuery, 1)} min) ÷ 60`}
            result={`${num(metrics.manualHours, 1)} h`}
          />
          <Formula
            label="Horas recuperables"
            expression={`${num(metrics.manualHours, 1)} h × ${pct(profile.automationPercentage)}`}
            result={`${num(metrics.recoverableHours, 1)} h`}
          />
          <Formula
            label="Capacidad adicional"
            expression={`(${num(metrics.recoverableHours, 1)} h × 60) ÷ ${num(profile.averageMinutesPerQuery, 1)} min`}
            result={`${num(metrics.additionalCapacity)} consultas`}
          />
          <Formula
            label="Facturación adicional"
            expression={`${num(profile.recoveredSales)} ventas × ${money(profile.averageTicket)}`}
            result={money(metrics.additionalRevenue)}
          />
          <Formula
            label="Margen adicional"
            expression={`${money(metrics.additionalRevenue)} × ${pct(profile.contributionMargin)}`}
            result={money(metrics.additionalContribution)}
          />
        </div>
        <div className="mt-4 rounded-xl border border-line bg-ink-900/60 p-3 text-[11px] leading-relaxed text-slate-500">
          <span className="font-medium text-slate-300">Nota metodológica:</span> reducir horas no
          genera ingresos por sí solo. La facturación adicional se calcula con un escenario
          independiente de ventas recuperadas, editable en el panel de información comercial.
        </div>
      </Panel>
    </div>
  )
}

function Formula({
  label,
  expression,
  result,
}: {
  label: string
  expression: string
  result: string
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-line/60 pb-2.5 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-sans text-[11px] font-medium text-slate-300">{label}</p>
        <p className="text-[11px] text-slate-600">{expression}</p>
      </div>
      <p className="font-sans text-sm font-semibold text-white">{result}</p>
    </div>
  )
}
