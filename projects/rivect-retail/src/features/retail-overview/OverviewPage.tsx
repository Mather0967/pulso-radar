import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Banknote,
  Boxes,
  Clock,
  HeartHandshake,
  Info,
  MessagesSquare,
  Sparkles,
  Timer,
} from 'lucide-react'
import { Aurora } from '@/components/reactbits/Aurora'
import { AnimatedContent } from '@/components/reactbits/AnimatedContent'
import { ShinyText, GradientText } from '@/components/reactbits/ShinyText'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Panel, PanelHeader, SectionHeading } from '@/components/ui/Card'
import { StatTile, MetricRow } from '@/components/ui/Metric'
import { ModuleGrid, type ModuleStat } from './ModuleGrid'
import { CompareBars } from '@/components/charts/CompareBars'
import { useSimulationStore } from '@/store/useSimulationStore'
import { calculateSimulator } from '@/domain/calculations/simulator'
import { analyzeInventory } from '@/domain/calculations/inventory'
import { calculateRecoveryMetrics } from '@/domain/calculations/recovery'
import { money, num, pct } from '@/utils/format'

export function OverviewPage() {
  const profile = useSimulationStore((s) => s.storeProfile)
  const products = useSimulationStore((s) => s.products)
  const leads = useSimulationStore((s) => s.recoveryLeads)
  const assistant = useSimulationStore((s) => s.assistant)
  const scenario = useSimulationStore((s) => s.scenario)
  const thresholds = useSimulationStore((s) => s.thresholds)
  const campaignSettings = useSimulationStore((s) => s.campaignSettings)

  const simulator = useMemo(() => calculateSimulator(profile, scenario), [profile, scenario])
  const inventory = useMemo(() => analyzeInventory(products, thresholds), [products, thresholds])
  const recovery = useMemo(
    () => calculateRecoveryMetrics(leads, profile.contributionMargin),
    [leads, profile.contributionMargin],
  )

  const moduleStats: ModuleStat[] = [
    {
      to: '/simulator',
      stat: `${num(simulator.manualHours, 0)} h`,
      statLabel: 'atención / mes',
    },
    {
      to: '/assistant',
      stat: num(assistant.metrics.queriesResolved),
      statLabel: 'consultas resueltas',
    },
    {
      to: '/recovery',
      stat: num(recovery.withoutFollowUp),
      statLabel: 'sin seguimiento',
    },
    {
      to: '/stock',
      stat: money(inventory.totals.inventoryCapital),
      statLabel: 'capital en stock',
    },
    {
      to: '/campaigns',
      stat: `${num(campaignSettings.interactionRate)}%`,
      statLabel: 'interacción estimada',
    },
    {
      to: '/report',
      stat: money(simulator.additionalContribution),
      statLabel: 'margen potencial',
    },
  ]

  const comparison = [
    { name: 'Hoy', horas: simulator.manualHours },
    { name: 'Con Rivect', horas: Math.max(0, simulator.manualHours - simulator.recoverableHours) },
  ]

  return (
    <div className="space-y-6">
      <AnimatedContent>
        <section className="relative overflow-hidden rounded-3xl border border-line/90 bg-ink-900/50">
          <Aurora />
          <div className="absolute inset-0 grid-bg opacity-[0.35]" />
          <div className="relative z-10 flex flex-col gap-8 px-6 py-10 sm:px-10 sm:py-12 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand" dot>
                  Retail Intelligence
                </Badge>
                <span className="chip">
                  <Sparkles className="h-3 w-3 text-brand-300" />
                  Demo interactiva B2B
                </span>
              </div>
              <h1 className="mt-5 font-display text-3xl font-semibold leading-[1.1] tracking-tight text-white sm:text-[42px]">
                Recuperá el tiempo de tu tienda.
                <br />
                <GradientText>Capturá las ventas que hoy se pierden.</GradientText>
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-400">
                Este entorno calcula, con los datos de{' '}
                <span className="font-medium text-slate-200">{profile.name}</span>, cuánto tiempo
                consume la atención manual y qué oportunidades comerciales podrían automatizarse.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <Link to="/simulator">
                  <Button size="lg">
                    Abrir Business Simulator
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/report">
                  <Button variant="secondary" size="lg">
                    Ver informe de impacto
                  </Button>
                </Link>
              </div>
              <p className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-500">
                <Info className="h-3.5 w-3.5" />
                <span>
                  <ShinyText>Datos simulados</ShinyText> · no se conecta a WhatsApp ni a sistemas
                  reales
                </span>
              </p>
            </div>

            <div className="grid w-full max-w-sm grid-cols-2 gap-3">
              <div className="rounded-2xl border border-line/80 bg-ink-950/60 p-4 backdrop-blur">
                <p className="kpi-label">Escenario activo</p>
                <p className="mt-2 font-display text-lg font-semibold capitalize text-white">
                  {scenario === 'custom' ? 'Personalizado' : scenario}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {pct(profile.automationPercentage)} de automatización
                </p>
              </div>
              <div className="rounded-2xl border border-brand-500/25 bg-brand-500/10 p-4 backdrop-blur">
                <p className="kpi-label text-brand-200/80">Margen adicional</p>
                <p className="mt-2 font-display text-lg font-semibold text-white">
                  {money(simulator.additionalContribution)}
                </p>
                <p className="mt-1 text-[11px] text-brand-200/70">estimado por mes</p>
              </div>
              <div className="col-span-2 rounded-2xl border border-line/80 bg-ink-950/60 p-4 backdrop-blur">
                <div className="flex items-center justify-between">
                  <p className="kpi-label">Tiempo dedicado a consultas</p>
                  <Badge tone="amber">{num(simulator.recoverableHours, 0)} h recuperables</Badge>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ink-700">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-300"
                    style={{
                      width: `${simulator.manualHours > 0 ? (simulator.recoverableHours / simulator.manualHours) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  {num(simulator.manualHours, 1)} h mensuales · {num(profile.employeesInService)} personas
                </p>
              </div>
            </div>
          </div>
        </section>
      </AnimatedContent>

      <AnimatedContent delay={0.05}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Horas mensuales repetitivas"
            value={simulator.manualHours}
            decimals={1}
            suffix=" h"
            icon={<Clock className="h-4 w-4" />}
            hint={`${num(simulator.monthlyQueries)} consultas/mes`}
          />
          <StatTile
            label="Horas potencialmente recuperables"
            value={simulator.recoverableHours}
            decimals={1}
            suffix=" h"
            icon={<Timer className="h-4 w-4" />}
            tone="mint"
            hint={`${num(simulator.fullWorkdaysRecovered, 1)} jornadas equivalentes`}
          />
          <StatTile
            label="Margen adicional potencial"
            value={simulator.additionalContribution}
            prefix="$ "
            icon={<Banknote className="h-4 w-4" />}
            tone="amber"
            hint={`${num(profile.recoveredSales)} ventas recuperadas/mes`}
          />
          <StatTile
            label="Oportunidades abiertas"
            value={recovery.open}
            icon={<HeartHandshake className="h-4 w-4" />}
            tone="coral"
            hint={`${money(recovery.pipelineValue)} en pipeline`}
          />
        </div>
      </AnimatedContent>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <AnimatedContent delay={0.1} className="min-w-0">
          <Panel className="panel-pad h-full">
            <PanelHeader
              title="El impacto en una mirada"
              subtitle="Comparación entre la operación manual y el escenario con automatizaciones."
              icon={<Sparkles className="h-4 w-4" />}
              action={<Link to="/simulator"><Button variant="ghost" size="sm">Ajustar datos <ArrowRight className="h-3.5 w-3.5" /></Button></Link>}
            />
            <div className="mt-5">
              <CompareBars
                data={comparison}
                series={[{ key: 'horas', label: 'Horas de atención', color: '#5b95ff' }]}
                colors={['#5b95ff', '#4ade9f']}
                height={200}
                formatter={(value) => `${num(value, 0)} h`}
              />
            </div>
            <div className="mt-4 grid gap-x-6 sm:grid-cols-2">
              <MetricRow
                label="Capacidad adicional de atención"
                value={`${num(simulator.additionalCapacity)} consultas`}
                hint="Operaciones posibles, no ventas garantizadas"
              />
              <MetricRow
                label="Consultas automatizables"
                value={num(simulator.automatedQueries)}
                hint={`${pct(profile.automationPercentage)} del total`}
              />
              <MetricRow
                label="Facturación adicional estimada"
                value={money(simulator.additionalRevenue)}
                hint="Escenario independiente de ventas"
              />
              <MetricRow
                label="Mejora sobre el margen actual"
                value={pct(simulator.upliftPct, 1)}
                hint="Sobre margen de contribución"
              />
            </div>
          </Panel>
        </AnimatedContent>

        <AnimatedContent delay={0.15} className="min-w-0">
          <Panel className="panel-pad h-full">
            <PanelHeader
              title="Estado de los módulos"
              subtitle="Todo lo que sigue se calcula con los datos de esta sesión."
              icon={<Boxes className="h-4 w-4" />}
            />
            <div className="mt-4 space-y-3">
              <MetricRow
                label="Inventario analizado"
                value={`${num(products.length)} productos`}
                hint={`${money(inventory.totals.inventoryCapital)} inmovilizados`}
              />
              <MetricRow
                label="Riesgo de agotamiento"
                value={`${num(inventory.totals.atRisk)} productos`}
                hint={`Umbral de ${thresholds.coverageThreshold} días de cobertura`}
              />
              <MetricRow
                label="Asistente virtual"
                value={`${num(assistant.metrics.reservations)} reservas`}
                hint={`${num(assistant.metrics.conversationsStarted)} conversaciones iniciadas`}
              />
              <MetricRow
                label="Recuperación de clientes"
                value={`${num(recovery.won)} compras`}
                hint={`${money(recovery.recoveredRevenue)} recuperados`}
              />
            </div>
            <div className="mt-4 rounded-xl border border-line bg-ink-900/60 p-3 text-[11px] leading-relaxed text-slate-500">
              <span className="font-medium text-slate-300">Cómo leer los datos:</span> los valores
              ingresados por el visitante, el catálogo simulado y las estimaciones se muestran por
              separado. Ninguna cifra representa una promesa de resultado.
            </div>
            <Link to="/assistant" className="mt-4 block">
              <Button variant="secondary" className="w-full">
                <MessagesSquare className="h-4 w-4" />
                Probar el vendedor virtual
              </Button>
            </Link>
          </Panel>
        </AnimatedContent>
      </div>

      <AnimatedContent delay={0.2}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionHeading
            eyebrow="Recorrido de la demo"
            title="Los siete módulos"
            description="Cada sección alimenta el informe final con datos reales de esta simulación."
          />
        </div>
        <div className="mt-4">
          <ModuleGrid stats={moduleStats} />
        </div>
      </AnimatedContent>
    </div>
  )
}
