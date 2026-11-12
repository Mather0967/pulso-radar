import { useMemo, useState } from 'react'
import { Banknote, Filter, HeartHandshake, Search, Target, Users } from 'lucide-react'
import type { RecoveryLead, RecoveryStatus } from '@/domain/models'
import { RECOVERY_STATUSES, RECOVERY_STATUS_META } from '@/domain/calculations/recovery'
import { AnimatedContent } from '@/components/reactbits/AnimatedContent'
import { Badge } from '@/components/ui/Badge'
import { Panel, PanelHeader, SectionHeading } from '@/components/ui/Card'
import { StatTile, MetricRow } from '@/components/ui/Metric'
import { Funnel } from '@/components/charts/Funnel'
import { useSimulationStore } from '@/store/useSimulationStore'
import { buildFollowUpMessage, buildRecovery } from '@/services/recovery/recoveryService'
import { LeadTable } from './LeadTable'
import { LeadDrawer } from './LeadDrawer'
import { FollowUpModal } from './FollowUpModal'
import { money, num, pct } from '@/utils/format'

export function RecoveryPage() {
  const leads = useSimulationStore((s) => s.recoveryLeads)
  const products = useSimulationStore((s) => s.products)
  const profile = useSimulationStore((s) => s.storeProfile)
  const setLeadStatus = useSimulationStore((s) => s.setLeadStatus)
  const logFollowUp = useSimulationStore((s) => s.logFollowUp)

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'todos' | RecoveryStatus>('todos')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [followUpOpen, setFollowUpOpen] = useState(false)

  const metrics = useMemo(
    () => buildRecovery(leads, profile.contributionMargin),
    [leads, profile.contributionMargin],
  )

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return leads.filter((lead) => {
      const product = products.find((p) => p.id === lead.productId)
      const matchesStatus = status === 'todos' || lead.status === status
      const matchesQuery =
        normalized.length === 0 ||
        `${lead.customerName} ${product?.name ?? ''} ${lead.channel}`.toLowerCase().includes(normalized)
      return matchesStatus && matchesQuery
    })
  }, [leads, products, query, status])

  const selected = leads.find((lead) => lead.id === selectedId) ?? null
  const selectedProduct = products.find((p) => p.id === selected?.productId)
  const suggestedMessage = selected
    ? buildFollowUpMessage(selected, selectedProduct, profile)
    : ''

  const handleFollowUp = (message: string) => {
    if (!selected) return
    logFollowUp(selected.id, message)
  }

  return (
    <div className="space-y-5">
      <AnimatedContent>
        <SectionHeading
          eyebrow="Módulo 03 · Recuperación comercial"
          title="Customer Recovery"
          description="Un CRM simulado con las conversaciones que hoy quedan sin seguimiento. Cambiá estados, revisá el historial y simulá el mensaje de recuperación."
          action={<Badge tone="amber" dot>Probabilidades hipotéticas</Badge>}
        />
      </AnimatedContent>

      <AnimatedContent delay={0.05}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Clientes sin seguimiento"
            value={metrics.withoutFollowUp}
            icon={<Users className="h-4 w-4" />}
            tone="amber"
            hint={`${num(metrics.total)} oportunidades en el CRM`}
          />
          <StatTile
            label="Oportunidades pendientes"
            value={metrics.open}
            icon={<Target className="h-4 w-4" />}
            hint={`${money(metrics.pipelineValue)} en pipeline`}
          />
          <StatTile
            label="Ventas recuperadas (simulación)"
            value={metrics.recoveredRevenue}
            prefix="$ "
            icon={<Banknote className="h-4 w-4" />}
            tone="mint"
            hint={`${num(metrics.won)} compras concretadas`}
          />
          <StatTile
            label="Margen de contribución estimado"
            value={metrics.recoveredContribution}
            prefix="$ "
            icon={<HeartHandshake className="h-4 w-4" />}
            tone="brand"
            hint={`${pct(profile.contributionMargin)} de margen`}
          />
        </div>
      </AnimatedContent>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <AnimatedContent delay={0.1} className="min-w-0">
          <Panel className="overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
              <PanelHeader
                title="Oportunidades del CRM"
                subtitle={`${filtered.length} de ${leads.length} registros visibles`}
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar cliente o producto"
                    className="input h-9 py-0 pl-8 text-xs"
                    aria-label="Buscar oportunidades"
                  />
                </div>
                <div className="relative">
                  <Filter className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value as 'todos' | RecoveryStatus)}
                    className="input h-9 appearance-none py-0 pl-8 text-xs"
                    aria-label="Filtrar por estado"
                  >
                    <option value="todos">Todos los estados</option>
                    {RECOVERY_STATUSES.map((item) => (
                      <option key={item} value={item}>
                        {RECOVERY_STATUS_META[item].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <LeadTable leads={filtered} products={products} onOpen={(lead) => setSelectedId(lead.id)} />
          </Panel>
        </AnimatedContent>

        <AnimatedContent delay={0.15} className="min-w-0">
          <div className="space-y-4">
            <Panel className="panel-pad">
              <PanelHeader
                title="Embudo de recuperación"
                subtitle="Distribución real de las oportunidades simuladas."
              />
              <div className="mt-4">
                <Funnel
                  steps={metrics.funnel.map((step) => ({
                    label: step.label,
                    count: step.count,
                    value: step.value,
                  }))}
                />
              </div>
              <div className="mt-4 border-t border-line pt-3">
                <MetricRow label="Valor esperado del pipeline" value={money(metrics.expectedValue)} />
                <MetricRow
                  label="Tasa de conversión simulada"
                  value={pct(metrics.conversionRate, 1)}
                  hint={`${num(metrics.won)} compras de ${num(metrics.total)} oportunidades`}
                />
                <MetricRow label="Oportunidades perdidas" value={num(metrics.lost)} />
              </div>
            </Panel>

            <Panel className="panel-pad">
              <PanelHeader title="Qué significa recuperar" subtitle="Impacto de retomar una conversación." />
              <ul className="mt-3 space-y-2 text-[11px] leading-relaxed text-slate-500">
                <li>· Cada oportunidad tiene un ticket tomado del catálogo simulado.</li>
                <li>· La probabilidad es un supuesto editable, no un dato histórico.</li>
                <li>· Al marcar «Compra realizada», el margen recuperado se recalcula.</li>
                <li>· El seguimiento simulado queda registrado en el historial.</li>
              </ul>
              <div className="mt-3 rounded-lg border border-line bg-ink-900/60 p-2.5 text-[10px] text-slate-600">
                No se envían mensajes reales ni se accede a conversaciones de clientes.
              </div>
            </Panel>
          </div>
        </AnimatedContent>
      </div>

      <LeadDrawer
        lead={selected}
        product={selectedProduct}
        onClose={() => setSelectedId(null)}
        onStatusChange={(next) => {
          if (selected) setLeadStatus(selected.id, next)
        }}
        onFollowUp={() => setFollowUpOpen(true)}
      />

      <FollowUpModal
        lead={selected}
        message={suggestedMessage}
        open={followUpOpen}
        onClose={() => setFollowUpOpen(false)}
        onSend={handleFollowUp}
      />
    </div>
  )
}
