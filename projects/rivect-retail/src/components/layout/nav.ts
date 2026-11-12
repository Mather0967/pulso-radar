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
  { to: '/overview', label: 'Overview', description: 'Resumen ejecutivo', icon: LayoutDashboard },
  { to: '/simulator', label: 'Business Simulator', description: 'Tiempo y margen', icon: Gauge },
  { to: '/assistant', label: 'Sales Assistant', description: 'Vendedor virtual', icon: MessagesSquare },
  { to: '/recovery', label: 'Customer Recovery', description: 'Oportunidades', icon: HeartHandshake },
  { to: '/stock', label: 'Stock Intelligence', description: 'Inventario', icon: Boxes },
  { to: '/campaigns', label: 'Smart Campaigns', description: 'Marketing', icon: Megaphone },
  { to: '/report', label: 'Impact Report', description: 'Informe final', icon: FileText },
]
