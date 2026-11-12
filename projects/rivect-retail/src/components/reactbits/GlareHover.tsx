import type { ReactNode } from 'react'
import { cn } from '@/utils/format'

/** React Bits · GlareHover — brillo diagonal al pasar el cursor. */
export function GlareHover({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('group/glare relative overflow-hidden', className)}>
      {children}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-[900ms] ease-out group-hover/glare:translate-x-full"
      />
    </div>
  )
}
