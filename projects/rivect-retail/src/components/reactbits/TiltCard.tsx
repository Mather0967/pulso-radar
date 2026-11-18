import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion'
import { useState, type PointerEvent, type ReactNode } from 'react'
import { cn } from '@/utils/format'

const MAX_TILT = 6

function useCoarsePointer() {
  const [coarse] = useState(() =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches,
  )
  return coarse
}

/** React Bits · TiltCard — inclinación 3D sutil que sigue al puntero con resorte. */
export function TiltCard({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  const coarse = useCoarsePointer()
  const disabled = Boolean(reduce) || coarse

  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const sx = useSpring(px, { stiffness: 220, damping: 22, mass: 0.6 })
  const sy = useSpring(py, { stiffness: 220, damping: 22, mass: 0.6 })
  const rotateX = useTransform(sy, [0, 1], [MAX_TILT, -MAX_TILT])
  const rotateY = useTransform(sx, [0, 1], [-MAX_TILT, MAX_TILT])

  if (disabled) {
    return <div className={className}>{children}</div>
  }

  const handleMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse') return
    const rect = event.currentTarget.getBoundingClientRect()
    px.set((event.clientX - rect.left) / rect.width)
    py.set((event.clientY - rect.top) / rect.height)
  }

  const handleLeave = () => {
    px.set(0.5)
    py.set(0.5)
  }

  return (
    <motion.div
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      className={cn('will-change-transform', className)}
      style={{ rotateX, rotateY, transformPerspective: 900, transformStyle: 'preserve-3d' }}
    >
      {children}
    </motion.div>
  )
}
