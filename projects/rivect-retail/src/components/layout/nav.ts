import {
  Boxes,
  FileText,
  Gauge,
  HeartHandshake,
  LayoutDashboard,
  Megaphone,
  MessagesSquare,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  description: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/overview', label: 'Resumen', description: 'Resumen ejecutivo', icon: LayoutDashboard },
  { to: '/simulator', label: 'Simulador de negocio', description: 'Tiempo y margen', icon: Gauge },
  { to: '/assistant', label: 'Asistente de ventas', description: 'Vendedor virtual', icon: MessagesSquare },
  { to: '/recovery', label: 'Recuperación de clientes', description: 'Oportunidades', icon: HeartHandshake },
  { to: '/stock', label: 'Control de stock', description: 'Inventario', icon: Boxes },
  { to: '/campaigns', label: 'Campañas inteligentes', description: 'Marketing', icon: Megaphone },
  { to: '/report', label: 'Informe de impacto', description: 'Informe final', icon: FileText },
]
