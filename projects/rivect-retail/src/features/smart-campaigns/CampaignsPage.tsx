import { useMemo, useState } from 'react'
import { Megaphone, Pencil, Trash2, TrendingUp } from 'lucide-react'
import type { Campaign, CustomerSegmentKey, Product } from '@/domain/models'
import { SEGMENTS } from '@/domain/calculations/campaigns'
import { AnimatedContent } from '@/components/reactbits/AnimatedContent'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Panel, PanelHeader, SectionHeading } from '@/components/ui/Card'
import { StatTile } from '@/components/ui/Metric'
import { useSimulationStore } from '@/store/useSimulationStore'
import { customersForSegment, projectionForCampaign } from '@/services/campaigns/campaignService'
import { formatDate, money, num, uid } from '@/utils/format'
import { CampaignBuilder, type CampaignDraft } from './CampaignBuilder'
import { CampaignPreview } from './CampaignPreview'

const DEFAULT_MESSAGE =
  '¡Hola {{nombre}}! 👋 Llegó nueva reposición de lo que estabas buscando. Con {{descuento}}% off esta semana, ¿te lo reservamos?'

export function CampaignsPage() {
  const products = useSimulationStore((s) => s.products)
  const customers = useSimulationStore((s) => s.customers)
  const campaigns = useSimulationStore((s) => s.campaigns)
  const profile = useSimulationStore((s) => s.storeProfile)
  const settings = useSimulationStore((s) => s.campaignSettings)
  const setCampaignSettings = useSimulationStore((s) => s.setCampaignSettings)
  const saveCampaign = useSimulationStore((s) => s.saveCampaign)
  const deleteCampaign = useSimulationStore((s) => s.deleteCampaign)
  const markCampaignSimulated = useSimulationStore((s) => s.markCampaignSimulated)

  const categories = useMemo(
    () => ['Todas', ...Array.from(new Set(products.map((p) => p.category)))],
    [products],
  )
  const initialCategory = categories[1] ?? 'Todas'

  const [draft, setDraft] = useState<CampaignDraft>(() => ({
    name: 'Reposición de temporada',
    segment: 'interesados-categoria',
    category: initialCategory,
    productIds: products
      .filter((product) => product.category === initialCategory)
      .slice(0, 3)
      .map((product) => product.id),
    discountPct: 15,
    message: DEFAULT_MESSAGE,
  }))
  const [feedback, setFeedback] = useState<string | null>(null)

  const segmentCustomersList = useMemo(
    () =>
      customersForSegment(
        customers,
        draft.segment,
        draft.category === 'Todas' ? '' : draft.category,
      ),
    [customers, draft.segment, draft.category],
  )

  const recipients = segmentCustomersList.length
  const recipientsValue = segmentCustomersList.reduce((acc, c) => acc + c.lifetimeValue, 0)

  const selectedProducts = useMemo(
    () =>
      draft.productIds
        .map((id) => products.find((product) => product.id === id))
        .filter((product): product is Product => Boolean(product)),
    [draft.productIds, products],
  )

  const projection = useMemo(
    () =>
      projectionForCampaign(
        { recipients, discountPct: draft.discountPct, productIds: draft.productIds },
        products,
        profile.contributionMargin,
        settings,
        profile.averageTicket,
      ),
    [recipients, draft.discountPct, draft.productIds, products, profile, settings],
  )

  const updateDraft = (patch: Partial<CampaignDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
    setFeedback(null)
  }

  const persist = (): Campaign => {
    const campaign: Campaign = {
      id: uid('cp'),
      name: draft.name.trim() || 'Campaña sin nombre',
      segment: draft.segment,
      segmentLabel: SEGMENTS.find((s) => s.key === draft.segment)?.label ?? 'Segmento',
      category: draft.category,
      productIds: draft.productIds,
      message: draft.message,
      discountPct: draft.discountPct,
      recipients,
      status: 'borrador',
      createdAt: new Date().toISOString(),
    }
    saveCampaign(campaign)
    return campaign
  }

  const handleSave = () => {
    persist()
    setFeedback('Campaña guardada en la demo. Podés simularla cuando quieras.')
  }

  const handleSimulate = () => {
    const campaign = persist()
    markCampaignSimulated(campaign.id, projection, recipients)
    setFeedback(
      `Simulación registrada: ${money(projection.contribution)} de margen hipotético sobre ${num(
        projection.recipients,
      )} destinatarios.`,
    )
  }

  const loadCampaign = (campaign: Campaign) => {
    setDraft({
      name: campaign.name,
      segment: campaign.segment,
      category: campaign.category,
      productIds: campaign.productIds,
      discountPct: campaign.discountPct,
      message: campaign.message,
    })
    setFeedback(`Campaña «${campaign.name}» cargada en el simulador.`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-5">
      <AnimatedContent>
        <SectionHeading
          eyebrow="Módulo 05 · Marketing"
          title="Smart Campaigns"
          description="Detectá productos con exceso de stock, construí segmentos sobre el CRM simulado y proyectá el rendimiento de una campaña antes de invertir en ella."
          action={<Badge tone="amber" dot>Sin envíos reales</Badge>}
        />
      </AnimatedContent>

      <AnimatedContent delay={0.05}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Destinatarios del segmento"
            value={projection.recipients}
            suffix=" clientes"
            icon={<Megaphone className="h-4 w-4" />}
          />
          <StatTile
            label="Interacciones estimadas"
            value={projection.interactions}
            tone="brand"
            hint={`${num(settings.interactionRate)}% de interacción`}
          />
          <StatTile
            label="Facturación potencial"
            value={projection.revenue}
            prefix="$ "
            tone="mint"
            hint={`${num(projection.sales, 1)} ventas estimadas`}
          />
          <StatTile
            label="Margen de contribución"
            value={projection.contribution}
            prefix="$ "
            tone="amber"
            icon={<TrendingUp className="h-4 w-4" />}
            hint={`Descuento ${num(draft.discountPct)}%`}
          />
        </div>
      </AnimatedContent>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <AnimatedContent delay={0.1} className="min-w-0">
          <CampaignBuilder
            draft={draft}
            products={products}
            categories={categories}
            recipients={recipients}
            recipientsValue={recipientsValue}
            interactionRate={settings.interactionRate}
            baseConversion={settings.baseConversion}
            onChange={updateDraft}
            onSettingsChange={setCampaignSettings}
          />
        </AnimatedContent>

        <AnimatedContent delay={0.15} className="min-w-0">
          <div className="space-y-4">
            <CampaignPreview
              draftName={draft.name}
              message={draft.message}
              discountPct={draft.discountPct}
              products={selectedProducts}
              projection={projection}
              onSave={handleSave}
              onSimulate={handleSimulate}
            />
            {feedback ? (
              <div className="rounded-xl border border-mint-500/30 bg-mint-500/[0.07] p-3 text-[11px] leading-relaxed text-mint-300">
                {feedback}
              </div>
            ) : null}
          </div>
        </AnimatedContent>
      </div>

      <AnimatedContent delay={0.2}>
        <Panel className="overflow-hidden">
          <div className="border-b border-line p-4">
            <PanelHeader
              title="Campañas de la sesión"
              subtitle="Borradores y simulaciones guardadas en este navegador."
              action={<Badge tone="neutral">{campaigns.length} campañas</Badge>}
            />
          </div>
          {campaigns.length === 0 ? (
            <p className="px-4 py-10 text-center text-xs text-slate-500">
              Todavía no hay campañas. Configurá una y guardala para verla acá.
            </p>
          ) : (
            <ul className="divide-y divide-line/60">
              {campaigns.map((campaign) => (
                <li
                  key={campaign.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-slate-100">{campaign.name}</p>
                      <Badge tone={campaign.status === 'simulada' ? 'mint' : 'neutral'}>
                        {campaign.status}
                      </Badge>
                      <span className="text-[10px] text-slate-600">
                        {campaign.segmentLabel} · {formatDate(campaign.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-[11px] text-slate-500">{campaign.message}</p>
                    <p className="mt-1 text-[10px] text-slate-600">
                      {campaign.recipients} destinatarios · {num(campaign.discountPct)}% off ·{' '}
                      {campaign.productIds.length} productos
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider text-slate-600">
                        Margen estimado
                      </p>
                      <p className="font-display text-sm font-semibold text-white">
                        {money(
                          campaign.result?.contribution ??
                            projectionForCampaign(
                              campaign,
                              products,
                              profile.contributionMargin,
                              settings,
                              profile.averageTicket,
                            ).contribution,
                        )}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => loadCampaign(campaign)} title="Cargar">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteCampaign(campaign.id)}
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </AnimatedContent>
    </div>
  )
}
