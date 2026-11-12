import type { ScenarioKey, SimulatorMetrics, StoreProfile } from '../models'

/** Normaliza un porcentaje al rango 0-100 (valores inválidos → 0). */
export const clampPct = (value: number): number =>
  Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0))

/** Evita NaN / negativos en las entradas numéricas. */
export const safeNumber = (value: number): number =>
  Number.isFinite(value) && value > 0 ? value : 0

/**
 * Motor económico del Business Simulator.
 *
 * Fórmulas (brief §4):
 *   monthlyQueries      = dailyQueries × workingDays
 *   manualHours         = (monthlyQueries × averageMinutes) / 60
 *   recoverableHours    = manualHours × (automationPercentage / 100)
 *   additionalCapacity  = (recoverableHours × 60) / averageMinutes
 *   additionalRevenue   = recoveredSales × averageTicket
 *   additionalContribution = additionalRevenue × (contributionMargin / 100)
 *
 * Las horas ahorradas NO se convierten en ingresos: el margen adicional se
 * calcula con un escenario independiente de ventas recuperadas.
 */
export function calculateSimulator(
  profile: StoreProfile,
  scenario: ScenarioKey = 'equilibrado',
): SimulatorMetrics {
  const dailyQueries = safeNumber(profile.dailyQueries)
  const workingDays = safeNumber(profile.workingDays)
  const averageMinutes = safeNumber(profile.averageMinutesPerQuery)
  const automation = clampPct(profile.automationPercentage) / 100
  const margin = clampPct(profile.contributionMargin) / 100
  const ticket = safeNumber(profile.averageTicket)
  const recoveredSales = safeNumber(profile.recoveredSales)

  const monthlyQueries = dailyQueries * workingDays
  const manualHours = averageMinutes > 0 ? (monthlyQueries * averageMinutes) / 60 : 0
  const recoverableHours = manualHours * automation
  const additionalCapacity = averageMinutes > 0 ? (recoverableHours * 60) / averageMinutes : 0
  const automatedQueries = monthlyQueries * automation

  const additionalRevenue = recoveredSales * ticket
  const additionalContribution = additionalRevenue * margin

  const currentRevenue = safeNumber(profile.monthlySales)
  const currentContribution = currentRevenue * margin
  const projectedContribution = currentContribution + additionalContribution
  const upliftPct = currentContribution > 0 ? (additionalContribution / currentContribution) * 100 : 0

  const employees = safeNumber(profile.employeesInService)
  const unattendedQueries = monthlyQueries * (clampPct(profile.unresolvedQueries) / 100)

  return {
    monthlyQueries,
    automatedQueries,
    manualHours,
    recoverableHours,
    additionalCapacity,
    hoursPerEmployee: employees > 0 ? manualHours / employees : 0,
    additionalRevenue,
    additionalContribution,
    currentRevenue,
    currentContribution,
    projectedContribution,
    upliftPct,
    unattendedQueries,
    minutesRecoveredPerDay: workingDays > 0 ? (recoverableHours * 60) / workingDays : 0,
    fullWorkdaysRecovered: recoverableHours / 8,
    scenario,
  }
}

/** Serie para el gráfico comparativo operación actual vs. escenario automatizado. */
export function buildScenarioComparison(metrics: SimulatorMetrics) {
  const remainingHours = Math.max(0, metrics.manualHours - metrics.recoverableHours)
  return [
    {
      name: 'Hoy',
      consultas: Math.round(metrics.monthlyQueries),
      horas: Math.round(metrics.manualHours),
      margen: Math.round(metrics.currentContribution),
    },
    {
      name: 'Automatizado',
      consultas: Math.round(metrics.monthlyQueries),
      horas: Math.round(remainingHours),
      margen: Math.round(metrics.projectedContribution),
    },
  ]
}
