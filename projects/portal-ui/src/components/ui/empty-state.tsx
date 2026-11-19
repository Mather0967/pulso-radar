import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export interface EmptyStateProps {
  /** Icono (lucide, tamaño 16 se aplica solo). */
  icon?: ReactNode
  title: string
  /** Máx. 2 líneas. */
  description?: string
  /** Un botón, por ejemplo «Crear trabajo». */
  action?: ReactNode
  className?: string
}

// Estado vacío: icono 16 en círculo 40 (bg-muted), título 16/24, texto 14 muted.
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-6 py-10 text-center",
        className
      )}
    >
      {icon ? (
        <div
          aria-hidden="true"
          className="mb-1 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-4"
        >
          {icon}
        </div>
      ) : null}
      <p className="text-base font-semibold leading-6 text-foreground">{title}</p>
      {description ? (
        <p className="line-clamp-2 max-w-sm text-sm leading-[22px] text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
