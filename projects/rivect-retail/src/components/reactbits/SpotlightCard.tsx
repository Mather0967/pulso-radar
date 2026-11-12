import { useRef, type MouseEvent, type ReactNode } from 'react'
import { cn } from '@/utils/format'

interface SpotlightCardProps {
  children: ReactNode
  className?: string
  /** Color del foco que sigue al cursor. */
  color?: string
}

/** React Bits · SpotlightCard — tarjeta con foco que sigue al mouse. */
export function SpotlightCard({ children, className, color = 'rgba(47,116,255,0.16)' }: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null)

  const handleMove = (event: MouseEvent<HTMLDivElement>) => {
    const element = ref.current
    if (!element) return
    const rect = element.getBoundingClientRect()
    element.style.setProperty('--spot-x', `${event.clientX - rect.left}px`)
    element.style.setProperty('--spot-y', `${event.clientY - rect.top}px`)
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-line/90 bg-ink-850/70 transition-colors duration-300 hover:border-brand-500/40',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(340px circle at var(--spot-x, 50%) var(--spot-y, 0%), ${color}, transparent 65%)`,
        }}
      />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  )
}
