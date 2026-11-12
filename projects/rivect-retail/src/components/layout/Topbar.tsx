import { Menu, RotateCcw, ShieldCheck } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { NAV_ITEMS } from './nav'
import { Button } from '@/components/ui/Button'

export function Topbar({ onMenu, onReset }: { onMenu: () => void; onReset: () => void }) {
  const { pathname } = useLocation()
  const current = NAV_ITEMS.find((item) => pathname.startsWith(item.to)) ?? NAV_ITEMS[0]

  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-ink-950/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1560px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={onMenu}
            className="rounded-lg border border-line p-2 text-slate-400 hover:text-white lg:hidden"
            aria-label="Abrir menú"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <p className="hidden text-[10px] uppercase tracking-[0.2em] text-slate-600 sm:block">
              Retail Intelligence
            </p>
            <p className="truncate font-display text-sm font-medium text-slate-200">{current.label}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 sm:px-3">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-pulseRing rounded-full bg-amber-400" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300">
              Demo
            </span>
            <span className="hidden text-[10px] text-amber-300/70 sm:inline">· datos simulados</span>
          </div>

          <div className="hidden items-center gap-1.5 rounded-full border border-line bg-ink-900/70 px-3 py-1 text-[10px] text-slate-500 md:flex">
            <ShieldCheck className="h-3 w-3 text-mint-400" />
            Sin conexiones externas
          </div>

          <Button variant="secondary" size="sm" onClick={onReset} className="shrink-0">
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Restablecer demo</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
