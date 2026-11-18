import products from '@/data/products.json'
import customers from '@/data/customers.json'
import conversations from '@/data/conversations.json'
import recoveryLeads from '@/data/recovery-leads.json'
import campaigns from '@/data/campaigns.json'

export type LiveEventKind = 'pedido' | 'mensaje' | 'stock' | 'recuperado' | 'campana'

export interface LiveEvent {
  id: number
  kind: LiveEventKind
  title: string
  detail: string
  amount?: number
}

const KINDS: readonly LiveEventKind[] = ['pedido', 'mensaje', 'stock', 'recuperado', 'campana']

// team: el perfil del comercio no tiene ese dato, así que el asistente lo deriva al equipo.
const QUESTIONS: readonly { text: string; team: boolean }[] = [
  { text: '¿Tienen talle M?', team: false },
  { text: '¿Hacen envíos al interior?', team: true },
  { text: '¿Tienen en otro color?', team: false },
  { text: '¿Cuánto sale con tarjeta?', team: true },
  { text: '¿Me lo reservan hasta el sábado?', team: true },
  { text: '¿Está disponible para retirar hoy?', team: true },
  { text: '¿Tienen el mismo modelo en talle 40?', team: false },
]

const LOW_STOCK = products.filter((p) => p.stock <= p.minStock)
const ACTIVE_LEADS = recoveryLeads.filter((l) => l.status !== 'no-interesado')

/** "Lucía Fernández" -> "Lucía F." */
function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length < 2) return parts[0] ?? fullName
  return `${parts[0]} ${parts[parts.length - 1][0]}.`
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName
}

function pick<T>(list: readonly T[], n: number): T {
  return list[((n % list.length) + list.length) % list.length]
}

function pedidoAt(index: number, round: number): LiveEvent {
  const customer = pick(customers, index * 5 + 3)
  const product = pick(products, index * 7 + 1)
  const qty = 1 + (index % 3)
  return {
    id: index,
    kind: 'pedido',
    title: `Pedido #${1040 + index}`,
    detail: `${shortName(customer.name)} · ${qty} × ${product.name}`,
    amount: product.price * qty,
  }
}

function mensajeAt(index: number, round: number): LiveEvent {
  const conv = pick(conversations, round * 3 + 1)
  const question = pick(QUESTIONS, index)
  const seconds = 2 + ((index * 3) % 8)
  return {
    id: index,
    kind: 'mensaje',
    title:
      conv.status === 'derivada'
        ? 'Chat derivado a un vendedor'
        : question.team
          ? 'Consulta derivada al equipo'
          : 'Consulta respondida',
    detail: `${firstName(conv.customerName)} · «${question.text}» · en ${seconds} s`,
  }
}

function stockAt(index: number, round: number): LiveEvent {
  const product = pick(LOW_STOCK, round + index)
  if (product.stock === 0) {
    return {
      id: index,
      kind: 'stock',
      title: 'Sin stock',
      detail: `${product.name} · reposición pedida al proveedor`,
    }
  }
  return {
    id: index,
    kind: 'stock',
    title: 'Stock bajo',
    detail: `${product.name} · quedan ${product.stock}`,
  }
}

function recuperadoAt(index: number, round: number): LiveEvent {
  const lead = pick(ACTIVE_LEADS, round * 2 + 1)
  const product = products.find((p) => p.id === lead.productId)
  return {
    id: index,
    kind: 'recuperado',
    title: 'Venta recuperada',
    detail: `${firstName(lead.customerName)} · ${product?.name ?? 'Compra'} · vía ${lead.channel}`,
    amount: lead.estimatedTicket,
  }
}

function campanaAt(index: number, round: number): LiveEvent {
  const campaign = pick(campaigns, round)
  return {
    id: index,
    kind: 'campana',
    title: 'Campaña programada',
    detail: `${campaign.name} · ${campaign.recipients} clientes · ${campaign.discountPct}% off`,
  }
}

/**
 * Deterministic live-feed event for a given index. Same index always yields the
 * same event; `id` equals `index`. Kinds cycle through a fixed, varied order in
 * which every block of 5 consecutive events contains all five kinds.
 */
export function liveEventAt(index: number): LiveEvent {
  const round = Math.floor(index / 5)
  const kind = KINDS[(index * 3 + round) % KINDS.length]
  switch (kind) {
    case 'pedido':
      return pedidoAt(index, round)
    case 'mensaje':
      return mensajeAt(index, round)
    case 'stock':
      return stockAt(index, round)
    case 'recuperado':
      return recuperadoAt(index, round)
    case 'campana':
      return campanaAt(index, round)
  }
}

/** Deterministic delay before the event at `index` appears, in ms, within [4000, 8000]. */
export function nextDelayMs(index: number): number {
  return 4000 + ((index * 1373 + 7) % 4001)
}
