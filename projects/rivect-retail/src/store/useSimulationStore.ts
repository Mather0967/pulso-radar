import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_THRESHOLDS } from '@/domain/calculations/inventory'
import { DEFAULT_CAMPAIGN_SETTINGS } from '@/domain/calculations/campaigns'
import { suggestedConversion, RECOVERY_STATUS_META } from '@/domain/calculations/recovery'
import type {
  AssistantMessage,
  AssistantReply,
  AssistantSession,
  Campaign,
  CampaignProjection,
  CampaignSettings,
  Conversation,
  Customer,
  InventoryThresholds,
  Product,
  RecoveryLead,
  RecoveryStatus,
  Scenario,
  ScenarioAssumptions,
  ScenarioKey,
  StoreProfile,
} from '@/domain/models'
import scenariosSeed from '@/data/scenarios.json'
import { retailRepository } from '@/repositories/mock/MockRetailRepository'
import type { AssistantContextState } from '@/services/assistant/engine'
import { buildWelcomeSession } from '@/services/assistant/session'
import { suggestionFor } from '@/services/recovery/recoveryService'
import { uid } from '@/utils/format'

const emptyProfile: StoreProfile = {
  id: 'store-demo',
  name: 'Tu tienda',
  businessType: 'Retail',
  dailyQueries: 0,
  averageMinutesPerQuery: 0,
  workingDays: 0,
  automationPercentage: 0,
  averageTicket: 0,
  contributionMargin: 0,
  recoveredSales: 0,
  monthlySales: 0,
  employeesInService: 0,
  totalProducts: 0,
  operatingHours: '',
  channels: [],
  unresolvedQueries: 0,
  customersWithoutFollowUp: 0,
  updatedAt: new Date().toISOString(),
}

const scenarios = scenariosSeed as unknown as Scenario[]

export interface SimulationState {
  seeded: boolean
  storeProfile: StoreProfile
  products: Product[]
  conversations: Conversation[]
  recoveryLeads: RecoveryLead[]
  campaigns: Campaign[]
  customers: Customer[]
  scenarios: Scenario[]
  scenario: ScenarioKey
  thresholds: InventoryThresholds
  campaignSettings: CampaignSettings
  assistant: AssistantSession
  assistantContext: AssistantContextState
  lastResetAt: string | null

  hydrate: () => Promise<void>
  resetSimulation: () => Promise<void>
  updateProfile: (patch: Partial<StoreProfile>) => void
  applyScenario: (key: ScenarioKey) => void
  updateScenario: (key: ScenarioKey, assumptions: Partial<ScenarioAssumptions>) => void
  setThresholds: (patch: Partial<InventoryThresholds>) => void
  setCampaignSettings: (patch: Partial<CampaignSettings>) => void
  sendAssistantMessage: (message: AssistantMessage) => void
  applyAssistantReply: (reply: AssistantReply & { nextContext?: AssistantContextState }) => void
  resetAssistant: () => void
  setLeadStatus: (leadId: string, status: RecoveryStatus) => void
  logFollowUp: (leadId: string, message: string) => void
  saveCampaign: (campaign: Campaign) => void
  deleteCampaign: (id: string) => void
  markCampaignSimulated: (id: string, result: CampaignProjection, recipients: number) => void
}

const ASSUMPTION_KEYS: (keyof ScenarioAssumptions)[] = [
  'automationPercentage',
  'recoveredSales',
  'averageMinutesPerQuery',
  'contributionMargin',
]

export const useSimulationStore = create<SimulationState>()(
  persist(
    (set, get) => ({
      seeded: false,
      storeProfile: emptyProfile,
      products: [],
      conversations: [],
      recoveryLeads: [],
      campaigns: [],
      customers: [],
      scenarios,
      scenario: 'equilibrado',
      thresholds: DEFAULT_THRESHOLDS,
      campaignSettings: DEFAULT_CAMPAIGN_SETTINGS,
      assistant: buildWelcomeSession(emptyProfile.name),
      assistantContext: { lastProductIds: [], lastCategory: null },
      lastResetAt: null,

      hydrate: async () => {
        if (get().seeded) return
        const [storeProfile, products, conversations, recoveryLeads, campaigns, customers] =
          await Promise.all([
            retailRepository.getStoreProfile(),
            retailRepository.getProducts(),
            retailRepository.getConversations(),
            retailRepository.getRecoveryLeads(),
            retailRepository.getCampaigns(),
            retailRepository.getCustomers(),
          ])
        set({
          seeded: true,
          storeProfile,
          products,
          conversations,
          recoveryLeads,
          campaigns,
          customers,
          assistant: buildWelcomeSession(storeProfile.name),
        })
      },

      resetSimulation: async () => {
        const [storeProfile, products, conversations, recoveryLeads, campaigns, customers] =
          await Promise.all([
            retailRepository.getStoreProfile(),
            retailRepository.getProducts(),
            retailRepository.getConversations(),
            retailRepository.getRecoveryLeads(),
            retailRepository.getCampaigns(),
            retailRepository.getCustomers(),
          ])
        set({
          seeded: true,
          storeProfile,
          products,
          conversations,
          recoveryLeads,
          campaigns,
          customers,
          scenario: 'equilibrado',
          thresholds: DEFAULT_THRESHOLDS,
          campaignSettings: DEFAULT_CAMPAIGN_SETTINGS,
          assistant: buildWelcomeSession(storeProfile.name),
          assistantContext: { lastProductIds: [], lastCategory: null },
          scenarios,
          lastResetAt: new Date().toISOString(),
        })
      },

      updateProfile: (patch) => {
        const current = get().storeProfile
        const touchesAssumptions = Object.keys(patch).some((key) =>
          ASSUMPTION_KEYS.includes(key as keyof ScenarioAssumptions),
        )
        set({
          storeProfile: { ...current, ...patch, updatedAt: new Date().toISOString() },
          scenario: touchesAssumptions ? 'custom' : get().scenario,
        })
      },

      applyScenario: (key) => {
        const scenario = get().scenarios.find((s) => s.key === key)
        if (!scenario) return
        set({
          scenario: key,
          storeProfile: {
            ...get().storeProfile,
            ...scenario.assumptions,
            updatedAt: new Date().toISOString(),
          },
        })
      },

      updateScenario: (key, assumptions) => {
        const scenariosUpdated = get().scenarios.map((scenario) =>
          scenario.key === key
            ? { ...scenario, assumptions: { ...scenario.assumptions, ...assumptions } }
            : scenario,
        )
        const active = get().scenario === key
        set({
          scenarios: scenariosUpdated,
          ...(active
            ? {
                storeProfile: {
                  ...get().storeProfile,
                  ...assumptions,
                  updatedAt: new Date().toISOString(),
                },
              }
            : {}),
        })
      },

      setThresholds: (patch) => set({ thresholds: { ...get().thresholds, ...patch } }),
      setCampaignSettings: (patch) =>
        set({ campaignSettings: { ...get().campaignSettings, ...patch } }),

      sendAssistantMessage: (message) => {
        const state = get()
        const isFirst = !state.assistant.messages.some((m) => m.role === 'customer')
        set({
          assistant: {
            ...state.assistant,
            messages: [...state.assistant.messages, message],
            metrics: {
              ...state.assistant.metrics,
              conversationsStarted:
                state.assistant.metrics.conversationsStarted + (isFirst ? 1 : 0),
            },
          },
        })
      },

      applyAssistantReply: (reply) => {
        const state = get()
        const assistantMessage: AssistantMessage = {
          id: uid('msg'),
          role: 'assistant',
          text: reply.text,
          at: new Date().toISOString(),
          products: reply.products,
          quickReplies: reply.quickReplies,
          meta: { intent: reply.intent, detected: reply.detected },
        }
        const known = new Set(
          state.assistant.messages.flatMap((m) => m.products?.map((p) => p.productId) ?? []),
        )
        const freshConsulted = reply.products.filter(
          (p) => !known.has(p.productId) && p.reason !== 'complemento',
        ).length
        const recommended = reply.products.filter((p) => p.reason !== 'consulta').length

        set({
          assistant: {
            messages: [...state.assistant.messages, assistantMessage],
            metrics: {
              ...state.assistant.metrics,
              queriesResolved: state.assistant.metrics.queriesResolved + 1,
              productsConsulted: state.assistant.metrics.productsConsulted + freshConsulted,
              productsRecommended: state.assistant.metrics.productsRecommended + recommended,
              reservations: state.assistant.metrics.reservations + (reply.reserved ? 1 : 0),
              purchaseOpportunities:
                state.assistant.metrics.purchaseOpportunities +
                (reply.intent === 'reserva' || reply.intent === 'precio' ? 1 : 0),
            },
          },
          assistantContext: reply.nextContext ?? state.assistantContext,
        })
      },

      resetAssistant: () =>
        set({
          assistant: buildWelcomeSession(get().storeProfile.name),
          assistantContext: { lastProductIds: [], lastCategory: null },
        }),

      setLeadStatus: (leadId, status) => {
        const today = new Date().toISOString().slice(0, 10)
        set({
          recoveryLeads: get().recoveryLeads.map((lead) =>
            lead.id === leadId
              ? {
                  ...lead,
                  status,
                  estimatedConversion: suggestedConversion(status),
                  lastContact: today,
                  suggestedAction: suggestionFor(status),
                  history: [
                    ...lead.history,
                    {
                      at: today,
                      kind: 'tienda' as const,
                      label: `Estado actualizado a ${RECOVERY_STATUS_META[status].label}.`,
                    },
                  ],
                }
              : lead,
          ),
        })
      },

      logFollowUp: (leadId, message) => {
        const today = new Date().toISOString().slice(0, 10)
        set({
          recoveryLeads: get().recoveryLeads.map((lead) => {
            if (lead.id !== leadId) return lead
            const advanced: RecoveryStatus =
              lead.status === 'consulta-nueva' || lead.status === 'interesado'
                ? 'seguimiento-pendiente'
                : lead.status
            return {
              ...lead,
              status: advanced,
              lastContact: today,
              history: [
                ...lead.history,
                {
                  at: today,
                  kind: 'tienda' as const,
                  label: `Mensaje simulado enviado: ${message.slice(0, 120)}`,
                },
              ],
            }
          }),
        })
      },

      saveCampaign: (campaign) =>
        set({
          campaigns: [campaign, ...get().campaigns.filter((c) => c.id !== campaign.id)],
        }),

      deleteCampaign: (id) =>
        set({ campaigns: get().campaigns.filter((campaign) => campaign.id !== id) }),

      markCampaignSimulated: (id, result, recipients) =>
        set({
          campaigns: get().campaigns.map((campaign) =>
            campaign.id === id
              ? { ...campaign, recipients, status: 'simulada', result }
              : campaign,
          ),
        }),
    }),
    {
      name: 'rivect-retail-intelligence-v1',
      version: 1,
      partialize: (state) => ({
        seeded: state.seeded,
        storeProfile: state.storeProfile,
        products: state.products,
        conversations: state.conversations,
        recoveryLeads: state.recoveryLeads,
        campaigns: state.campaigns,
        customers: state.customers,
        scenario: state.scenario,
        thresholds: state.thresholds,
        campaignSettings: state.campaignSettings,
        assistant: state.assistant,
        assistantContext: state.assistantContext,
        lastResetAt: state.lastResetAt,
      }),
    },
  ),
)
