import { describe, expect, it } from 'vitest'
import { defaultNewDate, parseHash, parseRoute, toIso } from './dates'

describe('parseHash', () => {
  it('parses plain routes with no query', () => {
    const r = parseHash('#/mes/2026-11')
    expect(r.route?.view).toBe('month')
    expect(r.nuevo).toBe(false)
    expect(r.trabajo).toBeNull()
    expect(r.hasQuery).toBe(false)
    expect(r.path).toBe('#/mes/2026-11')
  })

  it('ignores the query part when reading the view route', () => {
    const month = parseHash('#/mes/2026-11?nuevo=1')
    expect(month.route?.view).toBe('month')
    expect(toIso(month.route!.cursor!)).toBe('2026-11-01')
    expect(month.nuevo).toBe(true)
    expect(month.path).toBe('#/mes/2026-11')

    const week = parseHash('#/semana/2026-11-16?nuevo=1')
    expect(week.route?.view).toBe('week')
    expect(toIso(week.route!.cursor!)).toBe('2026-11-16')

    const agenda = parseHash('#/agenda?nuevo=1')
    expect(agenda.route?.view).toBe('agenda')
    expect(agenda.nuevo).toBe(true)
  })

  it('reads trabajo ids and rejects malformed ones', () => {
    expect(parseHash('#/mes/2026-11?trabajo=abc-123').trabajo).toBe('abc-123')
    expect(parseHash('#/mes/2026-11?trabajo=').trabajo).toBeNull()
    expect(parseHash('#/mes/2026-11?trabajo=../x').trabajo).toBeNull()
    expect(parseHash('#/mes/2026-11?nuevo=0').nuevo).toBe(false)
  })

  it('keeps the query on invalid routes but still consumes it', () => {
    const r = parseHash('#/mes/2026-13?nuevo=1')
    expect(r.route).toBeNull()
    expect(r.nuevo).toBe(true)
    expect(r.path).toBe('#/mes/2026-13')
  })

  it('parseRoute still ignores queries', () => {
    expect(parseRoute('#/agenda?trabajo=x')?.view).toBe('agenda')
  })
})

describe('defaultNewDate', () => {
  it('uses today when it is inside the visible range', () => {
    const now = new Date(2026, 10, 19)
    expect(toIso(defaultNewDate({ from: '2026-10-26', to: '2026-12-06' }, now))).toBe('2026-11-19')
  })

  it('uses the first visible day when today is outside the range', () => {
    const now = new Date(2026, 10, 19)
    expect(toIso(defaultNewDate({ from: '2027-01-01', to: '2027-02-12' }, now))).toBe('2027-01-01')
  })
})
