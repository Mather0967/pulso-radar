// Lógica pura de trabajos: filtros, orden, permisos por proyecto y validación del formulario.
import type { CalendarMe, Job, JobKind, JobStatus, Person, ProjectId } from '@/lib/types'
import { parseIso, toIso } from './dates'
import { NO_ASSIGNEE, NO_FILTER, PROJECT_ORDER } from './constants'

/** Tipo MIME propio para arrastrar un trabajo entre celdas. */
export const JOB_DRAG_TYPE = 'application/x-rivect-job'

export type Filters = { project: string; assignee: string; status: string }

export const EMPTY_FILTERS: Filters = { project: NO_FILTER, assignee: NO_FILTER, status: NO_FILTER }

/** Campos editables de un trabajo (lo que viaja al servidor sin id, versión ni auditoría). */
export type JobPayload = {
  title: string
  date: string
  allDay: boolean
  start: string
  end: string
  project: ProjectId
  kind: JobKind
  assignee: string
  status: JobStatus
  notes: string
}

export function activeFilterCount(f: Filters): number {
  return [f.project, f.assignee, f.status].filter((v) => v !== NO_FILTER).length
}

export function filterJobs(jobs: Job[], f: Filters): Job[] {
  return jobs.filter(
    (j) =>
      (f.project === NO_FILTER || j.project === f.project) &&
      (f.assignee === NO_FILTER || j.assignee === f.assignee) &&
      (f.status === NO_FILTER || j.status === f.status),
  )
}

/** Día, luego «todo el día» primero, hora, título e id. */
export function compareJobs(a: Job, b: Job): number {
  return (
    a.date.localeCompare(b.date) ||
    Number(!a.allDay) - Number(!b.allDay) ||
    (a.start || '').localeCompare(b.start || '') ||
    (a.title || '').localeCompare(b.title || '', 'es') ||
    a.id.localeCompare(b.id)
  )
}

export function groupByDate(jobs: Job[]): Map<string, Job[]> {
  const map = new Map<string, Job[]>()
  for (const job of jobs) {
    const list = map.get(job.date)
    if (list) list.push(job)
    else map.set(job.date, [job])
  }
  return map
}

// ---------- permisos (calendar-spec: permisos por proyecto) ----------

/** Proyectos donde el usuario puede crear y editar, en el orden del selector. */
export function writableProjects(me: CalendarMe | null): ProjectId[] {
  const wp = me?.writeProjects ?? []
  return PROJECT_ORDER.filter((p) => wp.includes(p))
}

export function canCreate(me: CalendarMe | null): boolean {
  return writableProjects(me).length > 0
}

export function canEditJob(me: CalendarMe | null, job: Job): boolean {
  return !!me && (me.writeProjects ?? []).includes(job.project)
}

export function canDeleteJob(me: CalendarMe | null, job: Job): boolean {
  return !!me && (me.admin || (canEditJob(me, job) && job.createdBy === me.id))
}

// ---------- nombres ----------

export function personName(people: Person[], id: string): string {
  if (!id) return ''
  const p = people.find((x) => x.id === id)
  return p ? p.name : 'Usuario inactivo'
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('')
}

// ---------- formulario ----------

export function draftJob(date: Date, me: CalendarMe | null): JobPayload {
  return {
    title: '',
    date: toIso(date),
    allDay: true,
    start: '',
    end: '',
    project: writableProjects(me)[0] ?? 'general',
    kind: 'otro',
    assignee: '',
    status: 'pendiente',
    notes: '',
  }
}

export function payloadFromJob(job: Job): JobPayload {
  return {
    title: job.title,
    date: job.date,
    allDay: !!job.allDay,
    start: job.allDay ? '' : job.start || '',
    end: job.allDay ? '' : job.end || '',
    project: job.project,
    kind: job.kind,
    assignee: job.assignee || '',
    status: job.status,
    notes: job.notes || '',
  }
}

export type FormField = 'title' | 'date' | 'start' | 'end' | 'project' | 'notes'

/** Devuelve el primer error como [campo, mensaje], o null si el formulario es válido. */
export function validatePayload(p: JobPayload): [FormField, string] | null {
  if (!p.title) return ['title', 'Escribí un título.']
  if (p.title.length > 120) return ['title', 'El título no puede superar los 120 caracteres.']
  if (!parseIso(p.date)) return ['date', 'Elegí una fecha válida.']
  if (!p.allDay) {
    if (!/^\d{2}:\d{2}$/.test(p.start)) return ['start', 'Indicá la hora de inicio o marcá "Todo el día".']
    if (p.end && p.end < p.start) return ['end', 'La hora de fin no puede ser anterior al inicio.']
  }
  if (p.notes.length > 2000) return ['notes', 'Las notas no pueden superar los 2000 caracteres.']
  return null
}
