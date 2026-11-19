import type { HTMLAttributes } from "react"

import { cn } from "@/lib/utils"

// Shimmer de 1.6 s; con reduced-motion queda estático (regla global).
function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("rounded-md bg-muted animate-[pulse_1.6s_cubic-bezier(0.2,0,0,1)_infinite]", className)}
      {...props}
    />
  )
}

export { Skeleton }
