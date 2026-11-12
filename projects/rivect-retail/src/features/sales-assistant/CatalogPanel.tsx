import { useMemo, useState } from 'react'
import { PackageSearch, Search } from 'lucide-react'
import type { Product } from '@/domain/models'
import { ProductThumb } from '@/components/ui/ProductThumb'
import { Badge } from '@/components/ui/Badge'
import { money } from '@/utils/format'
import { cn } from '@/utils/format'

export function CatalogPanel({
  products,
  highlighted,
  onSelect,
}: {
  products: Product[]
  highlighted: string[]
  onSelect: (product: Product) => void
}) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Todas')

  const categories = useMemo(
    () => ['Todas', ...Array.from(new Set(products.map((p) => p.category)))],
    [products],
  )

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return products.filter((product) => {
      const matchesCategory = category === 'Todas' || product.category === category
      const matchesQuery =
        normalized.length === 0 ||
        `${product.name} ${product.category} ${product.tags.join(' ')} ${product.sku}`
          .toLowerCase()
          .includes(normalized)
      return matchesCategory && matchesQuery
    })
  }, [products, query, category])

  return (
    <div className="panel flex h-[640px] flex-col overflow-hidden">
      <div className="border-b border-line p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-white">Catálogo en vivo</h2>
          <Badge tone="neutral">{products.length} productos</Badge>
        </div>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar modelo, SKU o etiqueta"
            className="input h-9 py-0 pl-8 text-xs"
            aria-label="Buscar en el catálogo"
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {categories.map((item) => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className={cn(
                'rounded-full px-2 py-1 text-[10px] font-medium transition',
                category === item
                  ? 'bg-brand-500/15 text-brand-200'
                  : 'text-slate-500 hover:text-slate-300',
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <PackageSearch className="h-6 w-6 text-slate-600" />
            <p className="text-xs text-slate-500">
              Sin resultados para «{query}». Probá con otra categoría o etiqueta.
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {filtered.map((product) => {
              const isHighlighted = highlighted.includes(product.id)
              return (
                <li key={product.id}>
                  <button
                    onClick={() => onSelect(product)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition',
                      isHighlighted
                        ? 'border border-brand-500/30 bg-brand-500/[0.08]'
                        : 'border border-transparent hover:bg-ink-800/70',
                    )}
                  >
                    <ProductThumb category={product.category} name={product.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium text-slate-200">{product.name}</p>
                      <p className="text-[10px] text-slate-500">
                        {money(product.price)} · {product.stock} u.
                      </p>
                    </div>
                    <span
                      className={cn(
                        'h-1.5 w-1.5 shrink-0 rounded-full',
                        product.stock === 0
                          ? 'bg-coral-400'
                          : product.stock <= product.minStock
                            ? 'bg-amber-400'
                            : 'bg-mint-400',
                      )}
                      title={
                        product.stock === 0
                          ? 'Sin stock'
                          : product.stock <= product.minStock
                            ? 'Stock bajo'
                            : 'Stock disponible'
                      }
                    />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-line p-3">
        <p className="text-[10px] leading-relaxed text-slate-600">
          Catálogo ficticio de demostración. El asistente consulta estos datos: precios, variantes y
          stock se actualizan con la simulación.
        </p>
      </div>
    </div>
  )
}
