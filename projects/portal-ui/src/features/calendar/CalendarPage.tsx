import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { Job } from '@/lib/types'
import { AgendaView } from './AgendaView'
import { JobDialog } from './JobDialog'
import { MonthView } from './MonthView'
import { Toolbar } from './Toolbar'
import { WeekView } from './WeekView'
import {
  addDays,
  formatTitle,
  defaultNewDate,
  parseHash,
  parseIso,
  rangeFor,
  routeFor,
  startOfDay,
  toIso,
  NARROW_QUERY,
  type CalView,
} from './dates'
import { canCreate as canCreateIn, canEditJob, compareJobs, filterJobs, EMPTY_FILTERS, personName, type Filters } from './jobs'
import { errorMessage, useJobs } from './useJobs'
import { api } from '@/lib/api'
import { toast } from 'sonner'

type DialogState = { job: Job | null; date: Date; key: number }

/** Pedido desde el hash (?nuevo=1, ?trabajo=<id>) o desde el evento portal:new-job. */
type Intent = {
  seq: number
  nuevo: boolean
  trabajo: string | null
  /** Mes del hash (para buscar un trabajo que no está en el rango visible). */
  monthFrom: string
  monthTo: string
}

export const NEW_JOB_EVENT = 'portal:new-job'

/** Pantallas angostas (< 700 px): agenda forzada y filtros en un Sheet. */
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(NARROW_QUERY).matches,
  )
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia(NARROW_QUERY)
    const update = () => setNarrow(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])
  return narrow
}

/** Esqueleto con las medidas finales; aparece solo si la carga tarda más de 150 ms. */
function useDelayedFlag(flag: boolean, ms: number): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (!flag) {
      setOn(false)
      return
    }
    const t = window.setTimeout(() => setOn(true), ms)
    return () => window.clearTimeout(t)
  }, [flag, ms])
  return on
}

function LoadingGrid({ view }: { view: CalView }) {
  if (view === 'agenda') {
    return (
      <div className="flex flex-col gap-2" aria-label="Cargando trabajos" role="status">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    )
  }
  if (view === 'week') {
    return (
      <div className="grid grid-cols-7 gap-1.5" aria-label="Cargando trabajos" role="status">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-[240px] w-full" />
        ))}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-7 gap-1.5" aria-label="Cargando trabajos" role="status">
      {Array.from({ length: 42 }, (_, i) => (
        <Skeleton key={i} className="h-[112px] w-full" />
      ))}
    </div>
  )
}

export default function CalendarPage() {
  const narrow = useNarrow()
  const [view, setView] = useState<CalView>('month')
  const [cursor, setCursor] = useState<Date>(() => startOfDay())
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [intent, setIntent] = useState<Intent | null>(null)
  const inFlight = useRef<number | null>(null)
  const [focusNonce, setFocusNonce] = useState(0)
  const focusId = useRef<string | null>(null)
  const dialogSeq = useRef(0)

  const effectiveView: CalView = narrow ? 'agenda' : view
  const range = useMemo(() => rangeFor(effectiveView, cursor), [effectiveView, cursor])
  const data = useJobs(range)
  const { jobs, me, people, status, error, loadedKey } = data
  const showLoading = useDelayedFlag(status === 'loading' && jobs.length === 0, 150)

  const canWrite = canCreateIn(me)
  const readOnly = status === 'ready' && !canWrite
  const todayKey = toIso(startOfDay())
  const visible = useMemo(() => filterJobs(jobs, filters).sort(compareJobs), [jobs, filters])
  const assigneeName = useCallback((id: string) => personName(people, id), [people])

  // Refs para leer el estado actual desde listeners que se registran una sola vez.
  const viewRef = useRef(view)
  const cursorRef = useRef(cursor)
  const narrowRef = useRef(narrow)
  viewRef.current = view
  cursorRef.current = cursor
  narrowRef.current = narrow

  /** Cambia vista y/o fecha y escribe el hash (#/mes, #/semana, #/agenda), salvo en pantallas angostas. */
  const go = useCallback((nextView: CalView, nextCursor: Date, replace = false) => {
    setView(nextView)
    setCursor(nextCursor)
    if (narrowRef.current) return
    const h = routeFor(nextView, nextCursor)
    if (window.location.hash === h) return
    if (replace) window.history.replaceState(null, '', h)
    else window.location.hash = h
  }, [])

  /**
   * Lee el hash: ruta de vista y consulta (nuevo=1, trabajo=<id>). La consulta se consume
   * y el hash queda sin ella, para que Atrás o recargar no reabran el diálogo.
   */
  const consumeHash = useCallback(() => {
    const parsed = parseHash(window.location.hash)
    if (parsed.route) {
      setView(parsed.route.view)
      if (parsed.route.cursor) setCursor(parsed.route.cursor)
    }
    if (parsed.nuevo || parsed.trabajo) {
      const m = rangeFor('month', parsed.route?.cursor ?? cursorRef.current)
      setIntent((prev) => ({
        seq: (prev?.seq ?? 0) + 1,
        nuevo: parsed.nuevo,
        trabajo: parsed.trabajo,
        monthFrom: m.from,
        monthTo: m.to,
      }))
    }
    if (parsed.hasQuery) window.history.replaceState(null, '', parsed.path)
    return parsed
  }, [])

  // Hash al cargar y al cambiar a mano (back/forward o pegar una URL).
  useEffect(() => {
    const parsed = consumeHash()
    const v = parsed.route?.view ?? viewRef.current
    const c = parsed.route?.cursor ?? cursorRef.current
    if (!narrowRef.current) window.history.replaceState(null, '', routeFor(v, c))

    const onHashChange = () => {
      consumeHash()
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [consumeHash])

  const navigate = useCallback(
    (dir: -1 | 1) => {
      if (effectiveView === 'agenda') return
      const next =
        effectiveView === 'month'
          ? new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1)
          : addDays(cursor, 7 * dir)
      go(effectiveView, next)
    },
    [cursor, effectiveView, go],
  )

  const goToday = useCallback(() => go(effectiveView, startOfDay()), [effectiveView, go])

  const changeView = useCallback(
    (next: CalView) => {
      if (narrow && next !== 'agenda') return
      if (next === effectiveView) return
      go(next, cursor)
    },
    [cursor, effectiveView, go, narrow],
  )

  const goToWeek = useCallback((date: Date) => go('week', date), [go])

  const openNew = useCallback((date: Date) => {
    if (!canWrite) return
    dialogSeq.current += 1
    setDialog({ job: null, date, key: dialogSeq.current })
  }, [canWrite])

  const openJob = useCallback((job: Job) => {
    dialogSeq.current += 1
    setDialog({ job, date: startOfDay(), key: dialogSeq.current })
  }, [])

  // ?nuevo=1: abre «Nuevo trabajo» cuando ya se conoce el permiso de escritura.
  useEffect(() => {
    if (!intent?.nuevo || !me) return
    if (canWrite) openNew(defaultNewDate({ from: range.from, to: range.to }))
    setIntent((prev) => (prev && prev.seq === intent.seq ? { ...prev, nuevo: false } : prev))
  }, [intent, me, canWrite, openNew, range.from, range.to])

  // ?trabajo=<id>: espera a que carguen los datos del rango; si no está, busca el mes del hash.
  useEffect(() => {
    if (!intent?.trabajo) return
    const { seq, trabajo: id, monthFrom, monthTo } = intent
    const clear = () => setIntent((prev) => (prev && prev.seq === seq ? { ...prev, trabajo: null } : prev))
    if (loadedKey !== `${range.from}|${range.to}` && status !== 'error') return
    const found = jobs.find((j) => j.id === id)
    if (found) {
      openJob(found)
      clear()
      return
    }
    if (inFlight.current === seq) return
    inFlight.current = seq
    void (async () => {
      try {
        const data = await api<{ jobs: Job[] }>(`/api/calendar/jobs?from=${monthFrom}&to=${monthTo}`)
        const job = Array.isArray(data.jobs) ? data.jobs.find((j) => j.id === id) : undefined
        if (job) openJob(job)
        else toast.error('No encontramos ese trabajo.')
      } catch (err) {
        toast.error(errorMessage(err))
      } finally {
        clear()
      }
    })()
  }, [intent, jobs, loadedKey, status, range.from, range.to, openJob])

  // Compatibilidad: el evento portal:new-job sigue abriendo «Nuevo trabajo».
  useEffect(() => {
    const onNewJob = () =>
      setIntent((prev) => {
        const m = rangeFor('month', cursorRef.current)
        return { seq: (prev?.seq ?? 0) + 1, nuevo: true, trabajo: null, monthFrom: m.from, monthTo: m.to }
      })
    window.addEventListener(NEW_JOB_EVENT, onNewJob)
    return () => window.removeEventListener(NEW_JOB_EVENT, onNewJob)
  }, [])

  const moveTo = useCallback(
    (id: string, dateKey: string) => {
      const job = jobs.find((j) => j.id === id)
      if (!job || !canEditJob(me, job) || job.date === dateKey) return
      void data.moveJob(job, dateKey)
    },
    [data, jobs, me],
  )

  const keyMove = useCallback(
    async (job: Job, days: -1 | 1) => {
      const base = parseIso(job.date)
      if (!base || !canEditJob(me, job)) return
      focusId.current = job.id
      await data.moveJob(job, toIso(addDays(base, days)))
      // Tras el render, el chip vuelve a enfocarse aunque haya cambiado de celda.
      setFocusNonce((n) => n + 1)
    },
    [data, me],
  )

  useEffect(() => {
    const id = focusId.current
    if (!id || dialog) return
    focusId.current = null
    document.querySelector<HTMLElement>(`[data-job-id="${id}"]`)?.focus()
  }, [focusNonce, dialog])

  // Atajos: N nuevo · T hoy · ←/→ navegar. Se ignoran al escribir y con el diálogo abierto.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (dialog || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
      const t = e.target
      if (t instanceof HTMLElement) {
        if (t.matches('input, select, textarea, [contenteditable]')) return
        if (t.closest('[role="listbox"], [role="menu"], [role="combobox"], [role="radiogroup"], [role="dialog"]')) return
      }
      switch (e.key) {
        case 'n':
        case 'N':
          if (canWrite) {
            e.preventDefault()
            openNew(startOfDay())
          }
          break
        case 't':
        case 'T':
          goToday()
          break
        case 'ArrowLeft':
          e.preventDefault()
          navigate(-1)
          break
        case 'ArrowRight':
          e.preventDefault()
          navigate(1)
          break
        default:
          break
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [dialog, canWrite, goToday, navigate, openNew])

  const title = formatTitle(effectiveView, cursor)
  const animateKey = `${effectiveView}:${range.from}:${range.to}`
  const loading = status === 'loading' && jobs.length === 0
  const failed = status === 'error'

  let body: ReactNode
  if (failed) {
    body = (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-5">
        <p className="text-sm leading-5 text-foreground">{error ?? 'No se pudo cargar el calendario.'}</p>
        <Button variant="outline" onClick={() => void data.reload()}>
          Reintentar
        </Button>
      </div>
    )
  } else if (loading) {
    body = showLoading ? <LoadingGrid view={effectiveView} /> : null
  } else if (effectiveView === 'month') {
    body = (
      <MonthView
        cursor={cursor}
        jobs={visible}
        me={me}
        todayKey={todayKey}
        assigneeName={assigneeName}
        canCreate={canWrite}
        onOpen={openJob}
        onCreate={openNew}
        onMore={goToWeek}
        onDropJob={moveTo}
        onKeyMove={keyMove}
        animateKey={animateKey}
      />
    )
  } else if (effectiveView === 'week') {
    body = (
      <WeekView
        cursor={cursor}
        jobs={visible}
        me={me}
        todayKey={todayKey}
        assigneeName={assigneeName}
        canCreate={canWrite}
        onOpen={openJob}
        onCreate={openNew}
        onDropJob={moveTo}
        onKeyMove={keyMove}
        animateKey={animateKey}
      />
    )
  } else {
    body = (
      <AgendaView
        jobs={visible}
        me={me}
        onKeyMove={keyMove}
        todayKey={todayKey}
        assigneeName={assigneeName}
        canCreate={canWrite}
        onOpen={openJob}
        onCreate={() => openNew(startOfDay())}
        animateKey={animateKey}
        emptyText="No hay trabajos en este rango."
      />
    )
  }

  return (
    <div className={cn("mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-4 py-4 md:gap-6 md:px-6 md:py-6", narrow && "pb-24")}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className={cn('text-[28px] font-semibold leading-9 tracking-tight', narrow && 'sr-only')}>Calendario</h1>
        {readOnly ? (
          <Badge
            variant="outline"
            data-testid="cal-readonly"
            title="Tu acceso al calendario es de solo lectura."
            className="text-muted-foreground"
          >
            Solo lectura
          </Badge>
        ) : null}
      </header>

      <Toolbar
        title={title}
        view={effectiveView}
        narrow={narrow}
        canCreate={canWrite}
        filters={filters}
        people={people}
        onFiltersChange={setFilters}
        onPrev={() => navigate(-1)}
        onNext={() => navigate(1)}
        onToday={goToday}
        onViewChange={changeView}
        onNew={() => openNew(startOfDay())}
      />

      <section aria-label="Trabajos" className="min-w-0">
        {body}
      </section>

      {narrow && canWrite ? (
        <div className="fixed inset-x-4 bottom-4 z-30">
          <Button data-testid="cal-new" className="h-12 w-full text-base" onClick={() => openNew(startOfDay())}>
            <Plus />
            Nuevo trabajo
          </Button>
        </div>
      ) : null}

      {dialog ? (
        <JobDialog
          key={dialog.key}
          job={dialog.job}
          initialDate={dialog.date}
          me={me}
          people={people}
          onClose={() => setDialog(null)}
          onCreate={data.createJob}
          onUpdate={data.updateJob}
          onDelete={data.deleteJob}
          onServerJob={data.upsertJob}
          onGone={() => void data.reload()}
        />
      ) : null}
    </div>
  )
}
