import type { ComponentProps } from "react"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

export interface SpinnerProps extends ComponentProps<typeof Loader2> {
  /** Texto accesible. */
  label?: string
}

// Solo para dentro de botones (en carga de mutaciones). Para áreas, usar Skeleton.
export function Spinner({ className, label = "Cargando", ...props }: SpinnerProps) {
  return (
    <Loader2
      role="status"
      aria-label={label}
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}
