import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import type { InventoryItem } from '@/domain/models'
import type { InventorySortKey } from '@/services/inventory/inventoryService'
import { ProductThumb } from '@/components/ui/ProductThumb'
import { money, num } from '@/utils/format'

const COLUMNS: { key: InventorySortKey | null; label: string; align?: string }[] = [
  { key: 'name', label: 'Producto' },
  { key: 'stock', label: 'Stock', align: 'text-right' },
  { key: 'sold', label: 'Vendidos/mes', align: 'text-right' },
  { key: 'coverage', label: 'Cobertura', align: 'text-right' },
  { key: 'capital', label: 'Capital', align: 'text-right' },
  { key: null, label: 'Estado', align: 'text-right' },
]

export function StockTable({
  items,
  sortKey,
  direction,
  onSort,
  onOpen,
}: {
  items: InventoryItem[]
  sortKey: InventorySortKey
  direction: 'asc' | 'desc'
  onSort: (key: InventorySortKey) => void
  onOpen: (item: InventoryItem) => void
}) {
  if (items.length === 0) {
    return (
      <div className="px-6 py-14 text-center">
        <p className="text-sm text-slate-300">No hay productos con estos filtros.</p>
        <p className="mt-1 text-xs text-slate-500">Probá otra categoría o desactivá el filtro de alertas.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-xs">
        <thead>
          <tr className="border-b border-line text-[10px] uppercase tracking-[0.12em] text-slate-600">
            {COLUMNS.map((column) => (
              <th key={column.label} className={`px-4 py-2.5 font-medium ${column.align ?? ''}`}>
                {column.key ? (
                  <button
                    onClick={() => onSort(column.key as InventorySortKey)}
                    className="inline-flex items-center gap-1 transition hover:text-slate-300"
                  >
                    {column.label}
                    {sortKey === column.key ? (
                      direction === 'asc' ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )
                    ) : (
                      <ChevronsUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </button>
                ) : (
                  column.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {items.map((item) => (
            <tr
              key={item.product.id}
              onClick={() => onOpen(item)}
              className="cursor-pointer transition hover:bg-ink-800/50"
            >
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <ProductThumb category={item.product.category} name={item.product.name} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium text-slate-200">
                      {item.product.name}
                    </p>
                    <p className="text-[10px] text-slate-600">
                      {item.product.sku} · {item.product.category}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-2.5 text-right">
                <span
                  className={
                    item.product.stock === 0
                      ? 'text-coral-400'
                      : item.product.stock <= item.product.minStock
                        ? 'text-amber-400'
                        : 'text-slate-200'
                  }
                >
                  {num(item.product.stock)}
                </span>
              </td>
              <td className="px-4 py-2.5 text-right text-slate-300">
                {num(item.product.monthlyUnitsSold)}
              </td>
              <td className="px-4 py-2.5 text-right text-slate-300">
                {item.coverageDays === null ? (
                  <span className="text-slate-600">sin ventas</span>
                ) : (
                  `${num(item.coverageDays, 0)} d`
                )}
              </td>
              <td className="px-4 py-2.5 text-right text-slate-300">{money(item.inventoryCapital)}</td>
              <td className="px-4 py-2.5 text-right">
                {item.alerts.length === 0 ? (
                  <span className="text-[10px] text-mint-400">saludable</span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-amber-300">
                    {item.alerts[0].title}
                    {item.alerts.length > 1 ? ` +${item.alerts.length - 1}` : ''}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
