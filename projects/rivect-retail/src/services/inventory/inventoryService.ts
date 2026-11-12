import { analyzeInventory, DEFAULT_THRESHOLDS } from '@/domain/calculations/inventory'
import type { InventoryItem, InventoryThresholds, Product } from '@/domain/models'

export function buildInventory(
  products: Product[],
  thresholds: InventoryThresholds = DEFAULT_THRESHOLDS,
) {
  return analyzeInventory(products, thresholds)
}

export type InventorySortKey = 'name' | 'stock' | 'coverage' | 'sold' | 'capital' | 'margin'

export function sortInventory(
  items: InventoryItem[],
  key: InventorySortKey,
  direction: 'asc' | 'desc',
): InventoryItem[] {
  const factor = direction === 'asc' ? 1 : -1
  const value = (item: InventoryItem): number | string => {
    switch (key) {
      case 'name':
        return item.product.name
      case 'stock':
        return item.product.stock
      case 'coverage':
        return item.coverageDays ?? Number.MAX_SAFE_INTEGER
      case 'sold':
        return item.product.monthlyUnitsSold
      case 'capital':
        return item.inventoryCapital
      case 'margin':
        return (item.product.price - item.product.cost) / item.product.price
    }
  }
  return [...items].sort((a, b) => {
    const av = value(a)
    const bv = value(b)
    if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * factor
    return (Number(av) - Number(bv)) * factor
  })
}
