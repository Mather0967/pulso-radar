import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('une clases y descarta valores falsos', () => {
    expect(cn('a', false, undefined, 'b')).toBe('a b')
  })

  it('resuelve conflictos de Tailwind (gana el último)', () => {
    expect(cn('px-2 text-sm', 'px-4')).toBe('text-sm px-4')
  })

  it('acepta condicionales de objeto', () => {
    expect(cn('base', { active: true, hidden: false })).toBe('base active')
  })
})
