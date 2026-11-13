import { useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { cn } from '@/utils/format'

interface SpotlightCardProps {
  children: ReactNode
  className?: string
  /** Color del foco que sigue al cursor. */
  color?: string
  /** Activar elevación suave en hover. */
  hoverElevation?: boolean
}

/** React Bits · SpotlightCard — tarjeta con foco dinámico que sigue al mouse y micro-iluminación. */
export function SpotlightCard({
  children,
  className,
  color = 'rgba(47,116,255,0.18)',
  hoverElevation = true,
}: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)

  const handleMove = (event: MouseEvent<HTMLDivElement>) => {
    const element = ref.current
    if (!element) return
    const rect = element.getBoundingClientRect()
    element.style.setProperty('--spot-x', `${event.clientX - rect.left}px`)
    element.style.setProperty('--spot-y', `${event.clientY - rect.top}px`)
    if (!isHovered) setIsHovered(true)
  }

  const handleLeave = () => {
    setIsHovered(false)
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleLeave}
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-line/80 bg-gradient-to-b from-ink-850/85 to-ink-900/95 shadow-card backdrop-blur-md transition-all duration-300 hover:border-brand-500/40',
        hoverElevation && 'hover:-translate-y-0.5 hover:shadow-[0_20px_48px_-16px_rgba(0,0,0,0.8)]',
        className,
      )}
    >
      {/* Resalte sutil en el borde superior para profundidad física */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      
      {/* Foco radial que sigue al cursor */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 transition-opacity duration-300',
          isHovered ? 'opacity-100' : 'opacity-0',
        )}
        style={{
          background: `radial-gradient(380px circle at var(--spot-x, 50%) var(--spot-y, 0%), ${color}, transparent 65%)`,
        }}
      />
      
      <div className="relative z-10 h-full">{children}</div>
    </div>
  )
}
