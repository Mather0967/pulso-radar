import type { ScenarioKey, SimulatorMetrics, StoreProfile } from '../models'

/** Normaliza un porcentaje al rango 0-100 (valores inválidos → 0). */
export const clampPct = (value: number): number =>
  Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0))

/** Evita NaN / negativos en las entradas numéricas. */
export const safeNumber = (value: number): number =>
  Number.isFinite(value) && value > 0 ? value : 0

/**
 * Motor económico del Simulador de negocio.
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

/** Campos numéricos del perfil con límites razonables para un comercio minorista. */
export type LimitedProfileField =
  | 'dailyQueries'
  | 'averageMinutesPerQuery'
  | 'workingDays'
  | 'employeesInService'
  | 'averageTicket'
  | 'monthlySales'
  | 'recoveredSales'
  | 'customersWithoutFollowUp'
  | 'totalProducts'

export interface FieldLimit {
  min: number
  max: number
  /** Cómo se nombra el valor en el mensaje («consultas por día»). */
  unit: string
}

export const PROFILE_LIMITS: Record<LimitedProfileField, FieldLimit> = {
  dailyQueries: { min: 0, max: 5_000, unit: 'consultas por día' },
  averageMinutesPerQuery: { min: 0.5, max: 240, unit: 'minutos por consulta' },
  workingDays: { min: 1, max: 31, unit: 'días por mes' },
  employeesInService: { min: 0, max: 500, unit: 'personas' },
  averageTicket: { min: 1, max: 10_000_000, unit: 'de ticket promedio' },
  monthlySales: { min: 0, max: 10_000_000_000, unit: 'de ventas mensuales' },
  recoveredSales: { min: 0, max: 10_000, unit: 'ventas recuperadas' },
  customersWithoutFollowUp: { min: 0, max: 100_000, unit: 'clientes' },
  totalProducts: { min: 0, max: 100_000, unit: 'productos' },
}

const MONEY_FIELDS: LimitedProfileField[] = ['averageTicket', 'monthlySales']

const formatLimit = (field: LimitedProfileField, value: number): string => {
  const text = value.toLocaleString('es-AR', { maximumFractionDigits: 1 })
  return MONEY_FIELDS.includes(field) ? `$ ${text}` : text
}

/**
 * Ajusta un valor a su rango y devuelve un mensaje visible si hubo que corregirlo.
 * Así un dato absurdo (999.999.999 consultas, 0 minutos) no llega a los cálculos.
 */
export function clampProfileField(
  field: LimitedProfileField,
  raw: number,
): { value: number; message?: string } {
  const { min, max, unit } = PROFILE_LIMITS[field]
  if (!Number.isFinite(raw)) {
    return { value: min, message: `Valor inválido: se ajustó al mínimo (${formatLimit(field, min)} ${unit}).` }
  }
  if (raw > max) {
    return {
      value: max,
      message: `Máximo ${formatLimit(field, max)} ${unit}: se ajustó a ${formatLimit(field, max)}.`,
    }
  }
  if (raw < min) {
    return {
      value: min,
      message: `Mínimo ${formatLimit(field, min)} ${unit}: se ajustó a ${formatLimit(field, min)}.`,
    }
  }
  return { value: raw }
}

/** Corrige un perfil completo (por ejemplo, uno guardado en el navegador con datos fuera de rango). */
export function sanitizeProfile<T extends StoreProfile>(profile: T): T {
  const next = { ...profile }
  for (const field of Object.keys(PROFILE_LIMITS) as LimitedProfileField[]) {
    next[field] = clampProfileField(field, Number(profile[field])).value
  }
  next.automationPercentage = clampPct(profile.automationPercentage)
  next.contributionMargin = clampPct(profile.contributionMargin)
  next.unresolvedQueries = clampPct(profile.unresolvedQueries)
  return next
}
