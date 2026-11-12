export interface ProductVariant {
  id: string
  /** Color de la variante. */
  name: string
  /** Talle / medida / modelo. */
  size: string
  stock: number
}

export interface Product {
  id: string
  sku: string
  name: string
  category: string
  description: string
  price: number
  cost: number
  stock: number
  minStock: number
  variants: ProductVariant[]
  monthlyUnitsSold: number
  /** Slug usado por el componente de imagen (tile de marca). */
  image: string
  tags: string[]
  /** Extensión: fecha de la última venta registrada (ISO) para rotación. */
  lastSaleAt: string
}

export type InventoryAlertKind =
  | 'agotado'
  | 'riesgo-agotamiento'
  | 'alta-demanda'
  | 'baja-rotacion'
  | 'capital-inmovilizado'
  | 'oportunidad-promocion'

export type Severity = 'alta' | 'media' | 'baja'

export interface InventoryAlert {
  kind: InventoryAlertKind
  severity: Severity
  title: string
  detail: string
}

export interface InventoryItem {
  product: Product
  dailySales: number
  /** Días de cobertura, null cuando no hay ventas registradas. */
  coverageDays: number | null
  inventoryCapital: number
  daysSinceLastSale: number
  highDemand: boolean
  lowRotation: boolean
  stockoutRisk: boolean
  excessStock: boolean
  suggestedUnits: number
  alerts: InventoryAlert[]
}

export interface InventoryThresholds {
  /** Días de cobertura por debajo de los cuales hay riesgo de agotamiento. */
  coverageThreshold: number
  /** Días de cobertura por encima de los cuales hay sobre-stock. */
  excessThreshold: number
  /** Días sin ventas para considerar capital inmovilizado. */
  deadStockDays: number
  /** Unidades mensuales mínimas para considerar rotación saludable. */
  lowRotationUnits: number
}

export interface InventoryReport {
  items: InventoryItem[]
  totals: {
    stockUnits: number
    inventoryCapital: number
    retailValue: number
    atRisk: number
    outOfStock: number
    lowRotation: number
    promoOpportunities: number
    averageCoverageDays: number
  }
  byCategory: {
    category: string
    capital: number
    units: number
    sold: number
    products: number
  }[]
  alerts: (InventoryAlert & { productId: string; productName: string; sku: string })[]
}
