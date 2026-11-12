import type {
  Campaign,
  Conversation,
  Customer,
  Product,
  RecoveryLead,
  StoreProfile,
} from '@/domain/models'
import { clone, type RetailRepository } from '@/repositories/interfaces/RetailRepository'
import campaignsSeed from '@/data/campaigns.json'
import conversationsSeed from '@/data/conversations.json'
import customersSeed from '@/data/customers.json'
import productsSeed from '@/data/products.json'
import recoveryLeadsSeed from '@/data/recovery-leads.json'
import storeProfileSeed from '@/data/store-profile.json'

const asProducts = productsSeed as unknown as Product[]
const asConversations = conversationsSeed as unknown as Conversation[]
const asLeads = recoveryLeadsSeed as unknown as RecoveryLead[]
const asCampaigns = campaignsSeed as unknown as Campaign[]
const asCustomers = customersSeed as unknown as Customer[]
const asProfile = storeProfileSeed as unknown as StoreProfile

/** Respuesta asíncrona artificial para ejercitar el contrato real de datos. */
const respond = async <T>(value: T): Promise<T> => clone(value)

export class MockRetailRepository implements RetailRepository {
  getStoreProfile(): Promise<StoreProfile> {
    return respond(asProfile)
  }
  getProducts(): Promise<Product[]> {
    return respond(asProducts)
  }
  getConversations(): Promise<Conversation[]> {
    return respond(asConversations)
  }
  getRecoveryLeads(): Promise<RecoveryLead[]> {
    return respond(asLeads)
  }
  getCampaigns(): Promise<Campaign[]> {
    return respond(asCampaigns)
  }
  getCustomers(): Promise<Customer[]> {
    return respond(asCustomers)
  }
}

export const retailRepository: RetailRepository = new MockRetailRepository()
