import { calculateRecoveryMetrics, RECOVERY_STATUS_META } from '@/domain/calculations/recovery'
import type {
  Product,
  RecoveryLead,
  RecoveryMetrics,
  RecoveryStatus,
  StoreProfile,
} from '@/domain/models'
import { money } from '@/utils/format'

export function buildRecovery(leads: RecoveryLead[], contributionMargin: number): RecoveryMetrics {
  return calculateRecoveryMetrics(leads, contributionMargin)
}

export function suggestionFor(status: RecoveryStatus): string {
  switch (status) {
    case 'consulta-nueva':
      return 'Responder la consulta y confirmar disponibilidad.'
    case 'interesado':
      return 'Enviar opciones de pago y proponer reserva por 24 h.'
    case 'pendiente-respuesta':
      return 'Reenviar información con una alternativa con stock.'
    case 'seguimiento-pendiente':
      return 'Retomar la conversación con una propuesta concreta.'
    case 'recuperado':
      return 'Coordinar la compra y ofrecer un complemento.'
    case 'compra-realizada':
      return 'Pedir reseña y ofrecer reposición futura.'
    case 'no-interesado':
      return 'Recontactar en la próxima campaña de temporada.'
  }
}

/** Mensaje de seguimiento sugerido (solo vista previa, no se envía). */
export function buildFollowUpMessage(
  lead: RecoveryLead,
  product: Product | undefined,
  profile: StoreProfile,
): string {
  const productName = product?.name ?? 'el producto que consultaste'
  const price = product ? ` a ${money(product.price)}` : ''
  switch (lead.status) {
    case 'compra-realizada':
      return `¡Hola ${lead.customerName.split(' ')[0]}! Gracias por tu compra de ${productName}. ¿Querés que te cuente sobre los cuidados del material?`
    case 'recuperado':
      return `¡Hola ${lead.customerName.split(' ')[0]}! Te guardamos ${productName}${price}. ¿Coordinamos la entrega por ${lead.channel}?`
    case 'no-interesado':
      return `¡Hola ${lead.customerName.split(' ')[0]}! Llegó nueva reposición de ${productName}${price}. Si te interesa, te reservo una unidad.`
    case 'pendiente-respuesta':
      return `¡Hola ${lead.customerName.split(' ')[0]}! Seguimos con tu consulta por ${productName}${price}. Ahora tenemos stock disponible: ¿te lo reservo?`
    default:
      return `¡Hola ${lead.customerName.split(' ')[0]}! Soy del equipo de ${profile.name}. Sobre ${productName}${price}: tengo disponibilidad y puedo reservártelo hoy. ¿Te sirve?`
  }
}

export const statusLabel = (status: RecoveryStatus): string => RECOVERY_STATUS_META[status].label
