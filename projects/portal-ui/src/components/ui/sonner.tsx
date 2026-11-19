import * as React from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const MOBILE_QUERY = "(max-width: 767px)"

// Toaster oscuro con los tokens del portal. Abajo a la derecha; centro en móvil.
// Los consumidores importan `toast` directamente desde 'sonner'.
const Toaster = ({ ...props }: ToasterProps) => {
  const [mobile, setMobile] = React.useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia(MOBILE_QUERY).matches : false
  )

  React.useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY)
    const onChange = () => setMobile(mq.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  return (
    <Sonner
      theme="dark"
      position={mobile ? "bottom-center" : "bottom-right"}
      closeButton
      className="toaster group"
      style={
        {
          "--normal-bg": "hsl(var(--popover))",
          "--normal-text": "hsl(var(--popover-foreground))",
          "--normal-border": "hsl(var(--border))",
          "--success-bg": "hsl(var(--popover))",
          "--success-text": "hsl(var(--popover-foreground))",
          "--success-border": "hsl(var(--hecho, 152 55% 50%))",
          "--error-bg": "hsl(var(--popover))",
          "--error-text": "hsl(var(--popover-foreground))",
          "--error-border": "hsl(var(--destructive))",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "group toast rounded-lg font-sans shadow-none",
          title: "text-sm font-medium text-foreground",
          description: "text-[13px] text-muted-foreground",
          actionButton: "bg-secondary text-secondary-foreground",
          cancelButton: "bg-muted text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
