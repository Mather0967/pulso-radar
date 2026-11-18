import { describe, expect, it } from 'vitest'
import productsSeed from '@/data/products.json'
import profileSeed from '@/data/store-profile.json'
import type { Product, StoreProfile } from '@/domain/models'
import { createAssistantReply, type AssistantContextState } from '@/services/assistant/engine'
import { money } from '@/utils/format'

const products = productsSeed as unknown as Product[]
const profile = profileSeed as unknown as StoreProfile
const empty: AssistantContextState = { lastProductIds: [], lastCategory: null }

const ask = (
  text: string,
  context: AssistantContextState = empty,
  history: string[] = [],
  storeProfile: StoreProfile = profile,
) => createAssistantReply({ text, products, profile: storeProfile, context, history })

/** Promesas que el perfil del comercio no respalda: el asistente nunca debe decirlas. */
const INVENTED = [
  /todo el pa[ií]s/i,
  /sin cargo/i,
  /env[ií]o gratis/i,
  /d[ií]as h[aá]biles/i,
  /incluyen impuestos/i,
  /cuotas sin inter[eé]s/i,
  /aceptamos/i,
  /v[aá]lida por 24/i,
  /suele agotarse/i,
]

const expectNoInventions = (text: string) => {
  for (const pattern of INVENTED) expect(text).not.toMatch(pattern)
}

describe('asistente: no inventa políticas', () => {
  it('envíos al interior: no promete nada y lo consulta con el equipo', () => {
    const reply = ask('¿Hacen envíos al interior?')
    expect(reply.intent).toBe('envio')
    expect(reply.text).not.toContain('$')
    expect(reply.text).toMatch(/consulto con el equipo/)
    expect(reply.resolved).toBe(false)
    expect(reply.quickReplies).toContain('Hablar con una persona')
    expectNoInventions(reply.text)
  })

  it('«¿Cuánto sale con tarjeta?» es una consulta de pago, sin productos al azar', () => {
    const reply = ask('¿Cuánto sale con tarjeta?')
    expect(reply.intent).toBe('pago')
    expect(reply.products).toHaveLength(0)
    expect(reply.resolved).toBe(false)
    expectNoInventions(reply.text)
  })

  it('pago con un producto en contexto: da el precio de catálogo y no inventa condiciones', () => {
    const reply = ask('¿Y en cuotas con tarjeta?', { lastProductIds: ['p02'], lastCategory: 'Zapatillas' })
    expect(reply.intent).toBe('pago')
    expect(reply.text).toContain('Zapatillas Running Nova Negra')
    expect(reply.text).toContain(money(89900))
    expect(reply.text).toMatch(/consulto con el equipo/)
    expectNoInventions(reply.text)
  })

  it('impuestos: no afirma que los precios los incluyen', () => {
    const reply = ask('¿Los precios incluyen IVA?')
    expect(reply.intent).toBe('impuestos')
    expect(reply.resolved).toBe(false)
    expectNoInventions(reply.text)
  })

  it('precio sin modelo identificable: pregunta cuál, no devuelve productos', () => {
    const reply = ask('¿Cuánto sale?')
    expect(reply.intent).toBe('precio')
    expect(reply.products).toHaveLength(0)
    expect(reply.text).toMatch(/qué modelo/i)
  })

  it('precio de un modelo concreto: usa el precio del catálogo', () => {
    const reply = ask('¿Cuánto sale la Running Nova azul?')
    expect(reply.intent).toBe('precio')
    expect(reply.products.map((p) => p.productId)).toContain('p01')
    expect(reply.text).toContain(money(89900))
    expectNoInventions(reply.text)
  })

  it('horarios: repite exactamente los del perfil', () => {
    const reply = ask('¿A qué hora abren?')
    expect(reply.intent).toBe('horario')
    expect(reply.text).toContain(profile.operatingHours)
  })

  it('horarios sin cargar en el perfil: lo consulta con el equipo', () => {
    const reply = ask('¿A qué hora abren?', empty, [], { ...profile, operatingHours: '' })
    expect(reply.resolved).toBe(false)
    expect(reply.text).toMatch(/consulto con el equipo/)
  })

  it('reserva: queda pendiente del equipo, sin plazo inventado', () => {
    const reply = ask('Quiero reservar las zapatillas negras talle 42')
    expect(reply.reserved).toBe(true)
    expect(reply.text).toMatch(/pendiente de confirmación del equipo/)
    expectNoInventions(reply.text)
  })

  it('ninguna respuesta habitual contiene promesas inventadas', () => {
    const questions = [
      'Hola',
      '¿Qué me recomiendan?',
      '¿Tienen algo más económico?',
      'Zapatillas negras talle 42',
      '¿Hacen envíos?',
      '¿Aceptan transferencia?',
      '¿Puedo pagar en efectivo?',
      '¿Hay otros modelos?',
      'gracias',
      'qwerty',
    ]
    for (const q of questions) expectNoInventions(ask(q).text)
  })
})

describe('asistente: derivación a una persona', () => {
  it('«Quiero hablar con una persona» deriva con el contexto de la charla', () => {
    const context: AssistantContextState = { lastProductIds: ['p02'], lastCategory: 'Zapatillas' }
    const history = ['Zapatillas negras talle 42', '¿Hacen envíos al interior?']
    const reply = ask('Quiero hablar con una persona', context, history)
    expect(reply.intent).toBe('derivacion')
    expect(reply.handoff).toBe(true)
    expect(reply.resolved).toBe(false)
    expect(reply.text).toContain(profile.name)
    expect(reply.text).toContain('«Zapatillas negras talle 42»')
    expect(reply.text).toContain('«¿Hacen envíos al interior?»')
    expect(reply.text).toContain('Zapatillas Running Nova Negra')
    expect(reply.text).toMatch(/no se envía ningún mensaje real/)
  })

  it('sin historial: deriva igual y lo aclara', () => {
    const reply = ask('Necesito un vendedor')
    expect(reply.handoff).toBe(true)
    expect(reply.text).toMatch(/Todavía no hay consultas previas/)
  })

  it('cambios y devoluciones se derivan al equipo', () => {
    const reply = ask('¿Puedo hacer un cambio de talle?')
    expect(reply.intent).toBe('politica')
    expect(reply.handoff).toBe(true)
    expectNoInventions(reply.text)
  })

  it('las búsquedas normales no se derivan', () => {
    const reply = ask('Zapatillas negras talle 42')
    expect(reply.intent).not.toBe('derivacion')
    expect(reply.handoff).toBe(false)
  })
})
