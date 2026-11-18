import { describe, expect, it } from 'vitest'
import { calculateSimulator, clampPct, clampProfileField, sanitizeProfile } from '@/domain/calculations/simulator'
import type { StoreProfile } from '@/domain/models'

const profile: StoreProfile = {
  id: 'test',
  name: 'Test',
  businessType: 'Calzado',
  dailyQueries: 65,
  averageMinutesPerQuery: 7,
  workingDays: 26,
  automationPercentage: 62,
  averageTicket: 48000,
  contributionMargin: 38,
  recoveredSales: 22,
  monthlySales: 12_400_000,
  employeesInService: 3,
  totalProducts: 30,
  operatingHours: '10-20',
  channels: ['WhatsApp'],
  unresolvedQueries: 32,
  customersWithoutFollowUp: 48,
  updatedAt: new Date().toISOString(),
}

describe('calculateSimulator', () => {
  it('calcula consultas, horas y capacidad con las fórmulas del brief', () => {
    const metrics = calculateSimulator(profile)
    expect(metrics.monthlyQueries).toBe(1690)
    expect(metrics.manualHours).toBeCloseTo(197.166, 2)
    expect(metrics.recoverableHours).toBeCloseTo(122.243, 2)
    expect(metrics.additionalCapacity).toBeCloseTo(1047.8, 1)
    expect(metrics.automatedQueries).toBeCloseTo(1047.8, 1)
  })

  it('calcula margen adicional solo desde ventas recuperadas', () => {
    const metrics = calculateSimulator(profile)
    expect(metrics.additionalRevenue).toBe(1_056_000)
    expect(metrics.additionalContribution).toBeCloseTo(401_280, 0)
    expect(metrics.currentContribution).toBeCloseTo(4_712_000, 0)
    expect(metrics.upliftPct).toBeCloseTo(8.516, 2)
  })

  it('no convierte horas ahorradas en ingresos', () => {
    const withoutRecovery = calculateSimulator({ ...profile, recoveredSales: 0 })
    expect(withoutRecovery.recoverableHours).toBeGreaterThan(0)
    expect(withoutRecovery.additionalRevenue).toBe(0)
    expect(withoutRecovery.additionalContribution).toBe(0)
    expect(withoutRecovery.upliftPct).toBe(0)
  })

  it('evita división por cero y valores negativos', () => {
    const metrics = calculateSimulator({
      ...profile,
      dailyQueries: 0,
      averageMinutesPerQuery: 0,
      workingDays: 0,
      monthlySales: 0,
      recoveredSales: -5,
    })
    expect(metrics.monthlyQueries).toBe(0)
    expect(metrics.manualHours).toBe(0)
    expect(metrics.additionalCapacity).toBe(0)
    expect(metrics.additionalRevenue).toBe(0)
    expect(metrics.upliftPct).toBe(0)
  })

  it('limita el porcentaje de automatización a 0-100', () => {
    expect(clampPct(150)).toBe(100)
    expect(clampPct(-20)).toBe(0)
    const metrics = calculateSimulator({ ...profile, automationPercentage: 150 })
    expect(metrics.recoverableHours).toBeCloseTo(metrics.manualHours, 5)
  })
})

describe('límites del simulador', () => {
  it('999.999.999 consultas diarias se ajustan a 5.000 con mensaje visible', () => {
    const result = clampProfileField('dailyQueries', 999_999_999)
    expect(result.value).toBe(5_000)
    expect(result.message).toMatch(/Máximo 5\.000 consultas por día/)
  })

  it('40 días se ajustan a 31 y lo dice', () => {
    const result = clampProfileField('workingDays', 40)
    expect(result.value).toBe(31)
    expect(result.message).toMatch(/31 días por mes/)
  })

  it('0 minutos por consulta y ticket 0 se ajustan al mínimo', () => {
    expect(clampProfileField('averageMinutesPerQuery', 0)).toMatchObject({ value: 0.5 })
    expect(clampProfileField('averageMinutesPerQuery', 0).message).toMatch(/Mínimo 0,5 minutos/)
    expect(clampProfileField('averageTicket', 0).value).toBe(1)
    expect(clampProfileField('averageTicket', 0).message).toMatch(/\$ 1/)
  })

  it('un valor dentro del rango no genera mensaje', () => {
    expect(clampProfileField('dailyQueries', 65)).toEqual({ value: 65 })
    expect(clampProfileField('averageMinutesPerQuery', 7)).toEqual({ value: 7 })
  })

  it('NaN o infinito vuelven al mínimo', () => {
    expect(clampProfileField('workingDays', Number.NaN).value).toBe(1)
    expect(clampProfileField('dailyQueries', Number.POSITIVE_INFINITY).value).toBe(0)
  })

  it('sanitizeProfile corrige un perfil guardado con datos absurdos', () => {
    const broken = {
      ...profile,
      dailyQueries: 999_999_999,
      workingDays: 0,
      averageMinutesPerQuery: 0,
      averageTicket: 0,
      automationPercentage: 250,
    }
    const fixed = sanitizeProfile(broken)
    expect(fixed.dailyQueries).toBe(5_000)
    expect(fixed.workingDays).toBe(1)
    expect(fixed.averageMinutesPerQuery).toBe(0.5)
    expect(fixed.averageTicket).toBe(1)
    expect(fixed.automationPercentage).toBe(100)
    // las horas quedan acotadas: nada de «1.880.666.664,8 h»
    const metrics = calculateSimulator({ ...fixed, workingDays: 31, averageMinutesPerQuery: 240 })
    expect(metrics.manualHours).toBeLessThanOrEqual(5_000 * 31 * 4)
  })

  it('sanitizeProfile no toca un perfil válido', () => {
    expect(sanitizeProfile(profile)).toEqual(profile)
  })
})
