import type { RecoveryLead, RecoveryMetrics, RecoveryStatus } from '../models'

export const RECOVERY_STATUS_META: Record<
  RecoveryStatus,
  { label: string; tone: string; order: number }
> = {
  'consulta-nueva': { label: 'Consulta nueva', tone: 'brand', order: 0 },
  interesado: { label: 'Interesado', tone: 'mint', order: 1 },
  'pendiente-respuesta': { label: 'Pendiente de respuesta', tone: 'amber', order: 2 },
  'seguimiento-pendiente': { label: 'Seguimiento pendiente', tone: 'amber', order: 3 },
  recuperado: { label: 'Recuperado', tone: 'brand', order: 4 },
  'compra-realizada': { label: 'Compra realizada', tone: 'mint', order: 5 },
  'no-interesado': { label: 'No interesado', tone: 'neutral', order: 6 },
}

export const RECOVERY_STATUSES: RecoveryStatus[] = (
  Object.keys(RECOVERY_STATUS_META) as RecoveryStatus[]
).sort((a, b) => RECOVERY_STATUS_META[a].order - RECOVERY_STATUS_META[b].order)

const OPEN_STATUSES: RecoveryStatus[] = [
  'consulta-nueva',
  'interesado',
  'pendiente-respuesta',
  'seguimiento-pendiente',
  'recuperado',
]

/**
 * Métricas del CRM de recuperación.
 *
 *   pipelineValue   = Σ estimatedTicket de oportunidades abiertas
 *   expectedValue   = Σ estimatedTicket × (estimatedConversion / 100)
 *   recoveredRevenue = Σ estimatedTicket de compras realizadas
 *   recoveredContribution = recoveredRevenue × (contributionMargin / 100)
 *
 * Todo es hipotético: los tickets provienen de datos simulados.
 */
export function calculateRecoveryMetrics(
  leads: RecoveryLead[],
  contributionMargin: number,
): RecoveryMetrics {
  const margin = Math.min(100, Math.max(0, contributionMargin)) / 100
  const open = leads.filter((l) => OPEN_STATUSES.includes(l.status))
  const wonLeads = leads.filter((l) => l.status === 'compra-realizada')

  const pipelineValue = open.reduce((acc, l) => acc + l.estimatedTicket, 0)
  const expectedValue = open.reduce(
    (acc, l) => acc + l.estimatedTicket * (Math.min(100, Math.max(0, l.estimatedConversion)) / 100),
    0,
  )
  const recoveredRevenue = wonLeads.reduce((acc, l) => acc + l.estimatedTicket, 0)

  const funnel = RECOVERY_STATUSES.map((status) => {
    const group = leads.filter((l) => l.status === status)
    return {
      status,
      label: RECOVERY_STATUS_META[status].label,
      count: group.length,
      value: group.reduce((acc, l) => acc + l.estimatedTicket, 0),
    }
  })

  return {
    total: leads.length,
    open: open.length,
    withoutFollowUp: leads.filter(
      (l) => l.status === 'seguimiento-pendiente' || l.status === 'pendiente-respuesta',
    ).length,
    recovered: leads.filter((l) => l.status === 'recuperado').length,
    won: wonLeads.length,
    lost: leads.filter((l) => l.status === 'no-interesado').length,
    pipelineValue,
    expectedValue,
    recoveredRevenue,
    recoveredContribution: recoveredRevenue * margin,
    conversionRate: leads.length > 0 ? (wonLeads.length / leads.length) * 100 : 0,
    funnel,
  }
}

/** Probabilidad sugerida cuando la tienda simula avanzar un lead de estado. */
export function suggestedConversion(status: RecoveryStatus): number {
  switch (status) {
    case 'consulta-nueva':
      return 35
    case 'interesado':
      return 55
    case 'pendiente-respuesta':
      return 45
    case 'seguimiento-pendiente':
      return 40
    case 'recuperado':
      return 70
    case 'compra-realizada':
      return 100
    case 'no-interesado':
      return 0
  }
}
