// Formato en español rioplatense (es-UY) y fechas en America/Montevideo.
// Las fechas de trabajo ('YYYY-MM-DD') son días civiles: se formatean sin pasar por la zona horaria.

const LOCALE = 'es-UY'
const TZ = 'America/Montevideo'
const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/
const MONTH_KEY = /^(\d{4})-(\d{2})$/

type Input = string | number | Date

function dateKeyToDate(key: string): Date | null {
  const m = DATE_KEY.exec(key)
  if (!m) return null
  // Mediodía UTC: el mismo día civil en cualquier zona entre UTC-12 y UTC+11.
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12))
}

function fmt(input: Input, options: Intl.DateTimeFormatOptions): string {
  if (typeof input === 'string') {
    const day = dateKeyToDate(input)
    if (day) return new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: 'UTC' }).format(day)
  }
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: TZ }).format(d)
}

/** "martes, 3 de noviembre de 2026". Acepta 'YYYY-MM-DD' o un ISO/Date. */
export function formatDate(input: Input): string {
  return fmt(input, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

/** "14:30". Si ya es 'HH:MM' se devuelve tal cual; si es ISO/Date se convierte a hora de Montevideo. */
export function formatTime(input: Input): string {
  if (typeof input === 'string' && /^\d{2}:\d{2}$/.test(input)) return input
  return fmt(input, { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** Fecha de hoy en Montevideo como 'YYYY-MM-DD'. */
export function todayMontevideo(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** Suma días a una fecha 'YYYY-MM-DD' (aritmética de calendario, sin zona horaria). */
export function addDays(dateKey: string, days: number): string {
  const d = dateKeyToDate(dateKey)
  if (!d) return dateKey
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** "noviembre de 2026" para 'YYYY-MM', 'YYYY-MM-DD' o Date. */
export function monthLabel(input: string | Date): string {
  const month = typeof input === 'string' ? MONTH_KEY.exec(input) : null
  if (month) {
    const d = new Date(Date.UTC(Number(month[1]), Number(month[2]) - 1, 15, 12))
    return new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d)
  }
  return fmt(input, { month: 'long', year: 'numeric' })
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
]

/** "hace 5 minutos", "ayer", "en 2 días". `iso` es un ISO o timestamp en ms. */
export function relativeFromNow(iso: string | number | Date, now: Date = new Date()): string {
  const target = iso instanceof Date ? iso : new Date(iso)
  const diffSec = Math.round((target.getTime() - now.getTime()) / 1000)
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' })
  for (const [unit, seconds] of UNITS) {
    if (Math.abs(diffSec) >= seconds || unit === 'second') {
      return rtf.format(Math.round(diffSec / seconds), unit)
    }
  }
  return rtf.format(0, 'second')
}
