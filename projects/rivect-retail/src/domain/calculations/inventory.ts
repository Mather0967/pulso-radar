import type {
  InventoryAlert,
  InventoryItem,
  InventoryReport,
  InventoryThresholds,
  Product,
  Severity,
} from '../models'

export const DEFAULT_THRESHOLDS: InventoryThresholds = {
  coverageThreshold: 15,
  excessThreshold: 90,
  deadStockDays: 45,
  lowRotationUnits: 3,
}

const DAY_MS = 86_400_000

export function daysSince(iso: string, now: Date = new Date()): number {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 0
  return Math.max(0, Math.floor((now.getTime() - then) / DAY_MS))
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[index]
}

/**
 * Analiza un producto individual.
 *
 *   dailySales        = monthlyUnitsSold / 30
 *   coverageDays      = stock / dailySales        (null si no hay ventas)
 *   inventoryCapital  = stock × cost
 *
 * Riesgo de agotamiento: cobertura ≤ umbral configurable.
 * Baja rotación: pocas unidades vendidas o muchos días sin venta.
 * Capital inmovilizado: stock con cobertura por encima del umbral de exceso
 * o sin ventas dentro de la ventana de stock muerto.
 */
export function analyzeProduct(
  product: Product,
  thresholds: InventoryThresholds = DEFAULT_THRESHOLDS,
  now: Date = new Date(),
): InventoryItem {
  const dailySales = product.monthlyUnitsSold / 30
  const coverageDays = dailySales > 0 ? product.stock / dailySales : null
  const inventoryCapital = product.stock * product.cost
  const daysSinceLastSale = daysSince(product.lastSaleAt, now)

  const highDemand = false // se recalcula en analyzeInventory con el p75 del catálogo
  const lowRotation =
    product.monthlyUnitsSold <= thresholds.lowRotationUnits ||
    daysSinceLastSale >= thresholds.deadStockDays
  const stockoutRisk =
    product.stock > 0 && coverageDays !== null && coverageDays <= thresholds.coverageThreshold
  const excessStock =
    product.stock > 0 &&
    (coverageDays === null || coverageDays > thresholds.excessThreshold)

  const alerts: InventoryAlert[] = []
  if (product.stock === 0) {
    alerts.push({
      kind: 'agotado',
      severity: 'alta',
      title: 'Sin stock',
      detail: 'El producto no tiene unidades disponibles para la venta.',
    })
  }
  if (stockoutRisk) {
    alerts.push({
      kind: 'riesgo-agotamiento',
      severity: coverageDays <= thresholds.coverageThreshold / 2 ? 'alta' : 'media',
      title: 'Riesgo de agotamiento',
      detail: `Cobertura estimada de ${coverageDays.toFixed(1)} días (umbral ${thresholds.coverageThreshold}).`,
    })
  }
  if (lowRotation && product.stock > 0) {
    alerts.push({
      kind: 'baja-rotacion',
      severity: 'media',
      title: 'Baja rotación',
      detail: `${product.monthlyUnitsSold} u. vendidas por mes · ${daysSinceLastSale} días desde la última venta.`,
    })
  }
  if (excessStock && product.stock > 0) {
    alerts.push({
      kind: 'capital-inmovilizado',
      severity: 'baja',
      title: 'Capital inmovilizado',
      detail: `Cobertura de ${coverageDays ? coverageDays.toFixed(0) : '∞'} días; conviene liquidar unidades.`,
    })
  }
  if (product.stock > 0 && (lowRotation || excessStock)) {
    alerts.push({
      kind: 'oportunidad-promocion',
      severity: 'baja',
      title: 'Oportunidad de promoción',
      detail: 'Producto candidato para una campaña de rotación con descuento controlado.',
    })
  }

  const suggestedUnits = Math.max(
    0,
    Math.ceil(dailySales * Math.max(thresholds.coverageThreshold * 2, 30) - product.stock),
  )

  return {
    product,
    dailySales,
    coverageDays,
    inventoryCapital,
    daysSinceLastSale,
    highDemand,
    lowRotation,
    stockoutRisk,
    excessStock,
    suggestedUnits,
    alerts,
  }
}

export function analyzeInventory(
  products: Product[],
  thresholds: InventoryThresholds = DEFAULT_THRESHOLDS,
  now: Date = new Date(),
): InventoryReport {
  const soldValues = products.map((p) => p.monthlyUnitsSold)
  const demandThreshold = percentile(soldValues, 75)

  const items = products.map((product) => {
    const item = analyzeProduct(product, thresholds, now)
    const highDemand =
      product.monthlyUnitsSold >= demandThreshold &&
      demandThreshold > 0 &&
      (item.coverageDays === null || item.coverageDays <= thresholds.excessThreshold)
    if (highDemand) {
      item.highDemand = true
      item.alerts.unshift({
        kind: 'alta-demanda',
        severity: 'alta',
        title: 'Alta demanda',
        detail: `${product.monthlyUnitsSold} u./mes con cobertura de ${
          item.coverageDays ? `${item.coverageDays.toFixed(1)} días` : 'sin referencia'
        }.`,
      })
    }
    return item
  })

  const stockUnits = products.reduce((acc, p) => acc + p.stock, 0)
  const inventoryCapital = items.reduce((acc, i) => acc + i.inventoryCapital, 0)
  const retailValue = products.reduce((acc, p) => acc + p.stock * p.price, 0)
  const coverages = items
    .map((i) => i.coverageDays)
    .filter((v): v is number => v !== null && Number.isFinite(v))

  const byCategoryMap = new Map<
    string,
    { category: string; capital: number; units: number; sold: number; products: number }
  >()
  for (const item of items) {
    const current = byCategoryMap.get(item.product.category) ?? {
      category: item.product.category,
      capital: 0,
      units: 0,
      sold: 0,
      products: 0,
    }
    current.capital += item.inventoryCapital
    current.units += item.product.stock
    current.sold += item.product.monthlyUnitsSold
    current.products += 1
    byCategoryMap.set(item.product.category, current)
  }

  const severityRank: Record<Severity, number> = { alta: 0, media: 1, baja: 2 }
  const alerts = items
    .flatMap((item) =>
      item.alerts.map((alert) => ({
        ...alert,
        productId: item.product.id,
        productName: item.product.name,
        sku: item.product.sku,
      })),
    )
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity])

  return {
    items,
    totals: {
      stockUnits,
      inventoryCapital,
      retailValue,
      atRisk: items.filter((i) => i.stockoutRisk).length,
      outOfStock: items.filter((i) => i.product.stock === 0).length,
      lowRotation: items.filter((i) => i.lowRotation).length,
      promoOpportunities: items.filter((i) =>
        i.alerts.some((a) => a.kind === 'oportunidad-promocion'),
      ).length,
      averageCoverageDays:
        coverages.length > 0 ? coverages.reduce((a, b) => a + b, 0) / coverages.length : 0,
    },
    byCategory: [...byCategoryMap.values()].sort((a, b) => b.capital - a.capital),
    alerts,
  }
}
