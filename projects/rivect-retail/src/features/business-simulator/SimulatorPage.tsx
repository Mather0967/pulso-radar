import { useMemo } from 'react'
import { Info } from 'lucide-react'
import { AnimatedContent } from '@/components/reactbits/AnimatedContent'
import { SectionHeading } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useSimulationStore } from '@/store/useSimulationStore'
import { calculateSimulator } from '@/domain/calculations/simulator'
import { SimulatorForm } from './SimulatorForm'
import { ScenarioLab } from './ScenarioLab'
import { SimulatorResults } from './SimulatorResults'
import { num } from '@/utils/format'

export function SimulatorPage() {
  const profile = useSimulationStore((s) => s.storeProfile)
  const scenario = useSimulationStore((s) => s.scenario)
  const scenarios = useSimulationStore((s) => s.scenarios)
  const updateProfile = useSimulationStore((s) => s.updateProfile)
  const applyScenario = useSimulationStore((s) => s.applyScenario)
  const updateScenario = useSimulationStore((s) => s.updateScenario)

  const metrics = useMemo(() => calculateSimulator(profile, scenario), [profile, scenario])

  return (
    <div className="space-y-5">
      <AnimatedContent>
        <SectionHeading
          eyebrow="Módulo 01 · Núcleo económico"
          title="Business Simulator"
          description="Ingresá los datos del comercio y observá en tiempo real cuánto tiempo consume la atención manual y qué margen adicional podría generar la automatización."
          action={
            <div className="flex items-center gap-2">
              <Badge tone="amber" dot>
                Datos ingresados + estimaciones
              </Badge>
              <span className="hidden items-center gap-1.5 text-[11px] text-slate-500 sm:flex">
                <Info className="h-3.5 w-3.5" />
                {num(metrics.monthlyQueries)} consultas/mes
              </span>
            </div>
          }
        />
      </AnimatedContent>

      <AnimatedContent delay={0.05}>
        <ScenarioLab
          scenarios={scenarios}
          active={scenario}
          onApply={applyScenario}
          onUpdate={updateScenario}
          automationPercentage={profile.automationPercentage}
        />
      </AnimatedContent>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <AnimatedContent delay={0.1} className="min-w-0">
          <SimulatorForm profile={profile} onChange={updateProfile} />
        </AnimatedContent>
        <AnimatedContent delay={0.15} className="min-w-0">
          <SimulatorResults metrics={metrics} profile={profile} />
        </AnimatedContent>
      </div>
    </div>
  )
}
