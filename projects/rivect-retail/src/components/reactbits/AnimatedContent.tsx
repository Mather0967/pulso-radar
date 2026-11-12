import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

interface AnimatedContentProps {
  children: ReactNode
  delay?: number
  y?: number
  className?: string
}

/** React Bits · AnimatedContent — entrada suave con desplazamiento. */
export function AnimatedContent({ children, delay = 0, y = 14, className }: AnimatedContentProps) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? undefined : { opacity: 0, y, filter: 'blur(6px)' }}
      animate={reduce ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

/** React Bits · FadeList — lista con entrada escalonada. */
export function FadeList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.06 } },
      }}
    >
      {children}
    </motion.div>
  )
}

export function FadeItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
      }}
    >
      {children}
    </motion.div>
  )
}
