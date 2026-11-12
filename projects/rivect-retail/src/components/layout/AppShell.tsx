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
    <div className="min-h-screen">
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
