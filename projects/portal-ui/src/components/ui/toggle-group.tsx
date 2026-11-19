import * as React from "react"

import { cn } from "@/lib/utils"

// Grupo de selección única (Mes | Semana | Agenda). Implementado a mano para no
// sumar @radix-ui/react-toggle-group: role="radiogroup" + role="radio", flechas
// mueven y seleccionan, Tab entra y sale.

type ToggleGroupContextValue = {
  value: string | undefined
  select: (value: string) => void
}

const ToggleGroupContext = React.createContext<ToggleGroupContextValue | null>(null)

export interface ToggleGroupProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  "aria-label": string
}

const ToggleGroup = React.forwardRef<HTMLDivElement, ToggleGroupProps>(
  ({ className, value, defaultValue, onValueChange, children, ...props }, ref) => {
    const [inner, setInner] = React.useState<string | undefined>(defaultValue)
    const current = value ?? inner

    const select = React.useCallback(
      (next: string) => {
        if (value === undefined) setInner(next)
        onValueChange?.(next)
      },
      [value, onValueChange]
    )

    return (
      <ToggleGroupContext.Provider value={{ value: current, select }}>
        <div
          ref={ref}
          role="radiogroup"
          className={cn(
            "inline-flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5",
            className
          )}
          {...props}
        >
          {children}
        </div>
      </ToggleGroupContext.Provider>
    )
  }
)
ToggleGroup.displayName = "ToggleGroup"

export interface ToggleGroupItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

const ToggleGroupItem = React.forwardRef<HTMLButtonElement, ToggleGroupItemProps>(
  ({ className, value, children, onKeyDown, ...props }, ref) => {
    const ctx = React.useContext(ToggleGroupContext)
    if (!ctx) throw new Error("ToggleGroupItem debe usarse dentro de ToggleGroup")
    const checked = ctx.value === value

    const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
      onKeyDown?.(event)
      if (event.defaultPrevented) return
      const keys = ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"]
      if (!keys.includes(event.key)) return
      const group = event.currentTarget.closest('[role="radiogroup"]')
      if (!group) return
      const items = Array.from(group.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)'))
      const index = items.indexOf(event.currentTarget)
      let nextIndex = index
      if (event.key === "Home") nextIndex = 0
      else if (event.key === "End") nextIndex = items.length - 1
      else if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % items.length
      else nextIndex = (index - 1 + items.length) % items.length
      event.preventDefault()
      const next = items[nextIndex]
      next?.focus()
      next?.click()
    }

    return (
      <button
        ref={ref}
        type="button"
        role="radio"
        aria-checked={checked}
        data-state={checked ? "on" : "off"}
        tabIndex={checked || ctx.value === undefined ? 0 : -1}
        onClick={() => ctx.select(value)}
        onKeyDown={handleKeyDown}
        className={cn(
          "inline-flex min-h-11 items-center justify-center gap-2 rounded-[4px] px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-secondary data-[state=on]:text-foreground md:min-h-8 [&_svg]:size-4 [&_svg]:shrink-0",
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)
ToggleGroupItem.displayName = "ToggleGroupItem"

export { ToggleGroup, ToggleGroupItem }
