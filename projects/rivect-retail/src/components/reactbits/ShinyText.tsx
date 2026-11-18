import type { ReactNode } from 'react'
import { cn } from '@/utils/format'

/** React Bits · ShinyText — texto con brillo en movimiento. */
export function ShinyText({
  children,
  className,
  speed = 4,
}: {
  children: ReactNode
  className?: string
  speed?: number
}) {
  return (
    <span
      className={cn('inline-block bg-clip-text text-transparent', className)}
      style={{
        backgroundImage:
          'linear-gradient(100deg, #ffb88a 0%, #ffffff 42%, #ff9a5c 58%, #ffb88a 100%)',
        backgroundSize: '200% 100%',
        animation: `shinyText ${speed}s linear infinite`,
      }}
    >
      {children}
      <style>{`
        @keyframes shinyText {
          0% { background-position: 120% 50%; }
          100% { background-position: -120% 50%; }
        }
      `}</style>
    </span>
  )
}

/** React Bits · GradientText — degradado de marca estático. */
export function GradientText({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn('bg-clip-text text-transparent', className)}
      style={{ backgroundImage: 'linear-gradient(92deg, #ffffff 0%, #ffb88a 55%, #ff762e 100%)' }}
    >
      {children}
    </span>
  )
}
