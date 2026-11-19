import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Proyectos y estados llevan punto de color + texto (nunca relleno naranja).
// Colores vía variables CSS: --pulso, --landur, --studio, --retail, --general,
// --pendiente, --en-curso, --hecho, --bloqueado (valores HSL sin hsl()).
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium leading-4 whitespace-nowrap transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        default: "border-transparent bg-secondary text-secondary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",

        pulso:
          "border-border text-foreground before:block before:size-1.5 before:shrink-0 before:rounded-full before:content-[''] before:bg-[hsl(var(--pulso,186_52%_56%))]",
        landur:
          "border-border text-foreground before:block before:size-1.5 before:shrink-0 before:rounded-full before:content-[''] before:bg-[hsl(var(--landur,255_80%_74%))]",
        studio:
          "border-border text-foreground before:block before:size-1.5 before:shrink-0 before:rounded-full before:content-[''] before:bg-[hsl(var(--studio,340_60%_68%))]",
        retail:
          "border-border text-foreground before:block before:size-1.5 before:shrink-0 before:rounded-full before:content-[''] before:bg-[hsl(var(--retail,43_80%_62%))]",
        general:
          "border-border text-foreground before:block before:size-1.5 before:shrink-0 before:rounded-full before:content-[''] before:bg-[hsl(var(--general,200_14%_62%))]",

        pendiente:
          "border-transparent text-[hsl(var(--pendiente,200_14%_62%))] before:block before:size-1.5 before:shrink-0 before:rounded-full before:content-[''] before:bg-current",
        en_curso:
          "border-transparent text-[hsl(var(--en-curso,205_80%_62%))] before:block before:size-1.5 before:shrink-0 before:rounded-full before:content-[''] before:bg-current",
        hecho:
          "border-transparent text-[hsl(var(--hecho,152_55%_50%))] before:block before:size-1.5 before:shrink-0 before:rounded-full before:content-[''] before:bg-current",
        bloqueado:
          "border-transparent text-[hsl(var(--bloqueado,4_80%_66%))] before:block before:size-1.5 before:shrink-0 before:rounded-full before:content-[''] before:bg-current",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
