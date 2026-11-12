import type { Product } from '@/domain/models'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ProductThumb } from '@/components/ui/ProductThumb'
import { money, num, pct } from '@/utils/format'
import { daysSince } from '@/domain/calculations/inventory'

export function ProductDetailModal({
  product,
  onClose,
}: {
  product: Product | null
  onClose: () => void
}) {
  return (
    <Modal
      open={Boolean(product)}
      onClose={onClose}
      title={product?.name ?? ''}
      description={product ? `${product.sku} · ${product.category}` : undefined}
      width="md"
    >
      {product ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-4">
            <ProductThumb category={product.category} name={product.name} size="lg" />
            <div>
              <p className="font-display text-2xl font-semibold text-white">{money(product.price)}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                Costo {money(product.cost)} · margen{' '}
                {pct(((product.price - product.cost) / product.price) * 100)}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone={product.stock === 0 ? 'coral' : product.stock <= product.minStock ? 'amber' : 'mint'}>
                  {product.stock === 0 ? 'Sin stock' : `${product.stock} unidades`}
                </Badge>
                <Badge tone="neutral">Mínimo {product.minStock}</Badge>
              </div>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-slate-400">{product.description}</p>

          <div>
            <p className="kpi-label mb-2">Variantes y disponibilidad</p>
            <div className="overflow-hidden rounded-xl border border-line">
              <table className="w-full text-left text-xs">
                <thead className="bg-ink-800/70 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Color</th>
                    <th className="px-3 py-2 font-medium">Talle</th>
                    <th className="px-3 py-2 text-right font-medium">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {product.variants.map((variant) => (
                    <tr key={variant.id} className="border-t border-line/70">
                      <td className="px-3 py-2 text-slate-300">{variant.name}</td>
                      <td className="px-3 py-2 text-slate-400">{variant.size}</td>
                      <td className="px-3 py-2 text-right">
                        <span
                          className={
                            variant.stock === 0
                              ? 'text-coral-400'
                              : variant.stock <= 2
                                ? 'text-amber-400'
                                : 'text-slate-200'
                          }
                        >
                          {variant.stock} u.
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-line bg-ink-900/60 p-3">
              <p className="text-slate-500">Ventas mensuales</p>
              <p className="mt-1 font-display text-base font-semibold text-white">
                {num(product.monthlyUnitsSold)} u.
              </p>
            </div>
            <div className="rounded-xl border border-line bg-ink-900/60 p-3">
              <p className="text-slate-500">Última venta</p>
              <p className="mt-1 font-display text-base font-semibold text-white">
                {daysSince(product.lastSaleAt)} días
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {product.tags.map((tag) => (
              <span key={tag} className="chip">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
