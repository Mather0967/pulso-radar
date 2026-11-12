import type {
  CampaignProjection,
  CampaignSettings,
  Customer,
  CustomerSegmentKey,
} from '../models'

export const DEFAULT_CAMPAIGN_SETTINGS: CampaignSettings = {
  interactionRate: 38,
  baseConversion: 11,
  conversionPerDiscountPoint: 0.55,
}

export const SEGMENTS: {
  key: CustomerSegmentKey
  label: string
  description: string
}[] = [
  {
    key: 'interesados-categoria',
    label: 'Interesados en una categoría',
    description: 'Clientes que consultaron o compraron productos de la categoría seleccionada.',
  },
  {
    key: 'compradores-recientes',
    label: 'Compradores recientes',
    description: 'Compraron en los últimos 30 días: buen momento para venta cruzada.',
  },
  {
    key: 'sin-compra',
    label: 'Consultaron sin comprar',
    description: 'Consultas que nunca se convirtieron: la oportunidad más directa.',
  },
  {
    key: 'recuperacion',
    label: 'Clientes inactivos',
    description: 'Sin actividad hace 45 días o más: campaña de reactivación.',
  },
  {
    key: 'alta-frecuencia',
    label: 'Alta frecuencia',
    description: 'Tres o más compras registradas: candidatos a programa de fidelidad.',
  },
]

/**
 * Segmentación determinística sobre el CRM simulado.
 * Cada regla es verificable sobre las propiedades del cliente.
 */
export function segmentCustomers(
  customers: Customer[],
  segment: CustomerSegmentKey,
  category?: string,
): Customer[] {
  switch (segment) {
    case 'interesados-categoria':
      return customers.filter((c) =>
        category ? c.interests.includes(category) : c.interests.length > 0,
      )
    case 'compradores-recientes':
      return customers.filter((c) => c.totalOrders > 0 && c.lastActivityDaysAgo <= 30)
    case 'sin-compra':
      return customers.filter((c) => c.totalOrders === 0)
    case 'recuperacion':
      return customers.filter((c) => c.lastActivityDaysAgo >= 45)
    case 'alta-frecuencia':
      return customers.filter((c) => c.totalOrders >= 3)
  }
}

/**
 * Proyección hipotética de campaña.
 *
 *   conversion  = baseConversion + discountPct × conversionPerDiscountPoint (tope 65%)
 *   interactions = recipients × interactionRate / 100
 *   sales        = interactions × conversion / 100
 *   revenue      = sales × avgTicket × (1 − discountPct / 100)
 *   contribution = revenue × margin / 100
 */
export function projectCampaign(input: {
  recipients: number
  discountPct: number
  avgTicket: number
  contributionMargin: number
  settings?: CampaignSettings
}): CampaignProjection {
  const settings = input.settings ?? DEFAULT_CAMPAIGN_SETTINGS
  const recipients = Math.max(0, Math.round(input.recipients))
  const discount = Math.min(90, Math.max(0, input.discountPct))
  const avgTicket = Math.max(0, input.avgTicket)
  const margin = Math.min(100, Math.max(0, input.contributionMargin)) / 100

  const conversion = Math.min(
    65,
    Math.max(0, settings.baseConversion + discount * settings.conversionPerDiscountPoint),
  )
  const interactions = recipients * (Math.min(100, Math.max(0, settings.interactionRate)) / 100)
  const sales = interactions * (conversion / 100)
  const grossRevenue = sales * avgTicket
  const discountCost = grossRevenue * (discount / 100)
  const revenue = grossRevenue - discountCost

  return {
    recipients,
    interactions: Math.round(interactions),
    sales: Math.round(sales * 10) / 10,
    revenue,
    contribution: revenue * margin,
    conversion,
    discountCost,
  }
}

/** Ticket promedio de los productos elegidos (o fallback del perfil). */
export function averagePrice(prices: number[], fallback: number): number {
  if (prices.length === 0) return fallback
  return prices.reduce((a, b) => a + b, 0) / prices.length
}
