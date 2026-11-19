// Contrato de datos del portal (espejo de lo que devuelve el servidor). Claves en inglés.

export type ProjectId = 'pulso' | 'landur' | 'studio' | 'retail' | 'general'

export type User = {
  id: string
  name: string
  email: string
  role: 'admin' | 'member'
  /** Grants por proyecto: { pulso: 'editor', landur: 'viewer', ... }. */
  projects: Record<string, 'viewer' | 'editor'>
  active: boolean
}

export type Project = {
  id: string
  name: string
  eyebrow: string
  description: string
  url: string
  status: string
  group: 'operacion' | 'ventas'
  adminOnly?: boolean
  links?: { label: string; url: string }[]
}

export type JobKind = 'contacto' | 'entrevista' | 'entrega' | 'vencimiento' | 'otro'
export type JobStatus = 'pendiente' | 'en_curso' | 'hecho'

/** Modelo de trabajo del calendario (calendar-spec.md). */
export type Job = {
  id: string
  title: string
  /** 'YYYY-MM-DD' (fecha real). */
  date: string
  allDay: boolean
  /** 'HH:MM' o '' si es de día completo. */
  start: string
  /** 'HH:MM' o ''. */
  end: string
  project: ProjectId
  kind: JobKind
  /** '' o id de usuario activo. */
  assignee: string
  status: JobStatus
  notes: string
  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
  version: number
}

export type CalendarMe = {
  id: string
  write: boolean
  admin: boolean
  writeProjects: string[]
}

export type Person = {
  id: string
  name: string
}

export type Notices = {
  upcoming: Job[]
  unreadMessages: number
  generatedAt: string
}

export type SessionInfo = {
  id: string
  createdAt: number | null
  expiresAt: number
  browser: string | null
  current: boolean
}
