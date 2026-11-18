import type {
  AssistantProductRef,
  AssistantReply,
  Product,
  StoreProfile,
} from '@/domain/models'
import { money } from '@/utils/format'

export interface AssistantContextState {
  lastProductIds: string[]
  lastCategory: string | null
}

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const COLORS = [
  'negro',
  'negra',
  'blanco',
  'blanca',
  'azul',
  'gris',
  'verde',
  'rojo',
  'roja',
  'beige',
  'marron',
  'rosa',
  'crema',
  'arena',
  'dorado',
  'plateado',
  'violeta',
]

/** Sinónimos por categoría: el motor de demo entiende lenguaje de tienda. */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Zapatillas: [
    'zapatilla',
    'zapatillas',
    'zapa',
    'zapas',
    'tenis',
    'sneaker',
    'sneakers',
    'running',
    'runner',
    'urbana',
    'urbanas',
    'deportiva',
    'deportivas',
    'skate',
    'basketball',
    'lona',
    'slip',
  ],
  Botines: ['botin', 'botines', 'bota', 'botas', 'trekking', 'outdoor'],
  Sandalias: ['sandalia', 'sandalias', 'ojota', 'ojotas'],
  Zapatos: ['zapato', 'zapatos', 'mocasin', 'mocasines', 'formal', 'formales', 'oxford', 'derby'],
  Accesorios: [
    'mochila',
    'bolso',
    'medias',
    'gorra',
    'plantilla',
    'plantillas',
    'cordones',
    'accesorio',
    'accesorios',
  ],
  Indumentaria: ['remera', 'buzo', 'campera', 'indumentaria', 'ropa'],
}

const COMPLEMENTS: Record<string, string> = {
  Zapatillas: 'Accesorios',
  Botines: 'Accesorios',
  Zapatos: 'Accesorios',
  Sandalias: 'Accesorios',
  Accesorios: 'Indumentaria',
  Indumentaria: 'Accesorios',
}

const INTENT_LABELS: Record<string, string> = {
  saludo: 'Saludo',
  busqueda: 'Búsqueda de producto',
  precio: 'Consulta de precio',
  colores: 'Consulta de colores',
  talles: 'Consulta de talles',
  alternativas: 'Alternativas',
  recomendacion: 'Recomendación',
  economico: 'Opciones económicas',
  reserva: 'Reserva simulada',
  envio: 'Consulta de envío',
  pago: 'Medios de pago',
  impuestos: 'Consulta de impuestos',
  politica: 'Cambios y devoluciones',
  derivacion: 'Derivación a una persona',
  horario: 'Horarios',
  agradecimiento: 'Cierre',
  fallback: 'Consulta general',
}

/** Palabras que no identifican un producto (evitan coincidencias falsas). */
const STOPWORDS = new Set([
  'que', 'cuanto', 'cuanta', 'sale', 'salen', 'cuesta', 'cuestan', 'esta', 'precio', 'precios',
  'la', 'el', 'los', 'las', 'un', 'una', 'de', 'del', 'con', 'en', 'por', 'para', 'me', 'mi',
  'tienen', 'hay', 'tenes', 'quiero', 'busco', 'hola', 'buenas', 'y', 'o', 'al', 'lo', 'le',
  'es', 'son', 'se', 'si', 'no', 'mas', 'muy', 'algo', 'otro', 'otra', 'ese', 'esa', 'este',
  'tarjeta', 'cuotas', 'efectivo', 'transferencia', 'debito', 'credito', 'pago', 'pagar',
])

interface Query {
  category: string | null
  color: string | null
  size: string | null
  tokens: string[]
}

function detectQuery(text: string): Query {
  const normalized = normalize(text)
  const tokens = normalized
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))

  let category: string | null = null
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => new RegExp(`\\b${k}\\b`).test(normalized))) {
      category = cat
      break
    }
  }

  const color = COLORS.find((c) => new RegExp(`\\b${c}\\b`).test(normalized)) ?? null

  const explicitSize = normalized.match(/(?:talle|talla|numero|nro\.?)\s*(2[89]|3[0-9]|4[0-6])\b/)
  const bareSize = normalized.match(/\b(2[89]|3[0-9]|4[0-6])\b/)
  const letterSize = normalized.match(/(?:talle|talla)\s*(xs|s|m|l|xl|xxl)\b/)
  const size = explicitSize?.[1] ?? letterSize?.[1]?.toUpperCase() ?? bareSize?.[1] ?? null

  return { category, color, size, tokens }
}

function variantStock(product: Product, query: Query): { label: string; stock: number } | null {
  if (!query.color && !query.size) return null
  const variant = product.variants.find((v) => {
    const colorOk = query.color ? normalize(v.name).includes(query.color) : true
    const sizeOk = query.size ? v.size.toLowerCase().includes(query.size.toLowerCase()) : true
    return colorOk && sizeOk
  })
  return variant ? { label: `${variant.name} · ${variant.size}`, stock: variant.stock } : null
}

function isAvailable(product: Product, query: Query): boolean {
  if (product.stock <= 0) return false
  const variant = variantStock(product, query)
  if (variant) return variant.stock > 0
  return product.stock > 0
}

function score(product: Product, query: Query): number {
  let value = 0
  if (query.category && product.category === query.category) value += 6
  if (query.color) {
    if (product.variants.some((v) => normalize(v.name).includes(query.color!))) value += 4
    else if (normalize(product.name).includes(query.color)) value += 2
  }
  if (query.size) {
    const variant = variantStock(product, query)
    if (variant) value += 5
    if (variant && variant.stock > 0) value += 3
  }
  const haystack = normalize(`${product.name} ${product.category} ${product.tags.join(' ')}`)
  for (const token of query.tokens) {
    if (haystack.includes(token)) value += 1
  }
  value += Math.min(3, product.monthlyUnitsSold / 25)
  return value
}

/** Coincidencia real con el catálogo (no solo popularidad). */
function matchesQuery(product: Product, query: Query): boolean {
  if (query.category && product.category === query.category) return true
  if (query.color && product.variants.some((v) => normalize(v.name).includes(query.color!))) return true
  const haystack = normalize(`${product.name} ${product.tags.join(' ')}`)
  return query.tokens.some((token) => token.length > 2 && new RegExp(`\\b${token}`).test(haystack))
}

const ref = (
  product: Product,
  reason: AssistantProductRef['reason'],
  variantLabel?: string,
): AssistantProductRef => ({ productId: product.id, reason, variant: variantLabel })

function complements(products: Product[], category: string | null): Product[] {
  const target = category ? COMPLEMENTS[category] ?? 'Accesorios' : 'Accesorios'
  return products
    .filter((p) => p.category === target && p.stock > 0)
    .sort((a, b) => b.monthlyUnitsSold - a.monthlyUnitsSold)
    .slice(0, 2)
}

function lineFor(product: Product, query: Query): string {
  const variant = variantStock(product, query)
  const stockText = variant
    ? variant.stock > 0
      ? `disponible (${variant.stock} u.)`
      : 'sin stock en esa combinación'
    : product.stock > 0
      ? `${product.stock} unidades`
      : 'sin stock'
  return `• *${product.name}* — ${money(product.price)} · ${stockText}`
}

/**
 * Motor de interpretación de intenciones de la demo.
 * Reglas determinísticas sobre el catálogo: no hay IA externa ni envío real.
 * Devuelve la respuesta y el contexto para la próxima consulta.
 */
export function createAssistantReply(input: {
  text: string
  products: Product[]
  profile: StoreProfile
  context: AssistantContextState
  /** Mensajes anteriores del cliente, para el resumen al derivar a una persona. */
  history?: string[]
}): AssistantReply & { nextContext: AssistantContextState } {
  const { products, profile, context } = input
  const history = input.history ?? []
  const raw = normalize(input.text)
  const query = detectQuery(input.text)

  const hasBuyingSignal = /(reserv|apart|senia|lo llevo|lo quiero|comprar|compro)/.test(raw)
  const hasGreeting = /^(hola|buenas|buen dia|hey|hola buenas)\b/.test(raw)

  let intent: string = 'fallback'
  if (
    /(persona|humano|vendedor|vendedora|encargad|asesor|operador|hablar con alguien|atencion personal)/.test(
      raw,
    )
  )
    intent = 'derivacion'
  else if (/(devoluc|devolver|cambio|cambiar|garantia|reclamo|fallad)/.test(raw)) intent = 'politica'
  else if (hasBuyingSignal) intent = 'reserva'
  else if (/(cuotas|tarjeta|transferencia|efectivo|debito|credito|medios? de pago|mercado ?pago)/.test(raw))
    intent = 'pago'
  else if (/(impuesto|iva\b|factura)/.test(raw)) intent = 'impuestos'
  else if (/(envio|envian|llega|domicilio|flete|interior|despacho)/.test(raw)) intent = 'envio'
  else if (/(cuanto (sale|cuesta|esta|salen|cuestan)|precio|sale el|sale la)/.test(raw)) intent = 'precio'
  else if (/(colores|de que color|hay en color)/.test(raw)) intent = 'colores'
  else if (/(talles|talle|numero|medidas|queda el)/.test(raw)) intent = 'talles'
  else if (/(economic|barat|menos plata|presupuesto|mas barato)/.test(raw)) intent = 'economico'
  else if (/(recomend|suger|que me conviene|que me recomendas)/.test(raw)) intent = 'recomendacion'
  else if (/(otro modelo|otros modelos|alternativa|algo parecido|similar|otra opcion)/.test(raw))
    intent = 'alternativas'
  else if (/(horario|abren|cierran|atienden|abierto)/.test(raw)) intent = 'horario'
  else if (/(gracias|genial|perfecto|dale)/.test(raw)) intent = 'agradecimiento'
  else if (query.category || query.color || query.size || /(tienen|hay|disponible|stock|quedan|busco)/.test(raw))
    intent = 'busqueda'
  else if (hasGreeting) intent = 'saludo'

  const base = query.category ? products.filter((p) => p.category === query.category) : products
  const ranked = [...base]
    .map((p) => ({ product: p, score: score(p, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.product)

  const available = ranked.filter((p) => isAvailable(p, query))
  const fallbackSet = available.length > 0 ? available : ranked
  const targets = fallbackSet.slice(0, 3)
  const contextProducts = context.lastProductIds
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is Product => Boolean(p))

  const finish = (
    text: string,
    productRefs: AssistantProductRef[],
    quickReplies: string[],
    resolved = true,
    reserved = false,
    nextCategory: string | null = query.category ?? context.lastCategory,
    handoff = false,
  ) => ({
    text,
    intent,
    handoff,
    products: productRefs,
    quickReplies,
    detected: [
      INTENT_LABELS[intent] ?? intent,
      ...(query.category ? [`Categoría: ${query.category}`] : []),
      ...(query.color ? [`Color: ${query.color}`] : []),
      ...(query.size ? [`Talle: ${query.size}`] : []),
    ],
    resolved,
    reserved,
    detectedProducts: productRefs
      .map((r) => products.find((p) => p.id === r.productId))
      .filter((p): p is Product => Boolean(p)),
    nextContext: {
      lastProductIds: productRefs.filter((r) => r.reason !== 'complemento').map((r) => r.productId),
      lastCategory: nextCategory,
    },
  })

  /** Lo que no está en el perfil ni en el catálogo no se inventa: se consulta al equipo. */
  const checkWithTeam = (topic: string, prefix = '') =>
    finish(
      `${prefix}No tengo información confirmada sobre ${topic} de ${profile.name}. Para no darte un dato equivocado, lo consulto con el equipo y te responden por este chat.\n\n¿Querés que te pase ahora con una persona?`,
      contextProducts.slice(0, 1).map((p) => ref(p, 'consulta')),
      ['Hablar con una persona', '¿Qué me recomiendan?', 'Ver zapatillas'],
      false,
    )

  if (intent === 'derivacion' || intent === 'politica') {
    const previous = history.filter((h) => normalize(h) !== raw).slice(-3)
    const summary = [
      ...(previous.length > 0
        ? [`• Consultas: ${previous.map((h) => `«${h}»`).join(', ')}`]
        : []),
      ...(intent === 'politica' ? [`• Motivo: «${input.text}»`] : []),
      ...(contextProducts.length > 0
        ? [`• Productos vistos: ${contextProducts.map((p) => p.name).join(', ')}`]
        : []),
      ...(context.lastCategory ? [`• Categoría de interés: ${context.lastCategory}`] : []),
    ]
    const intro =
      intent === 'politica'
        ? `Los cambios, devoluciones y garantías los resuelve el equipo de ${profile.name}, así que te paso con una persona.`
        : `Te paso con una persona del equipo de ${profile.name}.`
    return finish(
      `${intro} Le dejo este resumen para que no tengas que repetir nada:\n\n${
        summary.length > 0 ? summary.join('\n') : '• Todavía no hay consultas previas en esta conversación.'
      }\n\nTe responden por este mismo chat. (Demo: no se envía ningún mensaje real.)`,
      contextProducts.map((p) => ref(p, 'consulta')),
      [],
      false,
      false,
      context.lastCategory,
      true,
    )
  }

  if (intent === 'envio') return checkWithTeam('envíos y costos de entrega')
  if (intent === 'impuestos') return checkWithTeam('impuestos y facturación')

  if (intent === 'pago') {
    const product = contextProducts[0] ?? available.find((p) => matchesQuery(p, query))
    const prefix = product
      ? `El precio de catálogo de *${product.name}* es ${money(product.price)}. `
      : ''
    return checkWithTeam('medios de pago, cuotas y recargos', prefix)
  }

  if (intent === 'saludo') {
    return finish(
      `¡Hola! Soy el asistente virtual de ${profile.name}. Puedo buscar por categoría, color o talle, comparar precios y reservar productos del catálogo.\n\n¿Qué querés ver primero?`,
      [],
      ['Zapatillas negras talle 42', '¿Qué me recomiendan?', '¿Tienen algo más económico?'],
    )
  }

  if (intent === 'reserva') {
    const product = contextProducts[0] ?? targets[0]
    if (!product) {
      return finish(
        'Decime qué modelo te interesa y te lo reservo en la simulación. Podés escribir, por ejemplo: «reservar zapatillas negras talle 42».',
        [],
        ['Zapatillas negras talle 42', '¿Qué me recomiendan?'],
      )
    }
    const variant = variantStock(product, query)
    const variantLabel =
      variant?.label ??
      `${product.variants[0]?.name ?? 'Estándar'} · ${product.variants[0]?.size ?? 'Único'}`
    return finish(
      `Listo, dejé una *reserva simulada* de:\n\n• *${product.name}* — ${variantLabel}\n• Precio: ${money(product.price)}\n\nLa reserva queda pendiente de confirmación del equipo. En la demo no se envía ningún mensaje real ni se descuenta stock.\n\n¿Querés que te muestre algo complementario?`,
      [ref(product, 'consulta', variantLabel)],
      ['Sí, mostrame algo más', '¿Cuánto cuesta?', '¿Hacen envíos?'],
      true,
      true,
    )
  }

  if (intent === 'economico') {
    const pool = query.category ? products.filter((p) => p.category === query.category) : products
    const sorted = [...pool].sort((a, b) => a.price - b.price).filter((p) => p.stock > 0)
    const cheapest = sorted.slice(0, 3)
    if (cheapest.length === 0) {
      return finish(
        'En este momento no tengo opciones con stock en esa categoría. Puedo avisarte cuando ingrese reposición.',
        [],
        ['¿Qué me recomiendan?', 'Ver zapatillas'],
      )
    }
    return finish(
      `Estas son las opciones más económicas con stock disponible:\n\n${cheapest
        .map((p) => lineFor(p, query))
        .join('\n')}\n\n¿Te muestro también los modelos de mayor rotación?`,
      cheapest.map((p) => ref(p, 'recomendacion')),
      ['¿Qué me recomiendan?', '¿Puedo reservar?', '¿Qué colores tienen?'],
    )
  }

  if (intent === 'colores') {
    const pool = targets.length > 0 ? targets : contextProducts
    if (pool.length === 0) {
      return finish(
        'Decime qué modelo te interesa y te paso los colores disponibles.',
        [],
        ['Zapatillas negras talle 42', 'Ver catálogo'],
      )
    }
    const lines = pool.map((product) => {
      const colors = [...new Set(product.variants.map((v) => v.name))]
      return `• *${product.name}*: ${colors.join(', ')}`
    })
    return finish(
      `Estos son los colores disponibles:\n\n${lines.join('\n')}\n\n¿Querés que te muestre uno en particular?`,
      pool.map((p) => ref(p, 'consulta')),
      ['¿Tienen talle 42?', '¿Cuánto cuesta?', '¿Puedo reservar?'],
    )
  }

  if (intent === 'talles') {
    const pool = targets.length > 0 ? targets : contextProducts
    if (pool.length === 0) {
      return finish(
        'Contame qué modelo buscás y te confirmo los talles con stock.',
        [],
        ['Zapatillas negras talle 42', '¿Qué me recomiendan?'],
      )
    }
    const lines = pool.map((product) => {
      const sizes = product.variants
        .filter((v) => v.stock > 0)
        .map((v) => `${v.size} (${v.name})`)
      return `• *${product.name}*: ${sizes.length > 0 ? sizes.join(', ') : 'sin talles disponibles'}`
    })
    return finish(
      `Talles con stock:\n\n${lines.join('\n')}\n\nSi tu talle no aparece, puedo ofrecerte un modelo similar.`,
      pool.map((p) => ref(p, 'consulta')),
      ['¿Hay otros modelos?', '¿Puedo reservar?', '¿Tienen algo más económico?'],
    )
  }

  if (intent === 'recomendacion') {
    const recommended = [...products]
      .filter((p) => p.stock > 0)
      .sort((a, b) => b.monthlyUnitsSold - a.monthlyUnitsSold)
      .slice(0, 3)
    const extras = complements(products, query.category ?? recommended[0]?.category ?? null).slice(0, 1)
    return finish(
      `Según lo más vendido del último mes (datos de ejemplo), te recomiendo:\n\n${[...recommended, ...extras]
        .map((p) => lineFor(p, query))
        .join('\n')}\n\nEl primero es el de mayor rotación.`,
      [
        ...recommended.map((p) => ref(p, 'recomendacion')),
        ...extras.map((p) => ref(p, 'complemento')),
      ],
      ['¿Cuánto cuesta?', '¿Tienen talle 42?', '¿Puedo reservar?'],
    )
  }

  if (intent === 'alternativas') {
    const excluded = new Set(context.lastProductIds)
    const pool = (query.category ? products.filter((p) => p.category === query.category) : products)
      .filter((p) => !excluded.has(p.id) && p.stock > 0)
      .sort((a, b) => b.monthlyUnitsSold - a.monthlyUnitsSold)
      .slice(0, 3)
    const extras = complements(products, query.category ?? context.lastCategory).slice(0, 2)
    if (pool.length === 0 && extras.length === 0) {
      return finish(
        'No tengo alternativas con stock en este momento. Puedo avisarte cuando ingrese mercadería.',
        [],
        ['Ver zapatillas', '¿Qué me recomiendan?'],
      )
    }
    return finish(
      `Otras opciones que pueden servirte:\n\n${pool.map((p) => lineFor(p, query)).join('\n')}${
        extras.length > 0
          ? `\n\nPara completar el pedido:\n${extras.map((p) => lineFor(p, query)).join('\n')}`
          : ''
      }`,
      [...pool.map((p) => ref(p, 'alternativa')), ...extras.map((p) => ref(p, 'complemento'))],
      ['¿Puedo reservar?', '¿Cuánto cuesta?', '¿Tienen algo más económico?'],
    )
  }

  if (intent === 'precio') {
    const matched = available.filter((p) => matchesQuery(p, query)).slice(0, 3)
    const pool = matched.length > 0 ? matched : contextProducts
    if (pool.length === 0) {
      return finish(
        '¿De qué modelo querés saber el precio? Decime el nombre, la categoría o el color y te paso el precio de catálogo.',
        [],
        ['Zapatillas negras talle 42', '¿Qué me recomiendan?', '¿Tienen algo más económico?'],
        false,
      )
    }
    return finish(
      `Precios de catálogo:\n\n${pool.map((p) => lineFor(p, query)).join('\n')}\n\n¿Querés que te reserve alguno?`,
      pool.map((p) => ref(p, 'consulta')),
      ['¿Puedo reservar?', '¿Tienen algo más económico?', 'Hablar con una persona'],
    )
  }

  if (intent === 'horario') {
    if (!profile.operatingHours.trim()) return checkWithTeam('los horarios de atención')
    return finish(
      `Nuestro horario es ${profile.operatingHours}. Fuera de ese horario, el asistente puede responder consultas de catálogo y tomar reservas simuladas.`,
      [],
      ['¿Qué me recomiendan?', 'Ver zapatillas'],
    )
  }

  if (intent === 'agradecimiento') {
    return finish(
      '¡Gracias a vos! Si necesitás algo más, escribime. Cuando quieras coordinamos la reserva.',
      [],
      ['Ver zapatillas', '¿Qué me recomiendan?'],
    )
  }

  if (intent === 'busqueda') {
    if (available.length > 0) {
      const top = available.slice(0, 3)
      const variant = variantStock(top[0], query)
      const detail = variant
        ? `Tenemos la combinación ${variant.label} con ${variant.stock} unidades.`
        : top[0].stock > 0
          ? `Quedan ${top[0].stock} unidades.`
          : ''
      return finish(
        `¡Sí! Encontré esto para vos:\n\n${top.map((p) => lineFor(p, query)).join('\n')}\n\n${detail}\n¿Querés que te lo reserve?`,
        top.map((p) => ref(p, 'consulta', variant?.label)),
        ['¿Puedo reservar?', '¿Qué colores tienen?', '¿Hay otros modelos?'],
      )
    }

    if (ranked.length > 0) {
      const alternatives = ranked.filter((p) => p.stock > 0).slice(0, 3)
      if (alternatives.length > 0) {
        return finish(
          `No me queda stock de esa combinación exacta, pero tengo estas alternativas:\n\n${alternatives
            .map((p) => lineFor(p, query))
            .join('\n')}\n\n¿Te sirve alguna?`,
          alternatives.map((p) => ref(p, 'alternativa')),
          ['¿Puedo reservar?', '¿Cuánto cuesta?', '¿Qué me recomiendan?'],
        )
      }
      return finish(
        'Ese modelo está sin stock en todas sus variantes. Puedo avisarte cuando ingrese reposición o mostrarte modelos similares.',
        [],
        ['¿Hay otros modelos?', '¿Qué me recomiendan?'],
      )
    }

    const popular = [...products]
      .filter((p) => p.stock > 0)
      .sort((a, b) => b.monthlyUnitsSold - a.monthlyUnitsSold)
      .slice(0, 3)
    return finish(
      `No encontré ese producto en el catálogo. Estas son las opciones más consultadas:\n\n${popular
        .map((p) => lineFor(p, query))
        .join('\n')}\n\n¿A qué categoría te referías?`,
      popular.map((p) => ref(p, 'recomendacion')),
      ['Ver zapatillas', 'Ver accesorios', '¿Qué me recomiendan?'],
      false,
    )
  }

  return finish(
    'Puedo ayudarte con búsquedas por categoría, color y talle, comparar precios, recomendar alternativas y simular reservas.\n\nProbá con: «zapatillas negras talle 42» o «¿tienen botines marrones?».',
    [],
    ['Zapatillas negras talle 42', '¿Qué me recomiendan?', 'Hablar con una persona'],
    false,
  )
}
