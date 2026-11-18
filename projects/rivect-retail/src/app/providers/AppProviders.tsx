import { useEffect, type ReactNode } from 'react'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { motion } from 'framer-motion'
import { useSimulationStore } from '@/store/useSimulationStore'
import { Aurora } from '@/components/reactbits/Aurora'
import { rivectTheme } from '@/theme/rivect'

function LoadingScreen() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <Aurora />
      <div className="relative z-10 flex flex-col items-center gap-5">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <motion.img
            src={`${import.meta.env.BASE_URL}symbol.svg`}
            alt="RIVECT"
            width={56}
            height={56}
            className="h-14 w-14"
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 2.2, ease: 'easeInOut', repeat: Infinity }}
          />
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="text-xs uppercase tracking-[0.08em] text-slate-400"
        >
          Preparando la demo
        </motion.p>
      </div>
    </div>
  )
}

export function AppProviders({ children }: { children: ReactNode }) {
  const hydrated = useSimulationStore((s) => s.seeded)
  const hydrate = useSimulationStore((s) => s.hydrate)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  return (
    <MantineProvider theme={rivectTheme} forceColorScheme="dark">
      <Notifications position="top-right" limit={3} />
      {hydrated ? children : <LoadingScreen />}
    </MantineProvider>
  )
}
