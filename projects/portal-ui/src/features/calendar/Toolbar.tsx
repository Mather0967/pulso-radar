import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { JobStatus, Person, ProjectId } from '@/lib/types'
import type { CalView } from './dates'
import {
  NO_FILTER,
  PROJECT_LABEL,
  PROJECT_ORDER,
  STATUS_LABEL,
  STATUS_ORDER,
} from './constants'
import { EMPTY_FILTERS, activeFilterCount, type Filters } from './jobs'

const VIEW_LABEL: Record<CalView, string> = { month: 'Mes', week: 'Semana', agenda: 'Agenda' }

type ViewGroupProps = {
  view: CalView
  narrow: boolean
  onViewChange: (view: CalView) => void
}

/** Mes | Semana | Agenda. En pantallas angostas solo la agenda está disponible (como en la versión anterior). */
export function ViewGroup({ view, narrow, onViewChange }: ViewGroupProps) {
  return (
    <ToggleGroup
      value={view}
      aria-label="Vista"
      onValueChange={(v) => {
        if (v) onViewChange(v as CalView)
      }}
    >
      {(['month', 'week', 'agenda'] as CalView[]).map((v) => (
        <ToggleGroupItem
          key={v}
          value={v}
          data-testid={`view-${v}`}
          disabled={narrow && v !== 'agenda'}
          className="min-w-20"
        >
          {VIEW_LABEL[v]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

type FilterFieldsProps = {
  filters: Filters
  people: Person[]
  onChange: (next: Filters) => void
  triggerClassName?: string
}

/** Los tres selects de filtro. Usan 'all' como valor de «Todos» (Radix no admite valor vacío). */
export function FilterFields({ filters, people, onChange, triggerClassName = 'h-10 w-full sm:w-[196px]' }: FilterFieldsProps) {
  const assigneeInactive =
    filters.assignee !== NO_FILTER && !people.some((p) => p.id === filters.assignee)
  const projectLabel = filters.project === NO_FILTER ? 'Proyecto: todos' : PROJECT_LABEL[filters.project as ProjectId]
  const assigneeName =
    filters.assignee === NO_FILTER
      ? 'Responsable: todos'
      : `Responsable: ${people.find((p) => p.id === filters.assignee)?.name ?? 'Usuario inactivo'}`
  const statusLabel = filters.status === NO_FILTER ? 'Estado: todos' : `Estado: ${STATUS_LABEL[filters.status as JobStatus]}`

  return (
    <>
      <Select value={filters.project} onValueChange={(project) => onChange({ ...filters, project })}>
        <SelectTrigger data-testid="filter-project" aria-label="Filtrar por proyecto" className={triggerClassName}>
          <SelectValue>{projectLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_FILTER}>Todos los proyectos</SelectItem>
          {PROJECT_ORDER.map((p) => (
            <SelectItem key={p} value={p}>
              {PROJECT_LABEL[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filters.assignee} onValueChange={(assignee) => onChange({ ...filters, assignee })}>
        <SelectTrigger data-testid="filter-assignee" aria-label="Filtrar por responsable" className={triggerClassName}>
          <SelectValue>{assigneeName}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_FILTER}>Todos los responsables</SelectItem>
          {people.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
          {assigneeInactive ? <SelectItem value={filters.assignee}>Usuario inactivo</SelectItem> : null}
        </SelectContent>
      </Select>
      <Select value={filters.status} onValueChange={(status) => onChange({ ...filters, status })}>
        <SelectTrigger data-testid="filter-status" aria-label="Filtrar por estado" className={triggerClassName}>
          <SelectValue>{statusLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_FILTER}>Todos los estados</SelectItem>
          {STATUS_ORDER.map((s) => (
            <SelectItem key={s} value={s}>
              {STATUS_LABEL[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  )
}

type ToolbarProps = {
  title: string
  view: CalView
  narrow: boolean
  canCreate: boolean
  filters: Filters
  people: Person[]
  onFiltersChange: (next: Filters) => void
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onViewChange: (view: CalView) => void
  onNew: () => void
}

/** Escritorio: título, navegación, vista, «Nuevo trabajo» y fila de filtros. Pantallas angostas: encabezado sticky con filtros en un Sheet. */
export function Toolbar(props: ToolbarProps) {
  if (props.narrow) return <NarrowToolbar {...props} />
  return <WideToolbar {...props} />
}

function WideToolbar({
  title,
  view,
  canCreate,
  filters,
  people,
  onFiltersChange,
  onPrev,
  onNext,
  onToday,
  onViewChange,
  onNew,
}: ToolbarProps) {
  const nav = view !== 'agenda'
  const active = activeFilterCount(filters)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={onPrev} disabled={!nav} aria-label="Anterior" data-testid="cal-prev">
            <ChevronLeft />
          </Button>
          <Button variant="outline" onClick={onToday} data-testid="cal-today">
            Hoy
          </Button>
          <Button variant="outline" size="icon" onClick={onNext} disabled={!nav} aria-label="Siguiente" data-testid="cal-next">
            <ChevronRight />
          </Button>
          <h2 data-testid="cal-title" aria-live="polite" className="ml-2 text-lg font-semibold leading-7 tracking-tight">
            {title}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <ViewGroup view={view} narrow={false} onViewChange={onViewChange} />
          {canCreate ? (
            <Button variant="default" onClick={onNew} data-testid="cal-new">
              <Plus />
              Nuevo trabajo
            </Button>
          ) : null}
        </div>
      </div>
      <div role="group" aria-label="Filtros" className="flex flex-wrap items-center gap-2">
        <FilterFields filters={filters} people={people} onChange={onFiltersChange} />
        {active > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => onFiltersChange(EMPTY_FILTERS)}>
            Limpiar filtros
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function NarrowToolbar({ title, view, filters, people, onFiltersChange, onToday, onViewChange }: ToolbarProps) {
  const [open, setOpen] = useState(false)
  const active = activeFilterCount(filters)
  return (
    <div className="sticky top-0 z-20 -mx-4 flex flex-col gap-2 border-b border-border bg-background px-4 pb-2 pt-2">
      <div className="flex h-11 items-center justify-between gap-2">
        <h2 data-testid="cal-title" aria-live="polite" className="min-w-0 truncate text-base font-semibold leading-6">
          {title}
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" onClick={onToday} data-testid="cal-today" className="h-11 px-3">
            Hoy
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="h-11 px-3" data-testid="filters-open">
                <SlidersHorizontal />
                Filtros{active > 0 ? ` (${active})` : ''}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-xl">
              <SheetHeader>
                <SheetTitle>Filtros</SheetTitle>
                <SheetDescription>Mostrar solo los trabajos que coincidan.</SheetDescription>
              </SheetHeader>
              <div className="mt-4 flex flex-col gap-3">
                <FilterFields filters={filters} people={people} onChange={onFiltersChange} triggerClassName="h-11 w-full" />
              </div>
              <div className="mt-6 flex items-center justify-between gap-2">
                <Button variant="ghost" onClick={() => onFiltersChange(EMPTY_FILTERS)} disabled={active === 0}>
                  Limpiar
                </Button>
                <Button variant="default" onClick={() => setOpen(false)}>
                  Ver trabajos
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      <ViewGroup view={view} narrow onViewChange={onViewChange} />
    </div>
  )
}
