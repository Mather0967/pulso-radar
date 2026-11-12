import { useEffect, type ReactNode } from 'react'
import { useSimulationStore } from '@/store/useSimulationStore'
import { Aurora } from '@/components/reactbits/Aurora'

export function AppProviders({ children }: { children: ReactNode }) {
  const hydrated = useSimulationStore((s) => s.seeded)
  const hydrate = useSimulationStore((s) => s.hydrate)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  if (!hydrated) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
        <Aurora />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-500/40 bg-ink-800 shadow-glow">
            <span className="font-display text-lg font-bold text-brand-300">R</span>
          </div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Preparando la demo</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
