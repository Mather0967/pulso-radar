import type {
  Campaign,
  Conversation,
  Customer,
  Product,
  RecoveryLead,
  StoreProfile,
} from '@/domain/models'

/**
 * Contrato de acceso a datos.
 * La implementación actual es MockRetailRepository (JSON + localStorage).
 * Una integración real (POS, ERP, WhatsApp Business) debe implementar esta
 * misma interfaz para no tocar la capa de presentación.
 */
export interface RetailRepository {
  getStoreProfile(): Promise<StoreProfile>
  getProducts(): Promise<Product[]>
  getConversations(): Promise<Conversation[]>
  getRecoveryLeads(): Promise<RecoveryLead[]>
  getCampaigns(): Promise<Campaign[]>
  getCustomers(): Promise<Customer[]>
}

export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
