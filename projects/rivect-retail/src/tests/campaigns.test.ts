import { describe, expect, it } from 'vitest'
import { projectCampaign, segmentCustomers, averagePrice } from '@/domain/calculations/campaigns'
import type { Customer } from '@/domain/models'

const customer = (overrides: Partial<Customer>): Customer => ({
  id: 'c',
  name: 'Cliente',
  channel: 'WhatsApp',
  interests: [],
  purchasedProductIds: [],
  totalOrders: 0,
  lastActivityDaysAgo: 0,
  lifetimeValue: 0,
  ...overrides,
})

describe('projectCampaign', () => {
  it('aplica conversión base + descuento y descuenta del ingreso', () => {
    const projection = projectCampaign({
      recipients: 100,
      discountPct: 10,
      avgTicket: 1000,
      contributionMargin: 40,
    })
    expect(projection.conversion).toBeCloseTo(16.5, 5)
    expect(projection.interactions).toBe(38)
    expect(projection.sales).toBeCloseTo(6.3, 1)
    expect(projection.revenue).toBeCloseTo(6.27 * 900, 1)
    expect(projection.contribution).toBeCloseTo(6.27 * 900 * 0.4, 1)
    expect(projection.discountCost).toBeCloseTo(6.27 * 100, 1)
  })

  it('aplica el descuento máximo permitido (90%) sobre la conversión base', () => {
    const projection = projectCampaign({
      recipients: 10,
      discountPct: 90,
      avgTicket: 1000,
      contributionMargin: 30,
    })
    expect(projection.conversion).toBeCloseTo(60.5, 5)
  })

  it('limita la conversión al 65% con supuestos agresivos', () => {
    const projection = projectCampaign({
      recipients: 10,
      discountPct: 30,
      avgTicket: 1000,
      contributionMargin: 30,
      settings: { interactionRate: 50, baseConversion: 60, conversionPerDiscountPoint: 1 },
    })
    expect(projection.conversion).toBe(65)
  })

  it('devuelve ceros con cero destinatarios', () => {
    const projection = projectCampaign({
      recipients: 0,
      discountPct: 20,
      avgTicket: 1000,
      contributionMargin: 30,
    })
    expect(projection.sales).toBe(0)
    expect(projection.revenue).toBe(0)
    expect(projection.contribution).toBe(0)
  })
})

describe('segmentCustomers', () => {
  const customers: Customer[] = [
    customer({ id: 'a', interests: ['Zapatillas'], totalOrders: 1, lastActivityDaysAgo: 5 }),
    customer({ id: 'b', interests: ['Botines'], totalOrders: 0, lastActivityDaysAgo: 60 }),
    customer({ id: 'c', interests: ['Zapatillas', 'Botines'], totalOrders: 4, lastActivityDaysAgo: 80 }),
  ]

  it('filtra por interés de categoría', () => {
    const result = segmentCustomers(customers, 'interesados-categoria', 'Zapatillas')
    expect(result.map((c) => c.id)).toEqual(['a', 'c'])
  })

  it('filtra consultas sin compra', () => {
    expect(segmentCustomers(customers, 'sin-compra').map((c) => c.id)).toEqual(['b'])
  })

  it('filtra clientes inactivos y alta frecuencia', () => {
    expect(segmentCustomers(customers, 'recuperacion').map((c) => c.id)).toEqual(['b', 'c'])
    expect(segmentCustomers(customers, 'alta-frecuencia').map((c) => c.id)).toEqual(['c'])
  })

  it('filtra compradores recientes', () => {
    expect(segmentCustomers(customers, 'compradores-recientes').map((c) => c.id)).toEqual(['a'])
  })
})

describe('averagePrice', () => {
  it('usa el fallback cuando no hay precios', () => {
    expect(averagePrice([], 48000)).toBe(48000)
    expect(averagePrice([100, 200], 48000)).toBe(150)
  })
})
