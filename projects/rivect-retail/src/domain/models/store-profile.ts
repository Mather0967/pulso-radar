/**
 * StoreProfile — datos de entrada del comercio.
 * Los campos marcados como "extensión" complementan el modelo base del brief
 * y alimentan el diagnóstico del informe sin alterar las fórmulas económicas.
 */
export type SalesChannel = 'WhatsApp' | 'Instagram' | 'Web' | 'Presencial'

export interface StoreProfile {
  id: string
  name: string
  businessType: string
  /** Consultas diarias recibidas (promedio). */
  dailyQueries: number
  /** Minutos promedio dedicados a resolver una consulta. */
  averageMinutesPerQuery: number
  /** Días de funcionamiento por mes. */
  workingDays: number
  /** Porcentaje estimado de consultas automatizables (0-100). */
  automationPercentage: number
  /** Ticket promedio en moneda local. */
  averageTicket: number
  /** Margen de contribución estimado sobre venta (0-100). */
  contributionMargin: number
  /** Ventas mensuales recuperadas por seguimiento (unidades). */
  recoveredSales: number
  // ---- extensiones ----
  monthlySales: number
  employeesInService: number
  totalProducts: number
  operatingHours: string
  channels: SalesChannel[]
  /** Porcentaje de consultas que no terminan en compra (0-100). */
  unresolvedQueries: number
  /** Clientes que no reciben seguimiento comercial. */
  customersWithoutFollowUp: number
  updatedAt: string
}

export interface StoreProfilePatch extends Partial<StoreProfile> {}

export type ScenarioKey = 'conservador' | 'equilibrado' | 'optimista' | 'custom'

export interface ScenarioAssumptions {
  automationPercentage: number
  recoveredSales: number
  averageMinutesPerQuery: number
  contributionMargin: number
}

export interface Scenario {
  key: ScenarioKey
  label: string
  summary: string
  assumptions: ScenarioAssumptions
  rationale: string[]
}
