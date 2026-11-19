import { describe, expect, it } from 'vitest'
import { NOTES_MAX, TITLE_MAX, validatePayload, type JobPayload } from './jobs'

const base: JobPayload = {
  title: 'Reunión',
  date: '2026-11-19',
  allDay: true,
  start: '',
  end: '',
  project: 'pulso',
  kind: 'otro',
  assignee: '',
  status: 'pendiente',
  notes: '',
}

describe('validatePayload limits', () => {
  it('accepts a title of exactly 120 characters', () => {
    expect(validatePayload({ ...base, title: 'a'.repeat(TITLE_MAX) })).toBeNull()
  })

  it('blocks a 180-character title with a clear message on the title field', () => {
    expect(validatePayload({ ...base, title: 'a'.repeat(180) })).toEqual([
      'title',
      'El título no puede superar los 120 caracteres.',
    ])
  })

  it('does not count surrounding spaces against the title', () => {
    expect(validatePayload({ ...base, title: `  ${'a'.repeat(TITLE_MAX)}  ` })).toBeNull()
  })

  it('blocks notes over 2000 characters', () => {
    expect(validatePayload({ ...base, notes: 'x'.repeat(NOTES_MAX + 1) })).toEqual([
      'notes',
      'Las notas no pueden superar los 2000 caracteres.',
    ])
  })
})
