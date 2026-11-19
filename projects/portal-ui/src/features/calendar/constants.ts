import type { JobKind, JobStatus, ProjectId } from '@/lib/types'

// Orden fijo de proyectos (selects, filtros y grupos).
export const PROJECT_ORDER: ProjectId[] = ['pulso', 'landur', 'studio', 'retail', 'general']

export const PROJECT_LABEL: Record<ProjectId, string> = {
  pulso: 'Pulso',
  landur: 'LANDUR',
  studio: 'Studio',
  retail: 'Retail',
  general: 'General',
}

export const KIND_ORDER: JobKind[] = ['contacto', 'entrevista', 'entrega', 'vencimiento', 'otro']

export const KIND_LABEL: Record<JobKind, string> = {
  contacto: 'Contacto',
  entrevista: 'Entrevista',
  entrega: 'Entrega',
  vencimiento: 'Vencimiento',
  otro: 'Otro',
}

export const STATUS_ORDER: JobStatus[] = ['pendiente', 'en_curso', 'hecho']

export const STATUS_LABEL: Record<JobStatus, string> = {
  pendiente: 'Pendiente',
  en_curso: 'En curso',
  hecho: 'Hecho',
}

// Punto de color por proyecto (mismas variables que Badge).
export const PROJECT_DOT: Record<ProjectId, string> = {
  pulso: 'bg-[hsl(var(--pulso,186_52%_56%))]',
  landur: 'bg-[hsl(var(--landur,255_80%_74%))]',
  studio: 'bg-[hsl(var(--studio,340_60%_68%))]',
  retail: 'bg-[hsl(var(--retail,43_80%_62%))]',
  general: 'bg-[hsl(var(--general,200_14%_62%))]',
}

export const NO_FILTER = 'all'
export const NO_ASSIGNEE = 'none'

export const GONE_MESSAGE = 'Ese trabajo ya no existe o no lo podés ver.'
export const OFFLINE_MESSAGE = 'Sin conexión… Revisá tu red e intentá de nuevo.'
export const CONFLICT_MESSAGE =
  'Otra persona modificó este trabajo. Revisá los cambios y volvé a guardar para sobrescribir, o cerrá para ver la versión actual.'
export const READONLY_JOB_MESSAGE = 'Solo lectura: no tenés permiso de edición en este proyecto.'
export const NO_PROJECT_PERMISSION = 'No tenés permiso de edición en ese proyecto.'
