import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

interface CountUpProps {
  value: number
  decimals?: number
  prefix?: string
  suffix?: string
  duration?: number
  className?: string
  /** Separador de miles es-AR. */
  separator?: boolean
}

/** React Bits · CountUp — corre desde 0 al montar y anima cuando cambia. Con movimiento reducido muestra el valor final. */
export function CountUp({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  duration = 900,
  className,
  separator = true,
}: CountUpProps) {
  const reduce = useReducedMotion()
  const [display, setDisplay] = useState(reduce ? value : 0)
  const fromRef = useRef(reduce ? value : 0)
  const frameRef = useRef<number>()

  useEffect(() => {
    const from = fromRef.current
    const to = Number.isFinite(value) ? value : 0
    if (reduce) {
      fromRef.current = to
      setDisplay(to)
      return
    }
    const start = performance.now()

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(from + (to - from) * eased)
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = to
      }
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      fromRef.current = to
    }
  }, [value, duration, reduce])

  const formatted = separator
    ? new Intl.NumberFormat('es-AR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(display)
    : display.toFixed(decimals)

  return (
    <span className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  )
}
