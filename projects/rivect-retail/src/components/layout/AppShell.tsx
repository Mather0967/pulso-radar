import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { ResetDialog } from './ResetDialog'

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setMenuOpen(false)
  }, [pathname])

  return (
    <div className="relative min-h-screen overflow-x-hidden selection:bg-brand-500/30 selection:text-white">
      {/* Fondo ambiental orgánico con malla viva */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[640px] w-[640px] rounded-full bg-brand-500/[0.08] blur-[140px] animate-pulseRing" />
        <div className="absolute -right-40 top-1/4 h-[520px] w-[520px] rounded-full bg-mint-400/[0.04] blur-[160px]" />
        <div className="absolute bottom-[-100px] left-1/3 h-[580px] w-[580px] rounded-full bg-brand-500/[0.05] blur-[150px]" />
        <div className="absolute inset-0 bg-grid-soft opacity-[0.4] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />
      </div>

      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="lg:pl-[264px]">
        <Topbar onMenu={() => setMenuOpen(true)} onReset={() => setResetOpen(true)} />
        <main className="mx-auto max-w-[1560px] px-4 pb-20 pt-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
      <ResetDialog open={resetOpen} onClose={() => setResetOpen(false)} />
    </div>
  )
}
