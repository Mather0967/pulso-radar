import type { SalesChannel } from './store-profile'

export type ConversationStatus = 'abierta' | 'resuelta' | 'derivada'

export interface Conversation {
  id: string
  customerName: string
  channel: string
  intent: string
  productIds: string[]
  status: ConversationStatus
  estimatedValue: number
  createdAt: string
  lastInteraction: string
}

export type RecoveryStatus =
  | 'consulta-nueva'
  | 'interesado'
  | 'pendiente-respuesta'
  | 'seguimiento-pendiente'
  | 'recuperado'
  | 'compra-realizada'
  | 'no-interesado'

export interface LeadEvent {
  at: string
  label: string
  kind: 'sistema' | 'cliente' | 'tienda'
}

export interface RecoveryLead {
  id: string
  customerName: string
  productId: string
  channel: SalesChannel
  status: RecoveryStatus
  estimatedTicket: number
  /** Probabilidad hipotética de conversión (0-100). */
  estimatedConversion: number
  lastContact: string
  suggestedAction: string
  history: LeadEvent[]
}

export type CustomerSegmentKey =
  | 'interesados-categoria'
  | 'compradores-recientes'
  | 'sin-compra'
  | 'recuperacion'
  | 'alta-frecuencia'

export interface Customer {
  id: string
  name: string
  channel: SalesChannel
  interests: string[]
  purchasedProductIds: string[]
  totalOrders: number
  lastActivityDaysAgo: number
  lifetimeValue: number
}

export type CampaignStatus = 'borrador' | 'simulada' | 'archivada'

export interface CampaignSettings {
  /** Tasa de interacción sobre destinatarios (0-100). */
  interactionRate: number
  /** Conversión base de quienes interactúan (0-100). */
  baseConversion: number
  /** Incremento de conversión por punto de descuento (0-100). */
  conversionPerDiscountPoint: number
}

export interface Campaign {
  id: string
  name: string
  segment: CustomerSegmentKey
  segmentLabel: string
  category: string
  productIds: string[]
  message: string
  discountPct: number
  recipients: number
  status: CampaignStatus
  createdAt: string
  /** Resultado hipotético persistido al simular. */
  result?: {
    interactions: number
    sales: number
    revenue: number
    contribution: number
    conversion: number
  }
}

export interface CampaignProjection {
  recipients: number
  interactions: number
  sales: number
  revenue: number
  contribution: number
  conversion: number
  discountCost: number
}
