import { describe, expect, it } from 'vitest'
import { calculateRecoveryMetrics, suggestedConversion } from '@/domain/calculations/recovery'
import type { RecoveryLead, RecoveryStatus } from '@/domain/models'

const lead = (id: string, status: RecoveryStatus, ticket: number, conversion: number): RecoveryLead => ({
  id,
  customerName: `Cliente ${id}`,
  productId: 'p01',
  channel: 'WhatsApp',
  status,
  estimatedTicket: ticket,
  estimatedConversion: conversion,
  lastContact: '2026-11-10',
  suggestedAction: '',
  history: [],
})

const leads: RecoveryLead[] = [
  lead('1', 'interesado', 90000, 50),
  lead('2', 'seguimiento-pendiente', 50000, 40),
  lead('3', 'compra-realizada', 100000, 100),
  lead('4', 'no-interesado', 30000, 0),
  lead('5', 'recuperado', 20000, 70),
]

describe('calculateRecoveryMetrics', () => {
  const metrics = calculateRecoveryMetrics(leads, 40)

  it('cuenta oportunidades abiertas y sin seguimiento', () => {
    expect(metrics.total).toBe(5)
    expect(metrics.open).toBe(3)
    expect(metrics.withoutFollowUp).toBe(1)
    expect(metrics.won).toBe(1)
    expect(metrics.recovered).toBe(1)
    expect(metrics.lost).toBe(1)
  })

  it('calcula pipeline y valor esperado ponderado', () => {
    expect(metrics.pipelineValue).toBe(160000)
    expect(metrics.expectedValue).toBeCloseTo(90000 * 0.5 + 50000 * 0.4 + 20000 * 0.7, 5)
  })

  it('calcula facturación y margen recuperado solo de compras concretadas', () => {
    expect(metrics.recoveredRevenue).toBe(100000)
    expect(metrics.recoveredContribution).toBe(40000)
    expect(metrics.conversionRate).toBeCloseTo(20, 5)
  })

  it('el embudo incluye los siete estados', () => {
    expect(metrics.funnel).toHaveLength(7)
    expect(metrics.funnel.reduce((acc, step) => acc + step.count, 0)).toBe(5)
  })
})

describe('suggestedConversion', () => {
  it('asigna 100% a compra realizada y 0% a no interesado', () => {
    expect(suggestedConversion('compra-realizada')).toBe(100)
    expect(suggestedConversion('no-interesado')).toBe(0)
  })
})
