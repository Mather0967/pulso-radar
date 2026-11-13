import { NavLink } from 'react-router-dom'
import { ArrowLeft, Info, Sparkles, X } from 'lucide-react'
import { NAV_ITEMS } from './nav'
import { useSimulationStore } from '@/store/useSimulationStore'
import { cn } from '@/utils/format'

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const storeName = useSimulationStore((s) => s.storeProfile.name)

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 pb-5 pt-5">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-brand-500/40 bg-gradient-to-br from-brand-500/25 to-ink-900 shadow-glow">
            <span className="font-display text-lg font-bold text-brand-200">R</span>
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-mint-400 ring-2 ring-ink-900" />
          </div>
          <div>
            <p className="font-display text-sm font-semibold tracking-tight text-white">Rivect</p>
            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Retail Intelligence</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-ink-800 hover:text-white lg:hidden"
          aria-label="Cerrar menú"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mx-4 mb-4 space-y-2">
        <a
          href="/portal"
          className="group flex items-center justify-between rounded-xl border border-line/70 bg-ink-900/60 px-3 py-2 text-xs font-medium text-slate-400 transition-all hover:border-brand-500/40 hover:bg-ink-850 hover:text-white"
          title="Regresar al portal principal de proyectos"
        >
          <span className="flex items-center gap-2">
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5 text-brand-400" />
            <span>Mis proyectos</span>
          </span>
          <span className="text-[10px] uppercase tracking-wider text-slate-600 group-hover:text-slate-400">Portal</span>
        </a>

        <div className="rounded-xl border border-line/80 bg-ink-900/60 p-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-600">Comercio en demo</p>
          <p className="mt-1 truncate font-display text-sm font-medium text-slate-200">{storeName}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all',
                isActive
                  ? 'border border-brand-500/25 bg-gradient-to-r from-brand-500/15 to-brand-500/5 font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                  : 'text-slate-400 hover:bg-ink-800/70 hover:text-slate-200',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive ? (
                  <span className="absolute left-0 top-1/2 h-6 w-[2px] -translate-y-1/2 rounded-r bg-gradient-to-b from-brand-300 to-brand-500 shadow-[0_0_8px_rgba(47,116,255,0.8)]" />
                ) : null}
                <item.icon
                  className={cn(
                    'h-4 w-4 shrink-0 transition-colors',
                    isActive ? 'text-brand-300' : 'text-slate-500 group-hover:text-slate-300',
                  )}
                />
                <span className="flex-1 truncate font-medium">{item.label}</span>
                <span
                  className={cn(
                    'text-[9px] uppercase tracking-wider',
                    isActive ? 'text-brand-300/80 font-semibold' : 'text-slate-700',
                  )}
                >
                  {item.description.split(' ')[0]}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="m-3 rounded-xl border border-brand-500/20 bg-brand-500/[0.06] p-3">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-brand-300">
          <Sparkles className="h-3.5 w-3.5" />
          Demostración comercial
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
          Todos los datos son ficticios. Ninguna acción envía mensajes ni modifica sistemas reales.
        </p>
        <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-600">
          <Info className="h-3 w-3" /> Datos guardados en este navegador
        </div>
      </div>
    </div>
  )

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] border-r border-line/80 bg-ink-950/80 backdrop-blur-xl lg:block">
        {content}
      </aside>

      <div
        className={cn(
          'fixed inset-0 z-40 lg:hidden',
          open ? 'pointer-events-auto' : 'pointer-events-none',
        )}
      >
        <div
          className={cn(
            'absolute inset-0 bg-ink-950/70 backdrop-blur-sm transition-opacity duration-300',
            open ? 'opacity-100' : 'opacity-0',
          )}
          onClick={onClose}
          role="presentation"
        />
        <aside
          className={cn(
            'absolute inset-y-0 left-0 w-[280px] border-r border-line bg-ink-900 transition-transform duration-300',
            open ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          {content}
        </aside>
      </div>
    </>
  )
}
