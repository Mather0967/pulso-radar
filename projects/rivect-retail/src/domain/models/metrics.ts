import type { CampaignProjection } from './commercial'
import type { InventoryReport } from './product'
import type { RecoveryStatus } from './commercial'
import type { ScenarioKey } from './store-profile'

export interface SimulatorMetrics {
  monthlyQueries: number
  automatedQueries: number
  manualHours: number
  recoverableHours: number
  additionalCapacity: number
  hoursPerEmployee: number
  additionalRevenue: number
  additionalContribution: number
  currentRevenue: number
  currentContribution: number
  projectedContribution: number
  upliftPct: number
  unattendedQueries: number
  minutesRecoveredPerDay: number
  fullWorkdaysRecovered: number
  scenario: ScenarioKey
}

export interface RecoveryMetrics {
  total: number
  open: number
  withoutFollowUp: number
  recovered: number
  won: number
  lost: number
  pipelineValue: number
  expectedValue: number
  recoveredRevenue: number
  recoveredContribution: number
  conversionRate: number
  funnel: { status: RecoveryStatus; label: string; count: number; value: number }[]
}

export interface ReportSection {
  id: string
  title: string
  summary: string
  metrics: { label: string; value: string; hint?: string }[]
  bullets: string[]
}

export interface ReportModel {
  generatedAt: string
  storeName: string
  businessType: string
  simulator: SimulatorMetrics
  inventory: InventoryReport
  recovery: RecoveryMetrics
  campaign: CampaignProjection | null
  sections: ReportSection[]
}
