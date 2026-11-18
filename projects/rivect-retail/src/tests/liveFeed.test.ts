import { describe, expect, it } from 'vitest'
import { liveEventAt, nextDelayMs, type LiveEventKind } from '@/presentation/liveFeed'

const ALL_KINDS: LiveEventKind[] = ['pedido', 'mensaje', 'stock', 'recuperado', 'campana']

describe('liveEventAt', () => {
  it('devuelve el mismo evento para el mismo índice', () => {
    for (let i = 0; i < 50; i++) {
      expect(liveEventAt(i)).toEqual(liveEventAt(i))
    }
  })

  it('las primeras 20 entradas incluyen los 5 tipos', () => {
    const kinds = new Set<LiveEventKind>()
    for (let i = 0; i < 20; i++) kinds.add(liveEventAt(i).kind)
    expect([...kinds].sort()).toEqual([...ALL_KINDS].sort())
  })

  it('el id es igual al índice', () => {
    for (let i = 0; i < 100; i++) {
      expect(liveEventAt(i).id).toBe(i)
    }
  })

  it('los montos de pedido y recuperado son enteros positivos', () => {
    for (let i = 0; i < 200; i++) {
      const event = liveEventAt(i)
      if (event.kind === 'pedido' || event.kind === 'recuperado') {
        expect(event.amount).toBeDefined()
        expect(Number.isInteger(event.amount)).toBe(true)
        expect(event.amount!).toBeGreaterThan(0)
      }
    }
  })

  it('tiene título y detalle no vacíos', () => {
    for (let i = 0; i < 100; i++) {
      const event = liveEventAt(i)
      expect(event.title.length).toBeGreaterThan(0)
      expect(event.detail.length).toBeGreaterThan(0)
    }
  })
})

describe('nextDelayMs', () => {
  it('está entre 4000 y 8000 ms para los índices 0..100', () => {
    for (let i = 0; i <= 100; i++) {
      const delay = nextDelayMs(i)
      expect(delay).toBeGreaterThanOrEqual(4000)
      expect(delay).toBeLessThanOrEqual(8000)
    }
  })

  it('es determinístico', () => {
    for (let i = 0; i <= 100; i++) {
      expect(nextDelayMs(i)).toBe(nextDelayMs(i))
    }
  })
})
