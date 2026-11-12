import { describe, expect, it } from 'vitest'
import { calculateSimulator, clampPct } from '@/domain/calculations/simulator'
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
