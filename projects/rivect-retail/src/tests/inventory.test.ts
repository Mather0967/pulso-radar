import { describe, expect, it } from 'vitest'
import { analyzeInventory, analyzeProduct, DEFAULT_THRESHOLDS, percentile } from '@/domain/calculations/inventory'
import type { Product } from '@/domain/models'

const now = new Date('2026-11-12T12:00:00.000Z')

const baseProduct: Product = {
  id: 'p1',
  sku: 'SKU-1',
  name: 'Producto test',
  category: 'Zapatillas',
  description: '',
  price: 100000,
  cost: 60000,
  stock: 10,
  minStock: 4,
  variants: [],
  monthlyUnitsSold: 30,
  image: 'test',
  tags: [],
  lastSaleAt: '2026-11-10',
}

describe('analyzeProduct', () => {
  it('calcula cobertura y capital inmovilizado', () => {
    const item = analyzeProduct(baseProduct, DEFAULT_THRESHOLDS, now)
    expect(item.dailySales).toBeCloseTo(1, 5)
    expect(item.coverageDays).toBeCloseTo(10, 5)
    expect(item.inventoryCapital).toBe(600000)
    expect(item.stockoutRisk).toBe(true)
  })

  it('devuelve cobertura null cuando no hay ventas', () => {
    const item = analyzeProduct(
      { ...baseProduct, monthlyUnitsSold: 0, stock: 8, lastSaleAt: '2026-08-01' },
      DEFAULT_THRESHOLDS,
      now,
    )
    expect(item.coverageDays).toBeNull()
    expect(item.lowRotation).toBe(true)
    expect(item.excessStock).toBe(true)
    expect(item.alerts.some((a) => a.kind === 'capital-inmovilizado')).toBe(true)
  })

  it('marca alerta de agotado cuando el stock es cero', () => {
    const item = analyzeProduct({ ...baseProduct, stock: 0 }, DEFAULT_THRESHOLDS, now)
    expect(item.alerts.some((a) => a.kind === 'agotado')).toBe(true)
    expect(item.stockoutRisk).toBe(false)
  })
})

describe('analyzeInventory', () => {
  it('agrega totales y agrupa capital por categoría', () => {
    const report = analyzeInventory(
      [
        baseProduct,
        { ...baseProduct, id: 'p2', category: 'Botines', stock: 5, monthlyUnitsSold: 5 },
      ],
      DEFAULT_THRESHOLDS,
      now,
    )
    expect(report.totals.stockUnits).toBe(15)
    expect(report.totals.inventoryCapital).toBe(900000)
    expect(report.totals.atRisk).toBe(1)
    expect(report.byCategory.map((c) => c.category).sort()).toEqual(['Botines', 'Zapatillas'])
    expect(report.alerts.length).toBeGreaterThan(0)
  })

  it('detecta alta demanda sobre el percentil 75 del catálogo', () => {
    const report = analyzeInventory(
      [
        { ...baseProduct, id: 'a', monthlyUnitsSold: 90, stock: 20 },
        { ...baseProduct, id: 'b', monthlyUnitsSold: 5, stock: 40 },
        { ...baseProduct, id: 'c', monthlyUnitsSold: 3, stock: 40 },
      ],
      DEFAULT_THRESHOLDS,
      now,
    )
    const top = report.items.find((i) => i.product.id === 'a')
    expect(top?.highDemand).toBe(true)
  })

  it('percentile devuelve 0 con lista vacía', () => {
    expect(percentile([], 75)).toBe(0)
    expect(percentile([1, 2, 3, 4], 75)).toBe(3)
  })
})
