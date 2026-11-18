export type SceneSlug =
  | 'apertura'
  | 'problema'
  | 'asistente'
  | 'recuperacion'
  | 'stock'
  | 'campanas'
  | 'impacto'

export interface SceneNotify {
  title: string
  message: string
}

export interface SceneStep {
  caption: string
  notify?: SceneNotify
}

export interface Scene {
  n: number
  slug: SceneSlug
  label: string
  title: string
  tagline: string
  notes: string[]
  steps: SceneStep[]
}

// Datos de demo: todo lo que se muestra es un ejemplo, no resultados reales.
export const scenes: Scene[] = [
  {
    n: 1,
    slug: 'apertura',
    label: 'Apertura',
    title: 'Un día en tu comercio',
    tagline: 'Ver todo lo que pasa en tu tienda en una sola pantalla, sin perder tiempo buscando datos.',
    notes: [
      'Arrancá preguntando cómo es un día típico en su local: pedidos, consultas y stock.',
      'Dejá claro que todo lo que se muestra usa datos de ejemplo.',
      'Anticipá que vamos a recorrer los problemas más comunes y cómo se resuelven.',
    ],
    steps: [
      { caption: 'Así arranca cualquier día: consultas, pedidos y stock al mismo tiempo.' },
      { caption: 'Todo se ve en un solo lugar, en tiempo real (datos de ejemplo).' },
      { caption: 'Hoy vamos a ver cómo se ahorra tiempo y se recupera venta.' },
    ],
  },
  {
    n: 2,
    slug: 'problema',
    label: 'El problema',
    title: 'Horas y plata que se escapan',
    tagline:
      'Las tareas repetitivas se comen tu día, y las consultas que no atendés a tiempo se pierden como venta.',
    notes: [
      'Preguntá cuántas horas por semana se van en responder siempre las mismas consultas.',
      'Usá el simulador para mostrar cuánto se pierde con consultas sin respuesta, en este ejemplo.',
      'No prometas cifras: son estimaciones que el cliente puede ajustar con sus números.',
    ],
    steps: [
      { caption: 'Las mismas preguntas, todos los días, a toda hora.' },
      { caption: 'Simulador: horas de atención y ventas sin respuesta (ejemplo).' },
      { caption: 'Ajustá los supuestos con tus números reales.' },
    ],
  },
  {
    n: 3,
    slug: 'asistente',
    label: 'Asistente',
    title: 'Vendés también cuando cerrás',
    tagline:
      'Un asistente responde las consultas de tus clientes las 24 horas, en segundos y con la info de tu catálogo.',
    notes: [
      'Mostrá una consulta típica del rubro, como envíos o horarios.',
      'Aclará que el asistente deriva a una persona cuando la consulta es compleja.',
      'Preguntá por qué canales les llegan consultas hoy: WhatsApp, Instagram, web.',
    ],
    steps: [
      { caption: 'Llega una consulta fuera de horario.' },
      {
        caption: 'El asistente responde con datos del catálogo y del stock.',
        notify: {
          title: 'Nuevo mensaje',
          message: '«¿Hacen envíos al interior?» respondido en 3 s',
        },
      },
      { caption: 'Si la consulta es compleja, pasa a una persona con todo el contexto.' },
    ],
  },
  {
    n: 4,
    slug: 'recuperacion',
    label: 'Recuperación',
    title: 'Recuperá clientes que dejaron de comprar',
    tagline:
      'Detectá a quienes hace tiempo no compran y reactivalos con un mensaje pensado para cada grupo.',
    notes: [
      'Explicá la lógica: se identifican clientes inactivos según su historial de compras.',
      'Mostrá el listado de ejemplo y cómo se agrupa por último pedido.',
      'Enfatizá que el mensaje lo aprueba el comerciante antes de enviarse.',
    ],
    steps: [
      { caption: 'Clientes que compraban seguido y dejaron de hacerlo.' },
      { caption: 'Se los agrupa por tiempo sin comprar y valor histórico.' },
      {
        caption: 'Se propone un mensaje de reactivación para cada grupo.',
        notify: {
          title: 'Campaña lista',
          message: '12 clientes inactivos listos para reactivar (ejemplo)',
        },
      },
    ],
  },
  {
    n: 5,
    slug: 'stock',
    label: 'Stock',
    title: 'Sabé qué reponer antes de quedarte sin nada',
    tagline:
      'Alertas de stock bajo y sugerencias de reposición basadas en lo que realmente se vende.',
    notes: [
      'Preguntá qué productos les generan más quiebres de stock hoy.',
      'Mostrá la alerta de un producto de alta rotación, en este ejemplo.',
      'Recordá que la sugerencia de compra es orientativa; la decide el comerciante.',
    ],
    steps: [
      { caption: 'Stock actual de los productos de mayor rotación.' },
      {
        caption: 'Alerta: un producto está por debajo del mínimo.',
        notify: {
          title: 'Stock bajo',
          message: 'Yerba 1 kg: quedan 6 unidades (ejemplo)',
        },
      },
      { caption: 'Sugerencia de reposición según la venta de las últimas semanas.' },
    ],
  },
  {
    n: 6,
    slug: 'campanas',
    label: 'Campañas',
    title: 'Mensajes que llegan al cliente correcto',
    tagline:
      'Segmentá tu base por intereses y compras para enviar ofertas que sí generan respuesta.',
    notes: [
      'Mostrá cómo se arma un segmento, por ejemplo clientes que compraron un rubro específico.',
      'Usá la proyección como ejemplo, no como promesa de resultado.',
      'Preguntá qué campañas hacen hoy y por qué canal.',
    ],
    steps: [
      { caption: 'Se elige el segmento: intereses, compras y última actividad.' },
      { caption: 'Se arma el mensaje y el descuento a probar.' },
      {
        caption: 'Proyección de alcance y conversión (ejemplo).',
        notify: {
          title: 'Campaña programada',
          message: 'Envío a 100 clientes, en este ejemplo',
        },
      },
    ],
  },
  {
    n: 7,
    slug: 'impacto',
    label: 'Impacto',
    title: 'Lo que cambia en tu negocio',
    tagline:
      'Un resumen claro de lo que se ahorra, lo que se recupera y los próximos pasos para arrancar.',
    notes: [
      'Resumí las escenas anteriores con cifras de ejemplo, sin prometer resultados.',
      'Mostrá el reporte mensual y cómo se comparte con el equipo.',
      'Cerrá con 2 o 3 próximos pasos concretos y una fecha para la prueba.',
    ],
    steps: [
      { caption: 'Resumen del impacto estimado (ejemplo).' },
      { caption: 'Reporte mensual para el equipo y para vos.' },
      { caption: 'Próximos pasos: prueba piloto, carga de catálogo y primera campaña.' },
    ],
  },
]
