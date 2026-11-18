import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

/** React Bits · Stagger — contenedor que escalona la entrada de sus hijos `StaggerItem`. */
export function Stagger({ children, step = 0.06 }: { children: ReactNode; step?: number }) {
  const reduce = useReducedMotion()

  if (reduce) {
    return <div>{children}</div>
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: step } },
      }}
    >
      {children}
    </motion.div>
  )
}

/** Hijo de `Stagger`: aparece con un leve desplazamiento hacia arriba. */
export function StaggerItem({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion()

  if (reduce) {
    return <div>{children}</div>
  }

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
      }}
    >
      {children}
    </motion.div>
  )
}
