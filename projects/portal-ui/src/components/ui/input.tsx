import * as React from "react"

import { cn } from "@/lib/utils"

// Alto 44 en móvil, 36 en escritorio. Borde de campo = --input (3:1).
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "flex h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 md:h-9",
          className
        )}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
