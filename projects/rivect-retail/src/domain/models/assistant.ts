import type { Product } from './product'

export type AssistantRole = 'customer' | 'assistant'

export interface AssistantProductRef {
  productId: string
  reason: 'consulta' | 'alternativa' | 'complemento' | 'recomendacion'
  variant?: string
}

export interface AssistantMessage {
  id: string
  role: AssistantRole
  text: string
  at: string
  products?: AssistantProductRef[]
  quickReplies?: string[]
  meta?: {
    intent: string
    detected?: string[]
    /** La conversación se derivó a una persona del equipo. */
    handoff?: boolean
  }
}

export interface AssistantMetrics {
  conversationsStarted: number
  queriesResolved: number
  productsConsulted: number
  productsRecommended: number
  reservations: number
  purchaseOpportunities: number
  /** Conversaciones derivadas a una persona (opcional para estados guardados antes). */
  handoffs?: number
}

export interface AssistantReply {
  text: string
  intent: string
  products: AssistantProductRef[]
  quickReplies: string[]
  detected: string[]
  resolved: boolean
  reserved?: boolean
  handoff?: boolean
  detectedProducts?: Product[]
}

export interface AssistantSession {
  messages: AssistantMessage[]
  metrics: AssistantMetrics
}
