import { useEffect, useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { CalendarMe, Job, JobKind, JobStatus, Person, ProjectId } from '@/lib/types'
import {
  CONFLICT_MESSAGE,
  GONE_MESSAGE,
  KIND_LABEL,
  KIND_ORDER,
  NO_ASSIGNEE,
  NO_PROJECT_PERMISSION,
  PROJECT_LABEL,
  READONLY_JOB_MESSAGE,
  STATUS_LABEL,
  STATUS_ORDER,
} from './constants'
import {
  NOTES_MAX,
  TITLE_MAX,
  canDeleteJob,
  canEditJob,
  draftJob,
  payloadFromJob,
  validatePayload,
  writableProjects,
  type FormField,
  type JobPayload,
} from './jobs'
import { errorMessage, isStatus, serverJobFrom } from './useJobs'

/** Contador visible; se vuelve rojo al pasar el máximo (el guardado se bloquea con un error). */
function Counter({ testid, value, max }: { testid: string; value: number; max: number }) {
  const over = value > max
  return (
    <span
      data-testid={testid}
      aria-live="polite"
      className={cn(
        'self-end font-mono text-xs tabular-nums',
        over ? 'text-[hsl(var(--bloqueado,4_80%_66%))]' : 'text-muted-foreground',
      )}
    >
      {value}/{max}
    </span>
  )
}

type Props = {
  /** Trabajo a editar o ver. null = nuevo trabajo. */
  job: Job | null
  /** Día preseleccionado para un trabajo nuevo. */
  initialDate: Date
  me: CalendarMe | null
  people: Person[]
  onClose: () => void
  onCreate: (payload: JobPayload) => Promise<Job>
  onUpdate: (id: string, version: number, payload: JobPayload) => Promise<Job>
  onDelete: (id: string) => Promise<void>
  /** Llamado con la versión actual del servidor tras un 409. */
  onServerJob: (job: Job) => void
  /** Llamado si el trabajo ya no existe o no se puede ver (404). */
  onGone: () => void
}

const DELETE_CONFIRM_MS = 4000

export function JobDialog({ job, initialDate, me, people, onClose, onCreate, onUpdate, onDelete, onServerJob, onGone }: Props) {
  const [editing, setEditing] = useState<Job | null>(job)
  const readOnly = job ? !canEditJob(me, job) : false
  const [form, setForm] = useState<JobPayload>(() => (job ? payloadFromJob(job) : draftJob(initialDate, me)))
  const [error, setError] = useState<string | null>(() => (job && readOnly ? READONLY_JOB_MESSAGE : null))
  const [errorField, setErrorField] = useState<FormField | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [armed, setArmed] = useState(false)

  const titleRef = useRef<HTMLInputElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)
  const startRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLInputElement>(null)
  const projectRef = useRef<HTMLButtonElement>(null)
  const notesRef = useRef<HTMLTextAreaElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  const isNew = !job
  const projectOptions: ProjectId[] = readOnly && job ? [job.project] : writableProjects(me)
  const canDelete = !!editing && !readOnly && canDeleteJob(me, editing)
  const title = readOnly ? 'Ver trabajo' : isNew ? 'Nuevo trabajo' : 'Editar trabajo'

  // La confirmación de borrado vence sola a los 4 s.
  useEffect(() => {
    if (!armed) return
    const t = window.setTimeout(() => setArmed(false), DELETE_CONFIRM_MS)
    return () => window.clearTimeout(t)
  }, [armed])

  const refsByField: Record<FormField, { current: HTMLElement | null }> = {
    title: titleRef,
    date: dateRef,
    start: startRef,
    end: endRef,
    project: projectRef,
    notes: notesRef,
  }

  function fail(message: string, field: FormField | null = null) {
    setError(message)
    setErrorField(field)
    if (field) refsByField[field].current?.focus()
  }

  function set<K extends keyof JobPayload>(key: K, value: JobPayload[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    if (errorField === key) setErrorField(null)
  }

  function setAllDay(on: boolean) {
    setForm((f) => ({ ...f, allDay: on, start: on ? '' : f.start || '09:00', end: on ? '' : f.end }))
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (readOnly || saving) return
    if (!writableProjects(me).includes(form.project)) {
      fail(NO_PROJECT_PERMISSION, 'project')
      return
    }
    const problem = validatePayload(form)
    if (problem) {
      fail(problem[1], problem[0])
      return
    }
    setSaving(true)
    setError(null)
    setErrorField(null)
    try {
      if (editing) {
        await onUpdate(editing.id, editing.version, form)
        toast('Trabajo actualizado.')
      } else {
        await onCreate(form)
        toast('Trabajo creado.')
      }
      onClose()
    } catch (err) {
      const server = serverJobFrom(err)
      if (isStatus(err, 409) && server) {
        // Se conserva lo tipeado; el próximo guardar sobrescribe con la versión actual.
        setEditing(server)
        onServerJob(server)
        setError(CONFLICT_MESSAGE)
      } else if (isStatus(err, 404)) {
        toast.error(GONE_MESSAGE)
        onGone()
        onClose()
      } else {
        setError(errorMessage(err))
      }
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!editing || !canDelete || deleting) return
    if (!armed) {
      setArmed(true)
      return
    }
    setArmed(false)
    setDeleting(true)
    try {
      await onDelete(editing.id)
      toast('Trabajo eliminado.')
      onClose()
    } catch (err) {
      if (isStatus(err, 404)) {
        toast.error(GONE_MESSAGE)
        onGone()
        onClose()
      } else {
        fail(errorMessage(err))
      }
    } finally {
      setDeleting(false)
    }
  }

  const timesDisabled = readOnly || form.allDay
  const personIds = people.map((p) => p.id)
  const assigneeInactive = !!form.assignee && !personIds.includes(form.assignee)

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        data-testid="job-dialog"
        className="max-w-lg gap-0 p-0 sm:max-w-lg"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          ;(readOnly ? cancelRef.current : titleRef.current)?.focus()
        }}
      >
        <form data-testid="job-form" noValidate onSubmit={submit} className="flex min-h-0 flex-col">
          <DialogHeader className="space-y-1 px-6 pb-3 pr-12 pt-5">
            <DialogTitle className="text-lg font-semibold leading-7">{title}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {readOnly ? 'Solo lectura.' : 'Los campos marcados con * son obligatorios.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 px-6 pb-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="job-title" className="text-sm font-medium">
                Título *
              </Label>
              <Input
                id="job-title"
                ref={titleRef}
                name="title"
                type="text"
                autoComplete="off"
                value={form.title}
                disabled={readOnly}
                aria-invalid={errorField === 'title' || undefined}
                onChange={(e) => set('title', e.target.value)}
              />
              <Counter testid="title-count" value={form.title.length} max={TITLE_MAX} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="job-date" className="text-sm font-medium">
                  Fecha *
                </Label>
                <Input
                  id="job-date"
                  ref={dateRef}
                  name="date"
                  type="date"
                  className="[color-scheme:dark]"
                  value={form.date}
                  disabled={readOnly}
                  aria-invalid={errorField === 'date' || undefined}
                  onChange={(e) => set('date', e.target.value)}
                />
              </div>
              <div className="flex items-end gap-2 pb-2">
                <Checkbox
                  id="job-allday"
                  className="data-[state=checked]:border-foreground data-[state=checked]:text-foreground"
                  name="allDay"
                  checked={form.allDay}
                  disabled={readOnly}
                  onCheckedChange={(v) => setAllDay(v === true)}
                />
                <Label htmlFor="job-allday" className="text-sm font-medium">
                  Todo el día
                </Label>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="job-start" className="text-sm font-medium">
                  Inicio
                </Label>
                <Input
                  id="job-start"
                  ref={startRef}
                  name="start"
                  type="time"
                  className="[color-scheme:dark]"
                  value={form.start}
                  disabled={timesDisabled}
                  aria-invalid={errorField === 'start' || undefined}
                  onChange={(e) => set('start', e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="job-end" className="text-sm font-medium">
                  Fin
                </Label>
                <Input
                  id="job-end"
                  ref={endRef}
                  name="end"
                  type="time"
                  className="[color-scheme:dark]"
                  value={form.end}
                  disabled={timesDisabled}
                  aria-invalid={errorField === 'end' || undefined}
                  onChange={(e) => set('end', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="job-project" className="text-sm font-medium">
                  Proyecto *
                </Label>
                <Select
                  name="project"
                  value={form.project}
                  disabled={readOnly}
                  onValueChange={(v) => set('project', v as ProjectId)}
                >
                  <SelectTrigger
                    id="job-project"
                    ref={projectRef}
                    data-testid="job-project-trigger"
                    aria-invalid={errorField === 'project' || undefined}
                    className="h-10 w-full"
                  >
                    <SelectValue>{PROJECT_LABEL[form.project]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {projectOptions.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PROJECT_LABEL[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="job-kind" className="text-sm font-medium">
                  Tipo *
                </Label>
                <Select name="kind" value={form.kind} disabled={readOnly} onValueChange={(v) => set('kind', v as JobKind)}>
                  <SelectTrigger id="job-kind" className="h-10 w-full">
                    <SelectValue>{KIND_LABEL[form.kind]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {KIND_ORDER.map((k) => (
                      <SelectItem key={k} value={k}>
                        {KIND_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="job-assignee" className="text-sm font-medium">
                  Responsable
                </Label>
                <Select
                  name="assignee"
                  value={form.assignee || NO_ASSIGNEE}
                  disabled={readOnly}
                  onValueChange={(v) => set('assignee', v === NO_ASSIGNEE ? '' : v)}
                >
                  <SelectTrigger id="job-assignee" className="h-10 w-full">
                    <SelectValue>{form.assignee ? (people.find((p) => p.id === form.assignee)?.name ?? 'Usuario inactivo') : 'Sin responsable'}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_ASSIGNEE}>Sin responsable</SelectItem>
                    {people.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                    {assigneeInactive ? <SelectItem value={form.assignee}>Usuario inactivo</SelectItem> : null}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="job-status" className="text-sm font-medium">
                  Estado *
                </Label>
                <Select name="status" value={form.status} disabled={readOnly} onValueChange={(v) => set('status', v as JobStatus)}>
                  <SelectTrigger id="job-status" className="h-10 w-full">
                    <SelectValue>{STATUS_LABEL[form.status]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_ORDER.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="job-notes" className="text-sm font-medium">
                Notas
              </Label>
              <Textarea
                id="job-notes"
                ref={notesRef}
                name="notes"
                rows={4}
                value={form.notes}
                disabled={readOnly}
                aria-invalid={errorField === 'notes' || undefined}
                onChange={(e) => set('notes', e.target.value)}
              />
              <Counter testid="notes-count" value={form.notes.length} max={NOTES_MAX} />
            </div>
          </div>

          <DialogFooter className="sticky bottom-0 flex-col gap-3 border-t border-border bg-popover px-6 py-4 sm:flex-row sm:items-center sm:space-x-0">
            {error ? (
              <p
                role="alert"
                data-testid="job-error"
                className="text-sm leading-5 text-[hsl(var(--bloqueado,4_80%_66%))] sm:mr-auto sm:max-w-[60%]"
              >
                {error}
              </p>
            ) : null}
            <div className="flex w-full flex-col-reverse justify-end gap-2 sm:w-auto sm:flex-row sm:items-center">
              {canDelete ? (
                <Button
                  type="button"
                  variant="outline"
                  data-testid="job-delete"
                  disabled={deleting || saving}
                  onClick={remove}
                  className="text-[hsl(var(--bloqueado,4_80%_66%))] hover:text-[hsl(var(--bloqueado,4_80%_66%))]"
                >
                  {armed ? '¿Seguro? Tocá de nuevo' : 'Eliminar'}
                </Button>
              ) : null}
              <Button
                ref={cancelRef}
                type="button"
                variant="outline"
                data-testid="job-cancel"
                onClick={onClose}
                className="w-full sm:w-auto"
              >
                {readOnly ? 'Cerrar' : 'Cancelar'}
              </Button>
              {readOnly ? null : (
                <Button
                  type="submit"
                  variant="default"
                  data-testid="job-save"
                  disabled={saving || deleting}
                  className="w-full sm:w-auto"
                >
                  Guardar
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
