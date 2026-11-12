import { AlertCircle, Save, Send } from 'lucide-react'
import type { CampaignProjection, Product } from '@/domain/models'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Panel, PanelHeader } from '@/components/ui/Card'
import { MetricRow } from '@/components/ui/Metric'
import { ProductThumb } from '@/components/ui/ProductThumb'
import { money, num, pct } from '@/utils/format'

export function CampaignPreview({
  draftName,
  message,
  discountPct,
  products,
  projection,
  onSave,
  onSimulate,
}: {
  draftName: string
  message: string
  discountPct: number
  products: Product[]
  projection: CampaignProjection
  onSave: () => void
  onSimulate: () => void
}) {
  const rendered = message
    .replaceAll('{{nombre}}', 'Lucía')
    .replaceAll('{{descuento}}', String(discountPct))

  return (
    <div className="space-y-4">
      <Panel className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line bg-ink-900/70 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-mint-400" />
            <p className="text-[11px] font-medium text-slate-300">Vista previa · WhatsApp</p>
          </div>
          <Badge tone="amber">No se envía</Badge>
        </div>
        <div className="bg-[radial-gradient(circle_at_top,rgba(47,116,255,0.08),transparent_60%)] p-4">
          <div className="rounded-2xl rounded-tl-md border border-line bg-ink-800 p-3">
            <p className="whitespace-pre-line text-[12px] leading-relaxed text-slate-200">{rendered}</p>
            {products.length > 0 ? (
              <div className="mt-2 space-y-1 border-t border-line/70 pt-2">
                {products.slice(0, 3).map((product) => (
                  <div key={product.id} className="flex items-center gap-2">
                    <ProductThumb category={product.category} name={product.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10px] text-slate-300">{product.name}</p>
                      <p className="text-[9px] text-slate-500">
                        {money(product.price)} · -{discountPct}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <p className="mt-2 text-right text-[9px] text-slate-600">10:24 ✓✓</p>
          </div>
        </div>
      </Panel>

      <Panel className="panel-pad">
        <PanelHeader
          title="Rendimiento hipotético"
          subtitle={`${draftName || 'Campaña sin nombre'} · proyección del modelo`}
        />
        <div className="mt-3">
          <MetricRow label="Alcance" value={`${num(projection.recipients)} clientes`} />
          <MetricRow
            label="Interacciones estimadas"
            value={num(projection.interactions)}
            hint="Tasa de interacción configurada"
          />
          <MetricRow
            label="Ventas potenciales"
            value={`${num(projection.sales, 1)} u.`}
            hint={`Conversión ${pct(projection.conversion, 1)}`}
          />
          <MetricRow label="Facturación estimada" value={money(projection.revenue)} />
          <MetricRow
            label="Margen de contribución"
            value={money(projection.contribution)}
            hint={`Descuento aplicado: ${money(projection.discountCost)}`}
          />
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-xl border border-line bg-ink-900/60 p-2.5 text-[10px] leading-relaxed text-slate-500">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
          Resultados estimados a partir de supuestos, no de campañas reales. No se publica nada ni
          se envían mensajes.
        </div>

        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onSave}>
            <Save className="h-4 w-4" />
            Guardar
          </Button>
          <Button className="flex-1" onClick={onSimulate}>
            <Send className="h-4 w-4" />
            Simular
          </Button>
        </div>
      </Panel>
    </div>
  )
}
