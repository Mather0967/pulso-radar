import {
  averagePrice,
  DEFAULT_CAMPAIGN_SETTINGS,
  projectCampaign,
  segmentCustomers,
} from '@/domain/calculations/campaigns'
import type {
  Campaign,
  CampaignProjection,
  CampaignSettings,
  Customer,
  CustomerSegmentKey,
  Product,
} from '@/domain/models'

export function customersForSegment(
  customers: Customer[],
  segment: CustomerSegmentKey,
  category: string,
): Customer[] {
  return segmentCustomers(customers, segment, category)
}

export function projectionForCampaign(
  campaign: Pick<Campaign, 'recipients' | 'discountPct' | 'productIds'>,
  products: Product[],
  contributionMargin: number,
  settings: CampaignSettings = DEFAULT_CAMPAIGN_SETTINGS,
  fallbackTicket = 48000,
): CampaignProjection {
  const prices = campaign.productIds
    .map((id) => products.find((p) => p.id === id)?.price)
    .filter((p): p is number => typeof p === 'number')
  const ticket = averagePrice(prices, fallbackTicket)
  return projectCampaign({
    recipients: campaign.recipients,
    discountPct: campaign.discountPct,
    avgTicket: ticket,
    contributionMargin,
    settings,
  })
}

/** Sugiere productos con exceso de stock o baja rotación para promocionar. */
export function suggestedCampaignProducts(products: Product[], limit = 6): Product[] {
  return [...products]
    .filter((p) => p.stock > 0)
    .sort((a, b) => {
      const aScore = a.stock / Math.max(1, a.monthlyUnitsSold)
      const bScore = b.stock / Math.max(1, b.monthlyUnitsSold)
      return bScore - aScore
    })
    .slice(0, limit)
}

export function buildCampaignDraft(input: {
  name: string
  segment: CustomerSegmentKey
  segmentLabel: string
  category: string
  productIds: string[]
  discountPct: number
  customers: number
}): Campaign {
  return {
    id: `cp-${Math.random().toString(36).slice(2, 8)}`,
    name: input.name,
    segment: input.segment,
    segmentLabel: input.segmentLabel,
    category: input.category,
    productIds: input.productIds,
    discountPct: input.discountPct,
    recipients: input.customers,
    status: 'borrador',
    createdAt: new Date().toISOString(),
    message: `¡Hola {{nombre}}! 👋 Tenemos novedades en ${input.category}. Con {{descuento}}% off esta semana, ¿te reservamos tu modelo?`,
  }
}
