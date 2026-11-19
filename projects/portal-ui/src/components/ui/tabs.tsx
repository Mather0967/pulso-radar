import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

// Lista en línea con un único indicador deslizante mandarín bajo la pestaña activa.
// El indicador se mide con --tab-x / --tab-w (px) sobre la lista; se mueve con
// transform (250 ms, --ease-spring) y su ancho se fija sin animar.
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, children, ...props }, ref) => {
  const innerRef = React.useRef<HTMLDivElement | null>(null)
  const setRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      innerRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node
    },
    [ref]
  )

  React.useLayoutEffect(() => {
    const list = innerRef.current
    if (!list) return

    const measure = () => {
      const active = list.querySelector<HTMLElement>('[role="tab"][data-state="active"]')
      if (!active) {
        list.style.setProperty("--tab-w", "0px")
        return
      }
      list.style.setProperty("--tab-x", `${active.offsetLeft}px`)
      list.style.setProperty("--tab-w", `${active.offsetWidth}px`)
    }

    measure()
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null
    ro?.observe(list)
    const mo = new MutationObserver(measure)
    mo.observe(list, { subtree: true, attributes: true, attributeFilter: ["data-state"] })
    return () => {
      ro?.disconnect()
      mo.disconnect()
    }
  }, [])

  return (
    <TabsPrimitive.List
      ref={setRef}
      className={cn("relative flex items-center gap-6 border-b border-border", className)}
      {...props}
    >
      {children}
      <span
        aria-hidden="true"
        data-tab-indicator=""
        className="pointer-events-none absolute bottom-0 left-0 h-0.5 rounded-t-sm bg-primary shadow-[0_0_10px_rgba(255,118,46,0.35)] transition-transform duration-[250ms] ease-[var(--ease-spring)] motion-reduce:transition-none"
        style={{
          width: "var(--tab-w, 0px)",
          transform: "translateX(var(--tab-x, 0px))",
        }}
      />
    </TabsPrimitive.List>
  )
})
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative inline-flex min-h-11 items-center justify-center whitespace-nowrap px-0 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground md:min-h-9",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-200",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
