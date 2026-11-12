import { Megaphone, Users } from 'lucide-react'
import type { CustomerSegmentKey, Product } from '@/domain/models'
import { SEGMENTS } from '@/domain/calculations/campaigns'
import { NumberField, RangeField, SelectField, TextField } from '@/components/ui/Field'
import { Panel, PanelHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { money, num } from '@/utils/format'

export interface CampaignDraft {
  name: string
  segment: CustomerSegmentKey
  category: string
  productIds: string[]
  discountPct: number
  message: string
}

export function CampaignBuilder({
  draft,
  products,
  categories,
  recipients,
  recipientsValue,
  interactionRate,
  baseConversion,
  onChange,
  onSettingsChange,
}: {
  draft: CampaignDraft
  products: Product[]
  categories: string[]
  recipients: number
  recipientsValue: number
  interactionRate: number
  baseConversion: number
  onChange: (patch: Partial<CampaignDraft>) => void
  onSettingsChange: (patch: { interactionRate?: number; baseConversion?: number }) => void
}) {
  const visibleProducts = products.filter(
    (product) => draft.category === 'Todas' || product.category === draft.category,
  )

  const toggleProduct = (id: string) => {
    onChange({
      productIds: draft.productIds.includes(id)
        ? draft.productIds.filter((item) => item !== id)
        : [...draft.productIds, id],
    })
  }

  return (
    <div className="space-y-4">
      <Panel className="panel-pad">
        <PanelHeader
          title="Configurar campaña"
          subtitle="Segmento, productos, mensaje y descuento. Todo se calcula sobre el CRM simulado."
          icon={<Megaphone className="h-4 w-4" />}
          action={<Badge tone="neutral">{recipients} destinatarios</Badge>}
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <TextField
            label="Nombre de la campaña"
            value={draft.name}
            onChange={(value) => onChange({ name: value })}
            placeholder="Ej. Vuelta al running"
          />
          <SelectField
            label="Segmento"
            value={draft.segment}
            onChange={(value) => onChange({ segment: value as CustomerSegmentKey })}
            options={SEGMENTS.map((segment) => ({ value: segment.key, label: segment.label }))}
          />
          <SelectField
            label="Categoría de productos"
            value={draft.category}
            onChange={(value) => onChange({ category: value, productIds: [] })}
            options={categories.map((category) => ({ value: category, label: category }))}
          />
          <NumberField
            label="Descuento propuesto"
            value={draft.discountPct}
            onChange={(value) => onChange({ discountPct: Math.min(60, Math.max(0, value)) })}
            suffix="%"
            max={60}
            hint="A mayor descuento, mayor conversión estimada y menor margen."
          />
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
          {SEGMENTS.find((segment) => segment.key === draft.segment)?.description} ·{' '}
          {money(recipientsValue)} de valor histórico en el segmento.
        </p>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="field-label mb-0">Productos incluidos</p>
            <span className="text-[10px] text-slate-600">{draft.productIds.length} seleccionados</span>
          </div>
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-line bg-ink-900/50 p-2">
            {visibleProducts.map((product) => {
              const active = draft.productIds.includes(product.id)
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => toggleProduct(product.id)}
                  className={`rounded-full border px-2 py-1 text-[10px] transition ${
                    active
                      ? 'border-brand-500/50 bg-brand-500/15 text-brand-200'
                      : 'border-line text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {product.name} · {money(product.price)}
                </button>
              )
            })}
            {visibleProducts.length === 0 ? (
              <p className="p-2 text-[11px] text-slate-600">No hay productos en esta categoría.</p>
            ) : null}
          </div>
        </div>

        <label className="mt-4 block">
          <span className="field-label">Mensaje de la campaña</span>
          <textarea
            value={draft.message}
            onChange={(event) => onChange({ message: event.target.value })}
            rows={4}
            className="input resize-none text-[13px] leading-relaxed"
            placeholder="Usá {{nombre}} y {{descuento}} como variables."
          />
          <span className="mt-1 block text-[10px] text-slate-600">
            Variables disponibles: {'{{nombre}}'} y {'{{descuento}}'}.
          </span>
        </label>
      </Panel>

      <Panel className="panel-pad">
        <PanelHeader
          title="Supuestos de rendimiento"
          subtitle="Parámetros del modelo de proyección: afectan a todas las campañas."
          icon={<Users className="h-4 w-4" />}
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <RangeField
            label="Tasa de interacción"
            value={interactionRate}
            onChange={(value) => onSettingsChange({ interactionRate: value })}
            hint={`${num(recipients)} destinatarios → ${num((recipients * interactionRate) / 100)} interacciones estimadas.`}
          />
          <RangeField
            label="Conversión base"
            value={baseConversion}
            onChange={(value) => onSettingsChange({ baseConversion: value })}
            hint="Conversión de quienes interactúan, antes del descuento."
          />
        </div>
      </Panel>
    </div>
  )
}
