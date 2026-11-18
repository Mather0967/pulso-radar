import { motion, useReducedMotion } from 'framer-motion'
import { SlidersHorizontal, Sparkles } from 'lucide-react'
import type { Scenario, ScenarioKey } from '@/domain/models'
import { NumberField } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Badge'
import { cn, num, pct } from '@/utils/format'
import { useFieldLimits } from './useFieldLimits'

export function ScenarioLab({
  scenarios,
  active,
  onApply,
  onUpdate,
  automationPercentage,
}: {
  scenarios: Scenario[]
  active: ScenarioKey
  onApply: (key: ScenarioKey) => void
  onUpdate: (key: ScenarioKey, assumptions: Partial<Scenario['assumptions']>) => void
  automationPercentage: number
}) {
  const { bind } = useFieldLimits()
  const reduce = useReducedMotion()
  return (
    <div className="panel panel-pad">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-brand-300" />
            <h2 className="font-display text-sm font-semibold text-white">Escenarios de simulación</h2>
            {active === 'custom' ? <Badge tone="violet">Personalizado</Badge> : null}
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400">
            Los escenarios cambian supuestos declarados de automatización y recuperación de ventas.
            El motor recalcula todo al instante: no son proyecciones garantizadas.
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-line bg-ink-900/70 px-3 py-1 text-[10px] text-slate-400">
          <Sparkles className="h-3 w-3 text-brand-300" />
          Supuestos editables
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {scenarios.map((scenario, index) => {
          const isActive = scenario.key === active
          return (
            <motion.button
              key={scenario.key}
              type="button"
              onClick={() => onApply(scenario.key)}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileTap={reduce ? undefined : { scale: 0.985 }}
              transition={{ duration: 0.35, delay: reduce ? 0 : index * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                'group relative overflow-hidden rounded-xl border p-4 text-left transition-colors',
                isActive
                  ? 'border-brand-500/50 bg-brand-500/[0.08] shadow-[inset_0_0_0_1px_rgba(255,118,46,0.25)]'
                  : 'border-line bg-ink-900/50 hover:border-brand-500/30',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-sm font-semibold capitalize text-white">
                  {scenario.label}
                </span>
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    isActive ? 'bg-brand-400' : 'bg-ink-600 group-hover:bg-brand-500/60',
                  )}
                />
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{scenario.summary}</p>
              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-line/70 pt-3 text-[11px]">
                <span className="text-slate-400/75">Automatización</span>
                <span className="text-right font-medium text-slate-300">
                  {pct(scenario.assumptions.automationPercentage)}
                </span>
                <span className="text-slate-400/75">Ventas recuperadas</span>
                <span className="text-right font-medium text-slate-300">
                  {num(scenario.assumptions.recoveredSales)} u.
                </span>
                <span className="text-slate-400/75">Minutos/consulta</span>
                <span className="text-right font-medium text-slate-300">
                  {num(scenario.assumptions.averageMinutesPerQuery, 1)}
                </span>
              </div>
              {isActive ? (
                <motion.span
                  layoutId="scenario-active-indicator"
                  aria-hidden
                  className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-brand-400"
                  transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 34 }}
                />
              ) : null}
            </motion.button>
          )
        })}
      </div>

      <div className="mt-5 rounded-xl border border-line bg-ink-900/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-slate-300">
            Supuestos del escenario{' '}
            <span className="capitalize text-brand-300">
              {scenarios.find((s) => s.key === active)?.label ?? 'personalizado'}
            </span>
          </p>
          <span className="text-[11px] text-slate-400/75">
            Automatización activa: {pct(automationPercentage)}
          </span>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(() => {
            const target = scenarios.find((s) => s.key === active) ?? scenarios[0]
            const disabled = active === 'custom'
            return (
              <>
                <NumberField
                  label="Automatización"
                  value={target.assumptions.automationPercentage}
                  onChange={(value) =>
                    onUpdate(target.key, {
                      automationPercentage: Math.min(100, Math.max(0, value)),
                    })
                  }
                  suffix="%"
                  max={100}
                  disabled={disabled}
                />
                <NumberField
                  label="Ventas recuperadas"
                  value={target.assumptions.recoveredSales}
                  {...bind(
                    'recoveredSales',
                    (value) => onUpdate(target.key, { recoveredSales: value }),
                    `${target.key}-recoveredSales`,
                  )}
                  suffix="u."
                  disabled={disabled}
                />
                <NumberField
                  label="Minutos por consulta"
                  value={target.assumptions.averageMinutesPerQuery}
                  {...bind(
                    'averageMinutesPerQuery',
                    (value) => onUpdate(target.key, { averageMinutesPerQuery: value }),
                    `${target.key}-averageMinutesPerQuery`,
                  )}
                  suffix="min"
                  step={0.5}
                  disabled={disabled}
                />
                <NumberField
                  label="Margen"
                  value={target.assumptions.contributionMargin}
                  onChange={(value) =>
                    onUpdate(target.key, {
                      contributionMargin: Math.min(100, Math.max(0, value)),
                    })
                  }
                  suffix="%"
                  max={100}
                  disabled={disabled}
                />
              </>
            )
          })()}
        </div>
        {active === 'custom' ? (
          <p className="mt-3 text-[11px] text-slate-400">
            Estás usando valores personalizados. Elegí un escenario para volver a sus supuestos.
          </p>
        ) : (
          <p className="mt-3 text-[11px] text-slate-400">
            Al editar un supuesto, el escenario activo pasa a modo personalizado para no mezclar
            valores de la plantilla con los tuyos.
          </p>
        )}
      </div>
    </div>
  )
}
