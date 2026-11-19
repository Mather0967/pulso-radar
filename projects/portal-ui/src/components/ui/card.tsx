import * as React from "react"

import { cn } from "@/lib/utils"
import { useSpotlight } from "@/lib/useSpotlight"

// Superficie: `card-surface` (degradado del brief v2). Con `interactive`:
// borde cónico, foco que sigue el cursor y destello (clases de globals.css).
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive = false, children, ...props }, ref) => {
    const spot = useSpotlight<HTMLDivElement>()
    const setRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        if (interactive) (spot as React.MutableRefObject<HTMLDivElement | null>).current = node
        if (typeof ref === "function") ref(node)
        else if (ref) ref.current = node
      },
      [interactive, ref, spot]
    )

    if (!interactive) {
      return (
        <div
          ref={setRef}
          className={cn("card-surface rounded-lg border border-border text-card-foreground", className)}
          {...props}
        >
          {children}
        </div>
      )
    }

    return (
      <div
        ref={setRef}
        className={cn(
          "interactive-card animate-card-in relative overflow-hidden rounded-2xl border border-border text-card-foreground",
          className
        )}
        {...props}
      >
        <div className="spotlight-glow" aria-hidden="true" />
        <div className="card-glare" aria-hidden="true" />
        <div className="relative z-[3] flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    )
  }
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1.5 p-5", className)} {...props} />
  )
)
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-base font-semibold leading-6 tracking-tight text-foreground", className)}
      {...props}
    />
  )
)
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-[13px] leading-5 text-muted-foreground", className)} {...props} />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
  )
)
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center gap-2 p-5 pt-0", className)} {...props} />
  )
)
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
