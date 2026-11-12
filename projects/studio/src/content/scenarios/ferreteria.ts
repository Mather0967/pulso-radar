import type { Scenario, Simulation } from '../../engine/types';
import { act, chain, edge, ev, fail, macro, msg, st, tok, wait } from '../dsl';

/*
 Map (col,row):
   ads(0,0) → web(1,0)            admin(2,0)
                 ↓                   ↓
   wa(0,1)  → asis(1,1) → cat(2,1) → quotes(3,1) → follow(4,1)
                                       ↓            ↙
                                     crm(3,2)
*/

const nodes = [
  macro('ads', 'ads', [0, 0], 'Anuncios locales', 'Anuncios para gente de la zona', [
    st('oferta', 'Oferta publicada', 'system', 0, 0, 'Un anuncio muestra un producto o una categoría a gente de la zona.'),
    st('destino', 'Destino del anuncio', 'system', 1, 0, 'Quien toca el anuncio llega directo a la página o al chat.'),
    st('registro', 'Interés registrado', 'system', 2, 0, 'Cada consulta queda asociada a la campaña que la trajo.'),
  ]),
  macro('web', 'web', [1, 0], 'Web y tienda', 'Productos visibles fuera del local', [
    st('pagina', 'Página de producto', 'system', 0, 0, 'Detalle, variantes y disponibilidad de cada producto.'),
    st('consulta', 'Consulta desde la web', 'ai', 1, 0, 'Responde dudas simples, incluso fuera de horario.'),
  ]),
  macro('admin', 'admin', [2, 0], 'Sistema administrativo', 'Precios y stock que ya usás', [
    st('precios', 'Lista de precios', 'system', 0, 0, 'Se usan los valores vigentes, no los de una planilla vieja.'),
    st('movs', 'Movimientos de stock', 'system', 1, 0, 'Entradas y salidas actualizan lo disponible.'),
  ]),
  macro('whatsapp', 'wa', [0, 1], 'WhatsApp del local', 'Consultas que llegan al negocio', [
    st('in', 'Mensaje recibido', 'system', 0, 0, 'Cada mensaje entra a una bandeja ordenada, a cualquier hora.'),
    st('tipo', 'Tipo de consulta', 'ai', 1, 0, 'Distingue un pedido de materiales, un reclamo o una pregunta suelta.'),
    st('persona', 'Atención en persona', 'human', 1, 1, 'Lo que necesita criterio pasa directo a alguien del local.'),
  ], [edge('in', 'tipo'), edge('tipo', 'persona')]),
  macro('assistant', 'asis', [1, 1], 'Asistente del local', 'Ordena cada pedido', [
    st('leer', 'Leer mensaje', 'ai', 0, 0, 'Lee el mensaje como lo escribió el cliente, con abreviaturas y todo.'),
    st('prod', 'Identificar productos', 'ai', 1, 0, 'Reconoce de qué producto habla aunque no use el nombre exacto.'),
    st('medidas', 'Detectar medidas', 'ai', 2, 0, 'Separa medida, espesor, largo y cantidad.'),
    st('falta', 'Pedir dato faltante', 'ai', 2, 1, 'Si falta un dato, pregunta solo eso antes de cotizar.'),
  ]),
  macro('catalog', 'cat', [2, 1], 'Catálogo y stock', 'Productos, precios y disponibilidad', [
    st('buscar', 'Buscar producto', 'system', 0, 0, 'Encuentra el artículo exacto en el catálogo del local.'),
    st('stock', 'Confirmar stock', 'system', 1, 0, 'Consulta cuánto hay disponible antes de prometer.'),
    st('precio', 'Precio vigente', 'system', 2, 0, 'Toma el precio actualizado del sistema administrativo.'),
    st('alt', 'Proponer alternativa', 'ai', 1, 1, 'Si algo no hay, sugiere un reemplazo posible.'),
  ], [edge('buscar', 'stock'), edge('stock', 'precio'), edge('stock', 'alt')]),
  macro('quotes', 'quotes', [3, 1], 'Presupuestos', 'Cotizaciones listas para revisar', [
    st('armar', 'Armar detalle', 'system', 0, 0, 'Reúne productos, medidas y cantidades confirmadas.'),
    st('calc', 'Calcular total', 'system', 1, 0, 'Suma con precios vigentes y condiciones del local.'),
    st('rev', 'Revisión del encargado', 'human', 2, 0, 'Las cotizaciones importantes pasan por una persona antes de salir.'),
    st('enviar', 'Enviar presupuesto', 'system', 3, 0, 'El cliente lo recibe por WhatsApp, claro y con vigencia.'),
  ]),
  macro('followup', 'follow', [4, 1], 'Seguimiento', 'Consultas que necesitan una vuelta', [
    st('espera', 'Esperar respuesta', 'system', 0, 0, 'Le da tiempo al cliente sin perder la consulta de vista.'),
    st('recordatorio', 'Recordatorio amable', 'ai', 1, 0, 'Retoma la conversación con un mensaje breve y humano.'),
    st('tarea', 'Tarea para llamar', 'human', 1, 1, 'Si conviene una llamada, le avisa a quien corresponde.'),
    st('estado', 'Actualizar estado', 'system', 2, 0, 'Marca qué pasó para que nadie tenga que acordarse.'),
  ], [edge('espera', 'recordatorio'), edge('espera', 'tarea'), edge('recordatorio', 'estado')]),
  macro('crm', 'crm', [3, 2], 'CRM comercial', 'Historial de cada cliente', [
    st('nuevo', 'Cliente nuevo', 'system', 0, 0, 'Registra el primer contacto y de dónde llegó.'),
    st('interes', 'Interés detectado', 'system', 1, 0, 'Guarda qué necesita y para cuándo.'),
    st('etapa', 'Etapa comercial', 'system', 2, 0, 'Muestra en qué está cada oportunidad, para todo el equipo.'),
  ]),
];

const edges = [
  edge('ads', 'web'), edge('web', 'asis'), edge('wa', 'asis'), edge('asis', 'cat'), edge('admin', 'cat'),
  edge('cat', 'quotes'), edge('quotes', 'follow'), edge('quotes', 'crm'), edge('follow', 'crm'), edge('asis', 'crm'),
];

/* ── simulations ── */

const problema: Simulation = {
  id: 'problema', label: 'Así llega hoy una consulta',
  steps: [
    ...msg('chat', 'Hola, ¿tenés caño estructural 40x40? Necesito 6 tiras de 6 metros.'),
    act('wa', 'Mensaje nuevo · 11:42'),
    ...msg('chat', 'También planchuela de 1/8, unas 4 barras.'),
    wait(2600, 'El mostrador está lleno: hay tres clientes esperando', 'wa'),
    ...msg('chat', 'Hola Martín, ya te confirmamos.', 'business'),
    wait(2800, '40 minutos después…', 'wa'),
    ...msg('chat', '¿Pudiste ver lo de los caños? Necesito saber hoy.'),
    wait(2400, 'Hay que ir al depósito, buscar la planilla, calcular…', 'wa'),
    fail('wa', 'Martín compró en otro lado', { dur: 1200 }),
  ],
};

const pedido: Simulation = {
  id: 'pedido', label: 'El pedido se ordena',
  steps: [
    ...msg('chat', 'Hola, ¿tenés caño estructural 40x40? Necesito 6 tiras de 6 metros.'),
    act('wa/in', 'Mensaje recibido · 11:42', { dur: 700 }),
    ...msg('chat', 'También planchuela de 1/8, unas 4 barras.', 'customer', undefined, { par: true }),
    tok('wa/in>tipo'),
    act('wa/tipo', 'Es un pedido de materiales'),
    tok('wa>asis', 'Pedido de Martín'),
    act('asis/leer', 'Leyendo el mensaje completo'),
    tok('asis/leer>prod'),
    act('asis/prod', 'Caño estructural · Planchuela', { dur: 1100 }),
    ev({ surface: 'pedido', type: 'panel.row', id: 'p1', cells: ['Caño estructural', '40 × 40 × 1,6 mm · 6 m', '6 tiras'] }, { par: true }),
    tok('asis/prod>medidas'),
    act('asis/medidas', 'Medidas y cantidades separadas', { dur: 1100 }),
    ev({ surface: 'pedido', type: 'panel.row', id: 'p2', cells: ['Planchuela', 'Espesor 1/8 · ancho ?', '4 barras'], status: 'Falta dato' }, { par: true }),
    tok('asis/medidas>falta'),
    act('asis/falta', 'Falta el ancho de la planchuela'),
    ...msg('chat', 'Hola Martín 👋 Tenemos el caño 40x40. Para la planchuela de 1/8, ¿qué ancho necesitás? 1", 1 1/4" o 1 1/2"', 'bot'),
    wait(1400, 'Martín responde'),
    ...msg('chat', '1 1/4'),
    ev({ surface: 'pedido', type: 'panel.status', id: 'p2', status: 'Completo' }),
    ev({ surface: 'pedido', type: 'panel.row', id: 'p2', cells: ['Planchuela', '1/8 × 1 1/4" · 6 m', '4 barras'], status: 'Completo' }),
    wait(800),
  ],
};

const stock: Simulation = {
  id: 'stock', label: 'Stock y precio', continues: 'pedido',
  steps: [
    tok('asis>cat', '6 caños · 4 planchuelas'),
    act('cat/buscar', 'Buscando los artículos en el catálogo'),
    tok('cat/buscar>stock'),
    tok('admin>cat', 'Stock y precios vigentes', { par: true }),
    act('admin/movs', undefined, { par: true }),
    act('cat/stock', 'Revisando disponibilidad', { dur: 1200 }),
    ev({ surface: 'stock', type: 'panel.row', id: 's1', cells: ['Caño 40×40×1,6 · 6 m', '8 tiras'], status: 'Disponible' }, { par: true }),
    ev({ surface: 'stock', type: 'panel.row', id: 's2', cells: ['Planchuela 1/8 × 1 1/4"', '12 barras'], status: 'Disponible' }),
    ev({ surface: 'stock', type: 'panel.row', id: 's3', cells: ['Planchuela 1/8 × 1 1/2"', '0 barras'], status: 'Sin stock' }),
    tok('cat/stock>alt', undefined, { par: true }),
    act('cat/alt', 'Si pedía 1 1/2", ofrece la de 1 1/4"', { dur: 1300 }),
    tok('cat/stock>precio'),
    act('admin/precios', undefined, { par: true }),
    act('cat/precio', 'Precio vigente de la lista de hoy', { dur: 1100 }),
    wait(600),
  ],
};

const presupuesto: Simulation = {
  id: 'presupuesto', label: 'Presupuesto listo', continues: 'stock',
  steps: [
    tok('cat>quotes', 'Productos con precio'),
    act('quotes/armar', 'Armando el detalle'),
    tok('quotes/armar>calc'),
    act('quotes/calc', 'Calculando el total', { dur: 1000 }),
    tok('quotes/calc>rev'),
    wait(2600, 'Esperando la revisión del encargado', 'quotes/rev'),
    act('quotes/rev', 'Jorge lo aprobó desde el celular', { dur: 900 }),
    tok('quotes/rev>enviar'),
    act('quotes/enviar', 'Presupuesto B-1842 enviado'),
    ...msg('chat', 'Listo Martín. Te paso el presupuesto, lo tenés reservado por 48 hs.', 'bot', {
      title: 'Presupuesto B-1842',
      lines: [
        { label: '6 × Caño estructural 40×40×1,6 · 6 m', value: 'en stock' },
        { label: '4 × Planchuela 1/8 × 1 1/4" · 6 m', value: 'en stock' },
        { label: 'Entrega', value: 'Retiro por el local' },
        { label: 'Vigencia', value: '48 horas' },
      ],
      total: 'Revisado por Jorge',
    }),
    tok('quotes>crm', 'Oportunidad registrada'),
    act('crm/interes', undefined, { dur: 700 }),
    ev({ surface: 'crm', type: 'crm.card', id: 'martin', stage: 'Cotizadas', title: 'Martín R.', note: 'Caños y planchuela · B-1842' }, { par: true }),
    act('crm/etapa', 'Queda a la vista de todo el equipo', { dur: 900 }),
  ],
};

const seguimiento: Simulation = {
  id: 'seguimiento', label: '¿Y si no responde?', continues: 'presupuesto',
  steps: [
    tok('quotes>follow'),
    wait(2200, 'Pasa un día y Martín no contesta', 'follow/espera'),
    {
      do: 'choice', id: 'sin-respuesta', prompt: '¿Qué pasa si Martín no responde?',
      options: [
        {
          id: 'recordatorio', label: 'Enviar un recordatorio amable',
          steps: [
            act('follow/espera', undefined, { dur: 400 }),
            tok('follow/espera>recordatorio'),
            act('follow/recordatorio', 'Mensaje breve, sin presionar'),
            ...msg('chat', 'Hola Martín, te escribimos por el presupuesto de los caños. Si querés, revisamos alguna alternativa.', 'bot'),
            wait(1600, 'Martín responde a la tarde'),
            ...msg('chat', 'Sí! Paso a retirar mañana a primera hora 👍'),
            tok('follow/recordatorio>estado'),
            act('follow/estado', 'Retira mañana: el local ya lo sabe'),
            tok('follow>crm'),
            ev({ surface: 'crm', type: 'crm.move', id: 'martin', stage: 'Ganadas', note: 'Retira mañana' }),
            act('crm/etapa', undefined, { dur: 600, par: true }),
          ],
        },
        {
          id: 'tarea', label: 'Crear una tarea para llamar',
          steps: [
            act('follow/espera', undefined, { dur: 400 }),
            tok('follow/espera>tarea'),
            act('follow/tarea', 'Tarea para Jorge: llamar a Martín hoy', { dur: 1600 }),
            tok('follow>crm'),
            ev({ surface: 'crm', type: 'crm.move', id: 'martin', stage: 'Seguimiento', note: 'Llamar hoy · Jorge' }),
            act('crm/etapa', 'Nadie tiene que acordarse: está anotado', { dur: 1400, par: true }),
          ],
        },
        {
          id: 'cerrar', label: 'Cerrar la consulta por ahora',
          steps: [
            act('follow/espera', 'Se cierra sin perder el historial', { dur: 1400 }),
            tok('follow>crm'),
            ev({ surface: 'crm', type: 'crm.move', id: 'martin', stage: 'Cerradas', note: 'Sin respuesta · queda registrada' }),
            act('crm/etapa', 'Si vuelve en un mes, se sabe qué pidió', { dur: 1600, par: true }),
          ],
        },
      ],
    },
  ],
};

const web: Simulation = {
  id: 'web', label: 'Del anuncio a la venta', surfaces: ['webchat', 'crm'],
  steps: [
    ev({ surface: 'ad', type: 'ad.show', headline: 'Amoladoras, discos y accesorios para obra', body: 'Ferretería El Tornillo · a 8 cuadras', cta: 'Ver productos' }),
    act('ads/oferta', 'Anuncio para gente de la zona'),
    tok('ads/oferta>destino'),
    act('ads/destino'),
    ev({ surface: 'ad', type: 'ad.click' }),
    tok('ads>web', 'Lucía tocó el anuncio'),
    act('web/pagina', 'Lucía mira la amoladora 115 mm'),
    ev({ surface: 'store', type: 'store.view', product: 'Amoladora angular 115 mm', detail: 'Disponible para retirar hoy', cta: 'Consultar disponibilidad' }, { par: true }),
    wait(1800),
    tok('web/pagina>consulta'),
    act('web/consulta', 'Consulta desde la web, 22:15', { dur: 1000 }),
    ...msg('webchat', 'Hola, ¿la tienen en stock? La necesito para cortar caño.'),
    tok('web>asis'),
    act('asis/prod', 'Entiende para qué la necesita', { dur: 1000 }),
    ...msg('webchat', 'Sí, quedan 3. Para caño te conviene sumar discos de corte para metal. ¿Te armo el combo?', 'bot'),
    ...msg('webchat', 'Dale, con 5 discos.'),
    tok('asis>crm', 'Nueva oportunidad'),
    act('crm/nuevo', 'Lucía queda registrada, con origen: anuncio'),
    ev({ surface: 'crm', type: 'crm.card', id: 'lucia', stage: 'Nuevas', title: 'Lucía B.', note: 'Amoladora + 5 discos · desde anuncio' }, { par: true }),
    act('ads/registro', 'La campaña sabe qué consulta trajo', { par: true, dur: 1200 }),
    wait(1000),
  ],
};

const cierre: Simulation = {
  id: 'cierre', label: 'Todo conectado',
  steps: [
    tok(['wa>asis', 'web>asis'], undefined, { dur: 900 }),
    ev({ surface: 'resumen', type: 'panel.row', id: 'r1', cells: ['Consultas más claras desde el primer mensaje'] }, { par: true }),
    tok('asis>cat', undefined, { dur: 900 }),
    tok('admin>cat', undefined, { par: true, dur: 900 }),
    ev({ surface: 'resumen', type: 'panel.row', id: 'r2', cells: ['Presupuestos con información del negocio'] }, { par: true }),
    tok('cat>quotes', undefined, { dur: 900 }),
    tok(['quotes>follow', 'quotes>crm'], undefined, { dur: 900 }),
    ev({ surface: 'resumen', type: 'panel.row', id: 'r3', cells: ['Seguimientos que no dependen de la memoria'] }, { par: true }),
    tok('follow>crm', undefined, { dur: 900 }),
    ev({ surface: 'resumen', type: 'panel.row', id: 'r4', cells: ['Personas enfocadas en decidir, atender y vender'] }, { dur: 1800 }),
  ],
};

/* Before / after: same case, two lanes. Same col = same stage. */
const antes: Simulation = {
  id: 'antes', label: 'Hoy',
  steps: [
    wait(2400, 'Martín escribe 11:42 · se lee 12:30', 'cmp/leer'),
    act('cmp/leer', undefined, { dur: 500 }),
    tok('cmp/leer>planilla', undefined, { dur: 1000 }),
    act('cmp/planilla', 'Buscar el código en la planilla', { dur: 1500 }),
    tok('cmp/planilla>repreg', undefined, { dur: 900 }),
    wait(2200, 'Falta el ancho: hay que volver a preguntar', 'cmp/repreg'),
    tok('cmp/repreg>planilla', 'vuelve', { dur: 900 }),
    act('cmp/planilla', undefined, { dur: 600 }),
    tok('cmp/planilla>deposito', undefined, { dur: 1000 }),
    wait(2600, 'El depósito está atendiendo un camión', 'cmp/deposito'),
    tok('cmp/deposito>mano', undefined, { dur: 1000 }),
    act('cmp/mano', 'Sumar a mano en la calculadora', { dur: 1800 }),
    tok('cmp/mano>enviar', undefined, { dur: 900 }),
    act('cmp/enviar', 'Jorge revisa y lo manda', { dur: 1300 }),
    tok('cmp/enviar>volver', undefined, { dur: 900 }),
    wait(2400, 'Pasan tres días', 'cmp/volver'),
    fail('cmp/volver', 'Nadie retomó el presupuesto', { dur: 1200 }),
  ],
};

const despues: Simulation = {
  id: 'despues', label: 'Con RIVECT',
  steps: [
    act('cmp/entender', 'El pedido se entiende al llegar', { dur: 1000 }),
    tok('cmp/entender>stockp', undefined, { dur: 800 }),
    act('cmp/stockp', 'Stock y precio, sin ir al depósito', { dur: 1000 }),
    tok('cmp/stockp>armado', undefined, { dur: 1300 }),
    act('cmp/armado', 'Presupuesto armado', { dur: 1000 }),
    tok('cmp/armado>encargado', undefined, { dur: 800 }),
    wait(1600, 'Jorge decide: sigue siendo su criterio', 'cmp/encargado'),
    act('cmp/encargado', undefined, { dur: 500 }),
    tok('cmp/encargado>agenda', undefined, { dur: 800 }),
    act('cmp/agenda', 'El seguimiento ya está agendado', { dur: 1200 }),
  ],
};

const consulta: Simulation = {
  id: 'consulta', label: 'Simular una consulta', surfaces: ['chat', 'crm'],
  steps: [...pedido.steps, ...stock.steps, ...presupuesto.steps, ...seguimiento.steps],
};

export const ferreteria: Scenario = {
  id: 'ferreteria',
  business: { label: 'Ferretería', icon: 'wrench', tagline: 'Consultas, stock y presupuestos' },
  nodes,
  edges,
  surfaces: {
    chat: { kind: 'chat', title: 'WhatsApp', contact: 'Martín R.', integration: 'whatsapp' },
    pedido: { kind: 'panel', title: 'Pedido interpretado', columns: ['Producto', 'Detalle', 'Cantidad'], integration: 'assistant' },
    stock: { kind: 'panel', title: 'Stock encontrado', columns: ['Producto', 'Disponible'], integration: 'catalog' },
    crm: {
      kind: 'crm', title: 'CRM comercial', integration: 'crm', stages: ['Nuevas', 'Cotizadas', 'Seguimiento', 'Ganadas', 'Cerradas'],
      seed: [
        { surface: 'crm', type: 'crm.card', id: 'ruiz', stage: 'Cotizadas', title: 'Construcciones Ruiz', note: 'Membranas · B-1837' },
        { surface: 'crm', type: 'crm.card', id: 'ana', stage: 'Seguimiento', title: 'Ana P.', note: 'Pintura exterior 20 L' },
        { surface: 'crm', type: 'crm.card', id: 'gomez', stage: 'Ganadas', title: 'Taller Gómez', note: 'Bulonería surtida' },
      ],
    },
    ad: { kind: 'ad', title: 'Anuncio en redes', integration: 'ads' },
    store: { kind: 'store', title: 'Tienda online', integration: 'web' },
    webchat: { kind: 'chat', title: 'Chat de la web', contact: 'Lucía B.', integration: 'web' },
    resumen: { kind: 'panel', title: 'Lo que vimos hoy', columns: ['Qué cambia'] },
  },
  sims: { problema, pedido, stock, presupuesto, seguimiento, web, cierre, antes, despues, consulta },
  quickSims: ['consulta', 'web'],
  comparisons: [
    {
      id: 'cmp', title: 'Antes y después', caseLabel: 'Martín pide caños por WhatsApp',
      before: {
        nodes: [
          { ...st('leer', 'Se lee cuando se puede', 'human', 0, 0), fate: 'automated' },
          { ...st('planilla', 'Buscar en la planilla', 'human', 1, 0), fate: 'automated' },
          { ...st('repreg', 'Repreguntar la medida', 'human', 1, 1), fate: 'removed' },
          { ...st('deposito', 'Consultar al depósito', 'human', 2, 0), fate: 'removed' },
          { ...st('mano', 'Presupuesto a mano', 'human', 3, 0), fate: 'automated' },
          { ...st('enviar', 'Revisar y enviar', 'human', 4, 0), fate: 'human' },
          { ...st('volver', 'Acordarse de volver', 'human', 5, 0), fate: 'automated' },
        ],
        edges: [...chain('leer', 'planilla', 'repreg'), edge('repreg', 'planilla'), ...chain('planilla', 'deposito', 'mano', 'enviar', 'volver')],
      },
      after: {
        nodes: [
          st('entender', 'Pedido entendido', 'ai', 0, 0),
          st('stockp', 'Stock y precio', 'system', 1, 0),
          st('armado', 'Presupuesto armado', 'system', 3, 0),
          st('encargado', 'Revisión del encargado', 'human', 4, 0),
          st('agenda', 'Seguimiento agendado', 'system', 5, 0),
        ],
        edges: chain('entender', 'stockp', 'armado', 'encargado', 'agenda'),
      },
      beforeSim: 'antes',
      afterSim: 'despues',
    },
  ],
  diagnosis: [
    { id: 'consultas', label: 'Se pierden consultas', blurb: 'Veamos dónde se corta una consulta antes de responder.', nodes: ['wa', 'asis'], chapter: 'problema' },
    { id: 'cotizar', label: 'Tardamos en cotizar', blurb: 'Sigamos un pedido desde el mensaje hasta la cotización.', nodes: ['quotes', 'cat'], chapter: 'cotizar' },
    { id: 'stock', label: 'No sé qué stock tengo', blurb: 'Veamos cómo consultar disponibilidad antes de prometer.', nodes: ['cat', 'admin'], chapter: 'cotizar' },
    { id: 'seguimiento', label: 'Nadie retoma presupuestos', blurb: 'Miremos qué pasa después de enviar una cotización.', nodes: ['follow', 'crm'], chapter: 'cotizar' },
    { id: 'precios', label: 'Los precios cambian seguido', blurb: 'Veamos cómo usar información vigente al preparar una respuesta.', nodes: ['admin', 'cat'], chapter: 'cotizar' },
    { id: 'web', label: 'La web no genera consultas', blurb: 'Sigamos el camino desde una visita hasta una consulta real.', nodes: ['ads', 'web'], chapter: 'ecosistema' },
    { id: 'persona', label: 'Dependemos de una persona', blurb: 'Veamos qué información queda guardada para todo el equipo.', nodes: ['crm'], comparison: 'cmp' },
  ],
  services: [
    { id: 'marketing', label: 'Marketing digital', blurb: 'Anuncios para llegar a gente de la zona.', nodes: ['ads'], chapter: 'ecosistema' },
    { id: 'webdev', label: 'Páginas web y tiendas', blurb: 'La web muestra el catálogo y atiende fuera de horario.', nodes: ['web'], chapter: 'ecosistema' },
    { id: 'ia', label: 'Inteligencia artificial', blurb: 'Ordena pedidos por producto, medida y cantidad.', nodes: ['asis'], chapter: 'pedido' },
    { id: 'auto', label: 'Automatización', blurb: 'Stock, presupuesto y seguimiento sin pasos repetidos.', nodes: ['cat', 'quotes', 'follow'], chapter: 'cotizar' },
    { id: 'software', label: 'Software a medida', blurb: 'Sistema y CRM que ordenan la información del negocio.', nodes: ['admin', 'crm'], chapter: 'cotizar' },
  ],
  tour: {
    chapters: [
      {
        id: 'problema', title: 'Una consulta común',
        beats: [
          { dur: 4200, camera: 'all', highlight: ['wa'], caption: 'Así se ve una ferretería por dentro.' },
          { dur: 3800, camera: { nodes: ['wa', 'asis'], maxZoom: 1.1 }, surfaces: ['chat'], sim: { sim: 'problema' }, caption: 'Cada consulta puede llegar a destiempo.' },
          { dur: 5000, caption: 'El cliente pregunta mientras alguien atiende el mostrador.' },
          { dur: 5000, caption: 'Hay que entender medidas, cantidades y urgencia.' },
          { dur: 'sim', caption: 'Y confirmar antes de prometer algo que no está.' },
        ],
      },
      {
        id: 'pedido', title: 'El pedido se ordena',
        beats: [
          { dur: 4200, sim: null, surfaces: [], camera: 'all', highlight: ['wa', 'asis', 'cat', 'quotes', 'follow', 'crm'], caption: 'Ahora, la misma consulta con el negocio conectado.' },
          { dur: 4600, expanded: ['wa'], camera: { nodes: ['wa', 'asis'] }, surfaces: ['chat'], sim: { sim: 'pedido' }, caption: 'Primero, el pedido se convierte en algo claro.' },
          { dur: 6000, expanded: ['asis'], camera: { nodes: ['asis'] }, surfaces: ['chat', 'pedido'], caption: 'Producto, medida, cantidad y lo que falta preguntar.' },
          { dur: 5000, caption: 'Vos definís; el pedido ya llega ordenado.' },
          { dur: 'sim', caption: 'Así se evita buscar con datos incompletos.' },
        ],
      },
      {
        id: 'cotizar', title: 'Cotizar sin perder el hilo',
        beats: [
          { dur: 4000, expanded: ['cat', 'admin'], camera: { nodes: ['cat', 'admin'] }, surfaces: ['chat', 'stock'], sim: { sim: 'stock' }, highlight: ['asis', 'cat', 'admin', 'quotes'], caption: 'El pedido llega al catálogo con todos sus datos.' },
          { dur: 'sim', caption: 'Si falta algo, se propone una alternativa concreta.' },
          { dur: 5200, expanded: ['quotes'], camera: { nodes: ['quotes'] }, surfaces: ['chat', 'crm'], sim: { sim: 'presupuesto' }, highlight: ['cat', 'quotes', 'crm'], caption: 'Un presupuesto queda listo para revisar.' },
          { dur: 'sim', caption: 'Las cotizaciones importantes pasan por tu aprobación.' },
          { dur: 'sim', hold: true, expanded: ['follow'], camera: { nodes: ['quotes', 'follow', 'crm'] }, highlight: ['quotes', 'follow', 'crm'], sim: { sim: 'seguimiento' }, caption: '¿Y si Martín no contesta?' },
          { dur: 'sim', sim: { sim: 'seguimiento', choices: { 'sin-respuesta': 'recordatorio' } }, caption: 'Si no responde, el seguimiento no queda olvidado.' },
        ],
      },
      {
        id: 'ecosistema', title: 'No es solo WhatsApp',
        beats: [
          { dur: 4200, expanded: [], camera: 'all', highlight: ['ads', 'web', 'asis', 'crm'], surfaces: [], sim: null, caption: 'La consulta puede empezar mucho antes del WhatsApp.' },
          { dur: 7000, expanded: ['ads'], camera: { nodes: ['ads', 'web'] }, surfaces: ['ad', 'store'], sim: { sim: 'web' }, caption: 'Un anuncio lleva a una página clara.' },
          { dur: 6500, expanded: ['web'], camera: { nodes: ['web', 'asis'] }, surfaces: ['webchat', 'store'], caption: 'La web responde lo básico, incluso fuera de horario.' },
          { dur: 'sim', expanded: [], camera: { nodes: ['ads', 'web', 'asis', 'crm'] }, surfaces: ['webchat', 'crm'], caption: 'Cada contacto queda registrado para seguirlo.' },
        ],
      },
      {
        id: 'comparar', title: 'Antes y después',
        beats: [
          { dur: 3600, view: { kind: 'compare', id: 'cmp', phase: 'before' }, expanded: [], camera: 'all', highlight: null, surfaces: [], sim: null, caption: 'Es la misma consulta, con dos recorridos distintos.' },
          { dur: 7000, sim: { sim: 'antes' }, camera: { nodes: ['cmp/leer', 'cmp/planilla', 'cmp/repreg', 'cmp/deposito'] }, caption: 'Hoy, el pedido depende de acordarse de cada paso.' },
          { dur: 'sim', camera: { nodes: ['cmp/deposito', 'cmp/mano', 'cmp/enviar', 'cmp/volver'] }, caption: 'Las esperas aparecen entre mostrador, depósito y mensaje.' },
          { dur: 5200, view: { kind: 'compare', id: 'cmp', phase: 'shift' }, camera: 'all', sim: null, caption: 'Algunos pasos desaparecen. Otros se hacen solos.' },
          { dur: 'sim', view: { kind: 'compare', id: 'cmp', phase: 'after' }, sim: { sim: 'despues' }, caption: 'Después, la información viaja ordenada.' },
          { dur: 5600, highlight: ['cmp/encargado', 'cmp/enviar'], caption: 'La persona sigue donde agrega valor: decidir.' },
        ],
      },
      {
        id: 'impacto', title: 'Lo que cambia',
        beats: [
          { dur: 4200, view: { kind: 'map' }, expanded: [], camera: 'all', highlight: null, surfaces: ['resumen'], sim: { sim: 'cierre' }, caption: 'No se trata de sacar personas del negocio.' },
          { dur: 4600, caption: 'Se trata de sacar pasos repetidos del medio.' },
          { dur: 5000, caption: 'Cada negocio define qué se ordena primero.' },
          { dur: 5000, camera: { nodes: ['wa', 'asis', 'cat', 'quotes'] }, caption: 'Armamos el recorrido con vos.' },
        ],
      },
    ],
  },
};
