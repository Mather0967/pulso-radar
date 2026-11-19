import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ApiError, api } from '@/lib/api'
import type { CalendarMe, Job, Person } from '@/lib/types'
import { GONE_MESSAGE, OFFLINE_MESSAGE } from './constants'
import { payloadFromJob, type JobPayload } from './jobs'

export type JobsRange = { from: string; to: string }
export type JobsStatus = 'loading' | 'ready' | 'error'

/** Mensaje para el usuario a partir de cualquier error de red o de la API. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 0) return OFFLINE_MESSAGE
  return err instanceof Error && err.message ? err.message : 'No se pudo completar la solicitud.'
}

/** Trabajo actual que el servidor devuelve junto con un 409. */
export function serverJobFrom(err: unknown): Job | null {
  if (!(err instanceof ApiError)) return null
  const job = err.data?.job
  return job && typeof job === 'object' ? (job as Job) : null
}

export function isStatus(err: unknown, status: number): boolean {
  return err instanceof ApiError && err.status === status
}

function replaceIn(list: Job[], job: Job): Job[] {
  const idx = list.findIndex((j) => j.id === job.id)
  if (idx < 0) return [...list, job]
  const next = list.slice()
  next[idx] = job
  return next
}

/**
 * Datos del calendario para un rango: carga, alta, edición, baja y mover (con optimismo).
 * Los errores de mutaciones se muestran con toast; los de alta/edición los maneja el diálogo.
 */
export function useJobs(range: JobsRange) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [me, setMe] = useState<CalendarMe | null>(null)
  const [people, setPeople] = useState<Person[]>([])
  const [status, setStatus] = useState<JobsStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  /** Rango ('desde|hasta') de la última carga correcta; sirve para saber si los datos están al día. */
  const [loadedKey, setLoadedKey] = useState('')
  const seq = useRef(0)
  const hasData = useRef(false)

  const load = useCallback(async () => {
    const id = ++seq.current
    try {
      const data = await api<{ jobs: Job[]; me: CalendarMe }>(
        `/api/calendar/jobs?from=${range.from}&to=${range.to}`,
      )
      if (id !== seq.current) return
      hasData.current = true
      setMe(data.me ?? null)
      setJobs(Array.isArray(data.jobs) ? data.jobs : [])
      setError(null)
      setStatus('ready')
      setLoadedKey(`${range.from}|${range.to}`)
    } catch (err) {
      if (id !== seq.current) return
      if (isStatus(err, 401)) return
      const message = errorMessage(err)
      if (hasData.current && !isStatus(err, 403)) {
        // Ya hay datos en pantalla: avisamos sin tapar el calendario.
        toast.error(message)
        return
      }
      setError(message)
      setStatus('error')
    }
  }, [range.from, range.to])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    let cancelled = false
    api<{ people: Person[] }>('/api/calendar/people')
      .then((data) => {
        if (!cancelled) setPeople(Array.isArray(data.people) ? data.people : [])
      })
      .catch((err: unknown) => {
        if (!cancelled && !isStatus(err, 401) && !isStatus(err, 403)) toast.error(errorMessage(err))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const upsertJob = useCallback((job: Job) => {
    setJobs((prev) => replaceIn(prev, job))
  }, [])

  const createJob = useCallback(
    async (payload: JobPayload): Promise<Job> => {
      const data = await api<{ job: Job }>('/api/calendar/jobs', { method: 'POST', body: payload })
      void load()
      return data.job
    },
    [load],
  )

  const updateJob = useCallback(
    async (id: string, version: number, payload: JobPayload): Promise<Job> => {
      const data = await api<{ job: Job }>(`/api/calendar/jobs/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: { ...payload, version },
      })
      upsertJob(data.job)
      void load()
      return data.job
    },
    [load, upsertJob],
  )

  const deleteJob = useCallback(
    async (id: string): Promise<void> => {
      await api<{ deleted: boolean }>(`/api/calendar/jobs/${encodeURIComponent(id)}`, { method: 'DELETE' })
      setJobs((prev) => prev.filter((j) => j.id !== id))
      void load()
    },
    [load],
  )

  /** Mueve un trabajo a otra fecha: cambia la vista al instante y revierte si el servidor rechaza. */
  const moveJob = useCallback(
    async (job: Job, date: string): Promise<boolean> => {
      if (job.date === date) return false
      setJobs((prev) => replaceIn(prev, { ...job, date }))
      try {
        const data = await api<{ job: Job }>(`/api/calendar/jobs/${encodeURIComponent(job.id)}`, {
          method: 'PUT',
          body: { ...payloadFromJob(job), date, version: job.version },
        })
        upsertJob(data.job)
        toast('Trabajo movido.')
        return true
      } catch (err) {
        if (isStatus(err, 404)) {
          setJobs((prev) => prev.filter((j) => j.id !== job.id))
          toast.error(GONE_MESSAGE)
          void load()
          return false
        }
        // 409: el servidor devuelve la versión actual; si no, volvemos a la fecha anterior.
        upsertJob(serverJobFrom(err) ?? job)
        toast.error(errorMessage(err))
        return false
      }
    },
    [load, upsertJob],
  )

  return {
    jobs,
    me,
    people,
    status,
    error,
    loadedKey,
    reload: load,
    upsertJob,
    createJob,
    updateJob,
    deleteJob,
    moveJob,
  }
}
