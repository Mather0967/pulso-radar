import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, Clock, Menu, RotateCcw, ShieldCheck } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { NAV_ITEMS } from './nav'
import { Button } from '@/components/ui/Button'

const clockFmt = new Intl.DateTimeFormat('es-UY', { hour: '2-digit', minute: '2-digit', hour12: false })

/** Hora local que se actualiza cada 30 s; sin animación propia, así que no depende de reduced motion. */
function LiveClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div
      className="hidden items-center gap-1.5 rounded-full border border-line bg-ink-900/70 px-3 py-1 text-[10px] text-slate-400 lg:flex"
      title="Hora local"
    >
      <Clock className="h-3 w-3 text-brand-400" />
      <span className="tabular-nums text-slate-300">{clockFmt.format(now)}</span>
    </div>
  )
}

export function Topbar({ onMenu, onReset }: { onMenu: () => void; onReset: () => void }) {
  const { pathname } = useLocation()
  const reduce = useReducedMotion()
  const current = NAV_ITEMS.find((item) => pathname.startsWith(item.to)) ?? NAV_ITEMS[0]

  return (
    <header className="sticky top-0 z-20 border-b relative border-line/80 bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1560px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={onMenu}
            className="rounded-lg border border-line p-2 text-slate-400 transition hover:text-white lg:hidden"
            aria-label="Abrir menú"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <p className="hidden text-[10px] uppercase tracking-[0.2em] text-slate-500 sm:block">
              <motion.span
                className="inline-block"
                style={{
                  backgroundImage:
                    'linear-gradient(90deg, #64748b 0%, #f7f5ef 35%, #ff762e 50%, #f7f5ef 65%, #64748b 100%)',
                  backgroundSize: '220% 100%',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
                animate={reduce ? undefined : { backgroundPosition: ['100% 0%', '0% 0%'] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'linear', repeatDelay: 2 }}
              >
                RIVECT · Retail Intelligence
              </motion.span>
            </p>
            <div className="relative min-w-0 overflow-hidden">
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={current.to}
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="truncate font-display text-sm font-semibold text-slate-100"
                >
                  {current.label}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href="/portal"
            className="group hidden items-center gap-1.5 rounded-lg border border-line/80 bg-ink-900/70 px-2.5 py-1 text-xs font-medium text-slate-400 transition hover:border-brand-500/50 hover:bg-ink-850 hover:text-white md:inline-flex"
            title="Ir al portal de proyectos"
          >
            <ArrowLeft className="h-3 w-3 text-brand-400 transition-transform group-hover:-translate-x-0.5" />
            <span>Portal</span>
          </a>

          <div className="flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 sm:px-3">
            <span className="relative flex h-1.5 w-1.5">
              {!reduce && (
                <span className="absolute inline-flex h-full w-full animate-pulseRing rounded-full bg-[#ff762e]" />
              )}
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#ff762e]" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#ff762e]">
              Demo
            </span>
            <span className="hidden text-[10px] text-[#ff762e]/80 sm:inline">· datos simulados</span>
          </div>

          <LiveClock />

          <div className="hidden items-center gap-1.5 rounded-full border border-line bg-ink-900/70 px-3 py-1 text-[10px] text-slate-400 md:flex">
            <ShieldCheck className="h-3 w-3 text-mint-400" />
            Sin conexiones externas
          </div>

          <Button variant="secondary" size="sm" onClick={onReset} className="shrink-0">
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Restablecer</span>
          </Button>
        </div>
      </div>

      {/* Línea de brillo animada en el borde inferior */}
      {!reduce && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px overflow-hidden" aria-hidden>
          <motion.div
            className="h-full w-1/3"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(255,118,46,0.9), rgba(247,245,239,0.6), transparent)',
            }}
            initial={{ x: '-100%' }}
            animate={{ x: '400%' }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', repeatDelay: 3 }}
          />
        </div>
      )}
    </header>
  )
}
