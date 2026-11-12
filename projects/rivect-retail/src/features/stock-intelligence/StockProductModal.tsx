import type { InventoryItem } from '@/domain/models'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ProductThumb } from '@/components/ui/ProductThumb'
import { money, num, pct } from '@/utils/format'

const severityTone = { alta: 'coral', media: 'amber', baja: 'brand' } as const

export function StockProductModal({
  item,
  onClose,
}: {
  item: InventoryItem | null
  onClose: () => void
}) {
  return (
    <Modal
      open={Boolean(item)}
      onClose={onClose}
      title={item?.product.name ?? ''}
      description={item ? `${item.product.sku} · ${item.product.category}` : undefined}
      width="md"
    >
      {item ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-4">
            <ProductThumb category={item.product.category} name={item.product.name} size="lg" />
            <div className="grid flex-1 grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-slate-500">Precio</p>
                <p className="font-display text-sm font-semibold text-white">
                  {money(item.product.price)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Costo</p>
                <p className="font-display text-sm font-semibold text-white">
                  {money(item.product.cost)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Stock</p>
                <p className="font-display text-sm font-semibold text-white">
                  {num(item.product.stock)} u.
                </p>
              </div>
              <div>
                <p className="text-slate-500">Margen</p>
                <p className="font-display text-sm font-semibold text-white">
                  {pct(((item.product.price - item.product.cost) / item.product.price) * 100)}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Insight
              label="Ventas diarias estimadas"
              value={`${num(item.dailySales, 1)} u./día`}
              hint={`${num(item.product.monthlyUnitsSold)} u. por mes ÷ 30`}
            />
            <Insight
              label="Cobertura estimada"
              value={item.coverageDays === null ? 'Sin ventas registradas' : `${num(item.coverageDays, 1)} días`}
              hint="Stock ÷ ventas diarias"
            />
            <Insight
              label="Capital inmovilizado"
              value={money(item.inventoryCapital)}
              hint="Stock × costo unitario"
            />
            <Insight
              label="Desde la última venta"
              value={`${num(item.daysSinceLastSale)} días`}
              hint={`Última venta: ${item.product.lastSaleAt}`}
            />
          </div>

          <div>
            <p className="kpi-label mb-2">Por qué se generaron estas alertas</p>
            {item.alerts.length === 0 ? (
              <p className="rounded-xl border border-mint-500/25 bg-mint-500/[0.06] p-3 text-xs text-mint-300">
                Sin alertas: cobertura y rotación dentro de los parámetros configurados.
              </p>
            ) : (
              <ul className="space-y-2">
                {item.alerts.map((alert) => (
                  <li
                    key={`${alert.kind}-${alert.title}`}
                    className="rounded-xl border border-line bg-ink-900/60 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-slate-200">{alert.title}</p>
                      <Badge tone={severityTone[alert.severity]}>{alert.severity}</Badge>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{alert.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-brand-500/20 bg-brand-500/[0.06] p-3">
            <p className="text-[11px] font-medium text-brand-300">Acción sugerida</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              {item.stockoutRisk
                ? `Reponer aproximadamente ${num(item.suggestedUnits)} unidades para cubrir 30 días de demanda.`
                : item.lowRotation
                  ? 'Incluir en una campaña de rotación con descuento controlado o combinar con un producto de alta demanda.'
                  : item.excessStock
                    ? 'Revisar precio y visibilidad: la cobertura supera el umbral de exceso.'
                    : 'Mantener el ritmo de reposición actual.'}
            </p>
          </div>

          <div>
            <p className="kpi-label mb-2">Variantes</p>
            <div className="flex flex-wrap gap-1.5">
              {item.product.variants.map((variant) => (
                <span
                  key={variant.id}
                  className="rounded-lg border border-line bg-ink-900/60 px-2 py-1 text-[10px] text-slate-400"
                >
                  {variant.name} · {variant.size} ·{' '}
                  <span className={variant.stock === 0 ? 'text-coral-400' : 'text-slate-200'}>
                    {variant.stock} u.
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}

function Insight({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-line bg-ink-900/60 p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-600">{label}</p>
      <p className="mt-1 font-display text-sm font-semibold text-white">{value}</p>
      <p className="mt-0.5 text-[10px] text-slate-600">{hint}</p>
    </div>
  )
}
