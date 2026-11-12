import type { Scenario, Simulation } from '../../engine/types';
import { act, chain, edge, ev, fail, macro, msg, st, tok, wait } from '../dsl';

/*
 Map (col,row):
   ads(0,0) → web(1,0) → carta(2,0)
                 ↓       ↗
   wa(0,1)  → asis(1,1) → mesas(2,1) → confirm(3,1)
                 ↓                        ↓
              cocina(1,2) ───────────→ reviews(3,2)
*/

const nodes = [
  macro('ads', 'ads', [0, 0], 'Anuncios del local', 'Campañas para atraer público', [
    st('campana', 'Campaña activa', 'system', 0, 0, 'Un anuncio muestra una propuesta puntual a gente de la zona.'),
    st('destino', 'Página de destino', 'system', 1, 0, 'Quien toca el anuncio llega directo a la carta o a reservar.'),
    st('registro', 'Interés registrado', 'system', 2, 0, 'Cada reserva queda asociada a la campaña que la trajo.'),
  ], undefined, 'ad'),
  macro('web', 'web', [1, 0], 'Web y reservas', 'Carta y reservas online', [
    st('carta', 'Ver carta', 'system', 0, 0, 'La carta del día, actualizada, a un toque del anuncio.'),
    st('reservar', 'Reservar mesa', 'system', 1, 0, 'Se elige día, horario y cantidad de personas, a cualquier hora.'),
    st('eventos', 'Ver eventos', 'system', 0, 1, 'Cumpleaños, grupos y propuestas especiales del local.'),
  ], [edge('carta', 'reservar'), edge('eventos', 'reservar')], 'store'),
  macro('menu', 'carta', [2, 0], 'Carta y alérgenos', 'Información para elegir', [
    st('plato', 'Plato consultado', 'system', 0, 0, 'Encuentra el plato del que habla el cliente, aunque no use el nombre exacto.'),
    st('ingred', 'Ingredientes visibles', 'system', 1, 0, 'Muestra la composición tal como la cargó la cocina.'),
    st('opciones', 'Opciones especiales', 'ai', 2, 0, 'Señala alternativas sin TACC, vegetarianas o sin lactosa.'),
  ]),
  macro('whatsapp', 'wa', [0, 1], 'WhatsApp del restaurante', 'Mensajes de clientes', [
    st('in', 'Mensaje recibido', 'system', 0, 0, 'Reservas, pedidos y preguntas entran a una bandeja, a cualquier hora.'),
    st('tipo', 'Tipo de mensaje', 'ai', 1, 0, 'Distingue una reserva, un pedido para retirar o una pregunta de carta.'),
    st('persona', 'Atención en persona', 'human', 1, 1, 'Lo que necesita criterio pasa directo a alguien del salón.'),
  ], [edge('in', 'tipo'), edge('tipo', 'persona')], 'chat'),
  macro('assistant', 'asis', [1, 1], 'Organización de mensajes', 'Entiende cada mensaje', [
    st('leer', 'Leer mensaje', 'ai', 0, 0, 'Lee el mensaje como lo escribió el cliente, apurado y todo.'),
    st('datos', 'Datos de la reserva', 'ai', 1, 0, 'Separa día, hora, cantidad de personas y ocasión.'),
    st('especial', 'Mensaje especial', 'ai', 2, 0, 'Señala cumpleaños, grupos grandes o una torta para guardar.'),
    st('pedido', 'Pedido identificado', 'ai', 1, 1, 'Reconoce el número de pedido y a qué circuito va.'),
  ], [edge('leer', 'datos'), edge('datos', 'especial'), edge('leer', 'pedido')], 'bandeja'),
  macro('agenda', 'mesas', [2, 1], 'Mesas y turnos', 'Organización del salón', [
    st('buscar', 'Buscar mesa', 'system', 0, 0, 'Consulta qué mesas están libres de verdad en ese horario.'),
    st('asignar', 'Asignar horario', 'system', 1, 0, 'Reserva la franja para que nadie más la ocupe.'),
    st('grupo', 'Revisar grupo grande', 'human', 2, 0, 'Los grupos grandes o con pedidos especiales los aprueba el encargado.'),
    st('liberar', 'Liberar reserva', 'system', 1, 1, 'Si la reserva no se confirma, la mesa vuelve a estar disponible.'),
  ], [edge('buscar', 'asignar'), edge('asignar', 'grupo'), edge('asignar', 'liberar')], 'agenda'),
  macro('confirm', 'confirm', [3, 1], 'Confirmaciones', 'Recordatorios de reserva', [
    st('pedir', 'Pedir confirmación', 'system', 0, 0, 'Antes del turno, le pregunta al cliente si sigue en pie.'),
    st('silencio', 'Detectar falta de respuesta', 'system', 1, 0, 'Marca la reserva como incierta si no hay respuesta.'),
    st('recordar', 'Recordar reserva', 'ai', 2, 0, 'Retoma la conversación con un mensaje breve y amable.'),
    st('encargado', 'Avisar al encargado', 'human', 1, 1, 'Si conviene, el encargado decide si llama o sostiene la mesa.'),
  ], [edge('pedir', 'silencio'), edge('silencio', 'recordar'), edge('silencio', 'encargado')]),
  macro('kitchen', 'cocina', [1, 2], 'Pedidos y cocina', 'Estado del pedido del cliente', [
    st('recibido', 'Pedido recibido', 'system', 0, 0, 'Confirma que el pedido entró y a qué hora sale.'),
    st('prep', 'En preparación', 'system', 1, 0, 'La cocina marca el avance sin dejar de cocinar.'),
    st('listo', 'Listo para retirar', 'system', 2, 0, 'Le avisa al cliente apenas el pedido está en la barra.'),
    st('obs', 'Observación especial', 'system', 0, 1, 'Destaca un pedido particular: alérgenos, cubiertos, una nota.'),
  ], [edge('recibido', 'prep'), edge('prep', 'listo'), edge('recibido', 'obs')], 'pedidos'),
  macro('reviews', 'reviews', [3, 2], 'Experiencia y reseñas', 'Opiniones después de la visita', [
    st('pedir', 'Pedir opinión', 'system', 0, 0, 'Al día siguiente, un mensaje breve pregunta cómo fue.'),
    st('positivo', 'Comentario positivo', 'ai', 1, 0, 'Si le gustó, lo invita a dejar una reseña.'),
    st('problema', 'Problema informado', 'human', 1, 1, 'Si algo salió mal, le avisa al encargado para resolverlo.'),
  ], [edge('pedir', 'positivo'), edge('pedir', 'problema')], 'experiencias'),
];

const edges = [
  edge('ads', 'web'), edge('web', 'carta'), edge('web', 'asis'), edge('wa', 'asis'), edge('asis', 'carta'),
  edge('asis', 'mesas'), edge('asis', 'cocina'), edge('mesas', 'confirm'), edge('confirm', 'reviews'), edge('cocina', 'reviews'),
];

/* ── simulations ── */

const problema: Simulation = {
  id: 'problema', label: 'Así llega hoy un viernes a la noche',
  steps: [
    ...msg('chat', 'Hola! ¿Tienen mesa para 6 hoy a las 21:30?'),
    act('wa', 'Mensaje nuevo · 20:05'),
    ...msg('pablo', 'Hola, hice un pedido para retirar a las 20:40.', 'customer', undefined, { par: true }),
    ...msg('chat', 'Es un cumpleaños, ¿pueden guardar una torta?'),
    wait(2600, 'El salón está lleno y la cocina no para', 'wa'),
    ...msg('pablo', '¿Ya está en cocina? No me llegó nada.'),
    wait(2400, 'Nadie puede soltar la bandeja para mirar el celular', 'wa'),
    ...msg('chat', 'Hola Julieta, ya te confirmamos.', 'business'),
    wait(2800, '30 minutos después…', 'wa'),
    ...msg('pablo', 'Hola?? Estoy yendo, ¿lo tienen?'),
    ...msg('chat', '¿Hay mesa o no? Así les aviso a todos.'),
    wait(1800, 'Hay que mirar el cuaderno, preguntar en cocina…', 'wa'),
    fail('wa', 'Julieta reservó en otro lado', { dur: 1200 }),
  ],
};

const bandeja: Simulation = {
  id: 'bandeja', label: 'Cada mensaje a su lugar',
  steps: [
    ...msg('chat', 'Hola! ¿Tienen mesa para 6 hoy a las 21:30?'),
    act('wa/in', 'Mensaje recibido · 20:05', { dur: 700 }),
    ...msg('pablo', 'Hice pedido para retirar. ¿Ya está en cocina?', 'customer', undefined, { par: true }),
    tok('wa/in>tipo'),
    act('wa/tipo', 'Dos mensajes, dos pedidos distintos'),
    tok('wa>asis', 'Julieta · Pablo'),
    act('asis/leer', 'Leyendo cada mensaje'),
    ...msg('chat', 'Es un cumpleaños, ¿pueden guardar una torta?', 'customer', undefined, { par: true }),
    tok('asis/leer>datos'),
    act('asis/datos', 'Hoy · 21:30 · 6 personas', { dur: 1100 }),
    ev({ surface: 'bandeja', type: 'panel.row', id: 'j1', cells: ['Julieta · 6 personas', 'Reserva', 'Revisar mesa y torta'] }, { par: true }),
    tok('asis/datos>especial'),
    act('asis/especial', 'Cumpleaños, con torta para guardar', { dur: 1100 }),
    ev({ surface: 'bandeja', type: 'panel.status', id: 'j1', status: 'Pendiente' }, { par: true }),
    tok('asis/leer>pedido'),
    act('asis/pedido', 'Pedido #482 para retirar', { dur: 1000 }),
    ev({ surface: 'bandeja', type: 'panel.row', id: 'p1', cells: ['Pablo · Pedido #482', 'Retiro', 'Confirmar estado'] }, { par: true }),
    wait(900, 'Entra otra consulta: Camila pregunta por platos sin TACC'),
    ev({ surface: 'bandeja', type: 'panel.row', id: 'c1', cells: ['Camila · Sin TACC', 'Carta', 'Responder opciones'] }),
    tok('asis>carta', 'Consulta de carta'),
    act('carta/opciones', 'Tres platos sin TACC en la carta de hoy', { dur: 1200 }),
    ev({ surface: 'bandeja', type: 'panel.status', id: 'c1', status: 'Respondida' }),
    wait(800),
  ],
};

const estado: Simulation = {
  id: 'estado', label: '¿Dónde está mi pedido?', continues: 'bandeja',
  steps: [
    tok('asis>cocina', 'Pedido #482'),
    act('cocina/recibido', 'Entró a las 20:02, sale 20:40'),
    tok('cocina/recibido>prep'),
    act('cocina/prep', 'La cocina ya lo está preparando', { dur: 1200 }),
    ev({ surface: 'pedidos', type: 'panel.status', id: 'o482', status: 'En preparación' }, { par: true }),
    ...msg('pablo', 'Hola Pablo 👋 Tu pedido ya está en cocina. Va a estar listo 20:40.', 'bot', {
      title: 'Pedido #482',
      lines: [
        { label: '2 × Milanesa napolitana con papas', value: 'en cocina' },
        { label: '1 × Flan con dulce de leche', value: 'en cocina' },
        { label: 'Retiro', value: 'Hoy · 20:40' },
      ],
      total: 'En preparación',
    }),
    ev({ surface: 'bandeja', type: 'panel.status', id: 'p1', status: 'Respondido' }, { par: true }),
    ...msg('pablo', 'Genial, gracias! Paso a esa hora.'),
    wait(2000, '20:38', 'cocina/prep'),
    tok('cocina/prep>listo'),
    act('cocina/listo', 'Listo en la barra'),
    ev({ surface: 'pedidos', type: 'panel.status', id: 'o482', status: 'Listo' }, { par: true }),
    ...msg('pablo', 'Tu pedido #482 ya está listo. Te esperamos en la barra 🙌', 'bot'),
    wait(600),
  ],
};

const reserva: Simulation = {
  id: 'reserva', label: 'Una mesa para 6', continues: 'estado',
  steps: [
    tok('asis>mesas', 'Julieta · 6 personas · 21:30'),
    act('mesas/buscar', 'Buscando mesa para 6 a las 21:30', { dur: 1200 }),
    tok('mesas/buscar>asignar'),
    act('mesas/asignar', 'La mesa 11 está libre a esa hora'),
    ev({ surface: 'agenda', type: 'calendar.book', id: 'julieta', day: 'Viernes', time: '21:30', label: 'Mesa 11 · Julieta · 6 personas · por aprobar' }, { par: true }),
    ...msg('chat', 'Hola Julieta 👋 Tenemos lugar a las 21:30. Como son 6 con torta, lo confirma el encargado en unos minutos.', 'bot'),
    tok('mesas/asignar>grupo'),
    wait(2800, 'Grupo de 6 con torta: decide el encargado', 'mesas/grupo'),
    act('mesas/grupo', 'Diego lo aprobó desde el salón', { dur: 1000 }),
    ev({ surface: 'agenda', type: 'calendar.book', id: 'julieta', day: 'Viernes', time: '21:30', label: 'Mesa 11 · Julieta · 6 · Cumpleaños con torta' }, { par: true }),
    ...msg('chat', 'Listo Julieta, tenemos una mesa para 6 a las 21:30. La torta la guardamos nosotros 🎂', 'bot', {
      title: 'Reserva de Julieta',
      lines: [
        { label: 'Día', value: 'Viernes · 21:30' },
        { label: 'Personas', value: '6' },
        { label: 'Ocasión', value: 'Cumpleaños' },
        { label: 'Torta', value: 'Se guarda en la heladera' },
      ],
      total: 'Aprobada por Diego',
    }),
    ...msg('chat', 'Genial, mil gracias!!'),
    wait(800),
  ],
};

const confirmacion: Simulation = {
  id: 'confirmacion', label: '¿Y si no confirma?', continues: 'reserva',
  steps: [
    tok('mesas>confirm'),
    wait(2000, '20:30 · una hora antes del turno', 'confirm/pedir'),
    act('confirm/pedir', 'Se pide confirmación'),
    ...msg('chat', 'Hola Julieta, te esperamos hoy 21:30, mesa para 6. ¿Confirmás la reserva?', 'bot'),
    wait(2200, 'Pasan 20 minutos sin respuesta', 'confirm/pedir'),
    tok('confirm/pedir>silencio'),
    act('confirm/silencio', 'La reserva queda sin confirmar', { dur: 1000 }),
    {
      do: 'choice', id: 'sin-confirmar', prompt: '¿Qué pasa si Julieta no confirma?',
      options: [
        {
          id: 'recordatorio', label: 'Enviar un recordatorio',
          steps: [
            tok('confirm/silencio>recordar'),
            act('confirm/recordar', 'Un mensaje breve, sin presionar'),
            ...msg('chat', 'Julieta, ¿seguimos con la mesa de las 21:30? Si cambió algo, avisanos y lo acomodamos.', 'bot'),
            wait(1600, 'Julieta responde'),
            ...msg('chat', 'Sí!! Llegamos 21:30, somos 6 🎉'),
            ev({ surface: 'agenda', type: 'calendar.book', id: 'julieta', day: 'Viernes', time: '21:30', label: 'Mesa 11 · Julieta · 6 · Confirmada' }),
            act('mesas/asignar', 'La mesa 11 queda confirmada', { dur: 1200, par: true }),
          ],
        },
        {
          id: 'encargado', label: 'Avisar al encargado',
          steps: [
            tok('confirm/silencio>encargado'),
            act('confirm/encargado', 'Diego decide si la llama o sostiene la mesa', { dur: 1600 }),
            ev({ surface: 'agenda', type: 'calendar.book', id: 'julieta', day: 'Viernes', time: '21:30', label: 'Mesa 11 · Julieta · 6 · Revisa Diego' }, { par: true }),
            wait(1000),
          ],
        },
        {
          id: 'liberar', label: 'Liberar la mesa',
          steps: [
            act('confirm/silencio', 'Regla del local: sin respuesta, se libera', { dur: 1200 }),
            act('mesas/liberar', 'La mesa 11 vuelve a estar disponible', { dur: 1400 }),
            ev({ surface: 'agenda', type: 'calendar.cancel', id: 'julieta' }, { par: true }),
            ...msg('chat', 'Julieta, como no tuvimos respuesta liberamos la mesa. Si todavía vienen, escribinos y buscamos lugar.', 'bot'),
          ],
        },
      ],
    },
  ],
};

const experiencia: Simulation = {
  id: 'experiencia', label: 'Del anuncio a la reseña', surfaces: ['store', 'experiencias'],
  steps: [
    ev({ surface: 'ad', type: 'ad.show', headline: 'Menú ejecutivo de mediodía', body: 'La Esquina · a 5 cuadras de tu oficina', cta: 'Ver carta y reservar' }),
    act('ads/campana', 'Anuncio para gente que trabaja cerca'),
    tok('ads/campana>destino'),
    act('ads/destino'),
    ev({ surface: 'ad', type: 'ad.click' }),
    tok('ads>web', 'Sofía tocó el anuncio'),
    act('web/carta', 'Sofía mira la carta del mediodía'),
    ev({ surface: 'store', type: 'store.view', product: 'Menú ejecutivo · Carta y reservas', detail: 'Mesas disponibles hoy al mediodía', cta: 'Reservar mesa' }, { par: true }),
    wait(1800),
    tok('web/carta>reservar'),
    act('web/reservar', 'Elige día, horario y cantidad de personas', { dur: 1300 }),
    act('ads/registro', 'La campaña sabe qué reserva trajo', { par: true, dur: 1300 }),
    tok('web>asis', 'Reserva online · lunes 13:00 · 4'),
    tok('asis>mesas', undefined, { dur: 600 }),
    act('mesas/asignar', 'Mesa para 4 el lunes a las 13:00'),
    wait(2400, 'Sábado al mediodía, después del cumpleaños'),
    tok('confirm>reviews', 'Visita de Julieta'),
    act('reviews/pedir', 'Un mensaje breve, al día siguiente'),
    ...msg('chat', 'Gracias por venir ayer, Julieta. ¿Cómo fue tu experiencia? Muy buena · Buena · Necesitamos mejorar', 'bot'),
    ...msg('chat', 'Muy buena! La torta llegó perfecta y la atención fue excelente.'),
    tok('reviews/pedir>positivo'),
    act('reviews/positivo', 'Le gustó: se la invita a reseñar'),
    ev({ surface: 'experiencias', type: 'panel.row', id: 'e1', cells: ['Sábado', 'Julieta · “Excelente atención”', 'Invitar a reseñar'] }, { par: true }),
    ...msg('chat', '¡Qué alegría! Si querés contarlo, acá podés dejar tu reseña ⭐', 'bot'),
    tok('cocina>reviews', 'Pedido #490 retirado'),
    act('reviews/pedir', undefined, { dur: 600 }),
    ev({ surface: 'experiencias', type: 'panel.row', id: 'e2', cells: ['Sábado', 'Pedido #490 · “Demoró el pedido”', 'Avisar al encargado'], status: 'Por revisar' }, { par: true }),
    tok('reviews/pedir>problema'),
    act('reviews/problema', 'Diego se entera antes de que se repita', { dur: 1400 }),
    ev({ surface: 'experiencias', type: 'panel.status', id: 'e2', status: 'Diego avisado' }),
    wait(1000),
  ],
};

const cierre: Simulation = {
  id: 'cierre', label: 'Todo conectado',
  steps: [
    tok(['wa>asis', 'web>asis'], undefined, { dur: 900 }),
    ev({ surface: 'resumen', type: 'panel.row', id: 'r1', cells: ['Cada mensaje va a su lugar desde el primero'] }, { par: true }),
    tok(['asis>mesas', 'asis>cocina', 'asis>carta'], undefined, { dur: 900 }),
    ev({ surface: 'resumen', type: 'panel.row', id: 'r2', cells: ['Reservas completas, con el encargado cuando hace falta'] }, { par: true }),
    tok('mesas>confirm', undefined, { dur: 900 }),
    ev({ surface: 'resumen', type: 'panel.row', id: 'r3', cells: ['Pedidos con estado visible para el cliente y la cocina'] }, { par: true }),
    tok(['confirm>reviews', 'cocina>reviews'], undefined, { dur: 900 }),
    ev({ surface: 'resumen', type: 'panel.row', id: 'r4', cells: ['Personas enfocadas en atender el salón'] }, { dur: 1800 }),
  ],
};

/* Before / after: same case, two lanes. Same col = same stage. */
const antes: Simulation = {
  id: 'antes', label: 'Hoy',
  steps: [
    wait(2400, 'Julieta escribe 20:05 · se lee 20:50', 'cmp/leer'),
    act('cmp/leer', undefined, { dur: 500 }),
    tok('cmp/leer>cuaderno', undefined, { dur: 1000 }),
    act('cmp/cuaderno', 'Buscar mesa en el cuaderno, con birome', { dur: 1500 }),
    tok('cmp/cuaderno>cocina', undefined, { dur: 900 }),
    wait(2400, '¿Hay lugar en la heladera para una torta?', 'cmp/cocina'),
    tok('cmp/cocina>encargado', undefined, { dur: 900 }),
    wait(2400, 'Diego está atendiendo una mesa', 'cmp/encargado'),
    act('cmp/encargado', undefined, { dur: 500 }),
    tok('cmp/encargado>responder', undefined, { dur: 900 }),
    act('cmp/responder', 'Se responde entre plato y plato', { dur: 1500 }),
    tok('cmp/responder>acordarse', undefined, { dur: 900 }),
    wait(2400, 'Llega la hora del turno', 'cmp/acordarse'),
    fail('cmp/acordarse', 'Nadie confirmó la mesa', { dur: 1200 }),
  ],
};

const despues: Simulation = {
  id: 'despues', label: 'Con RIVECT',
  steps: [
    act('cmp/organizada', 'La reserva se entiende al llegar', { dur: 1000 }),
    tok('cmp/organizada>disponible', undefined, { dur: 800 }),
    act('cmp/disponible', 'Mesa libre, sin mirar el cuaderno', { dur: 1000 }),
    tok('cmp/disponible>aprobacion', undefined, { dur: 1300 }),
    wait(1600, 'Diego decide: sigue siendo su criterio', 'cmp/aprobacion'),
    act('cmp/aprobacion', undefined, { dur: 500 }),
    tok('cmp/aprobacion>confirmacion', undefined, { dur: 800 }),
    act('cmp/confirmacion', 'Julieta recibe su reserva', { dur: 1000 }),
    tok('cmp/confirmacion>recordatorio', undefined, { dur: 800 }),
    act('cmp/recordatorio', 'La confirmación ya está programada', { dur: 1200 }),
  ],
};

const consulta: Simulation = {
  id: 'consulta', label: 'Simular una consulta', surfaces: ['chat', 'agenda'],
  steps: [...bandeja.steps, ...estado.steps, ...reserva.steps, ...confirmacion.steps],
};

export const restaurante: Scenario = {
  id: 'restaurante',
  business: { label: 'Restaurante', icon: 'utensils', tagline: 'Reservas, pedidos y experiencia' },
  nodes,
  edges,
  surfaces: {
    chat: { kind: 'chat', title: 'WhatsApp', contact: 'Julieta', integration: 'whatsapp' },
    pablo: { kind: 'chat', title: 'WhatsApp', contact: 'Pablo', integration: 'whatsapp' },
    bandeja: { kind: 'panel', title: 'Bandeja organizada', columns: ['Consulta', 'Tipo', 'Próximo paso'], integration: 'assistant' },
    pedidos: {
      kind: 'panel', title: 'Pedidos para retirar', columns: ['Pedido', 'Cliente', 'Retiro'], integration: 'admin',
      seed: [
        { surface: 'pedidos', type: 'panel.row', id: 'o479', cells: ['#479', 'Lucas M.', '20:15'], status: 'Retirado' },
        { surface: 'pedidos', type: 'panel.row', id: 'o481', cells: ['#481', 'Familia Paz', '20:30'], status: 'Listo' },
        { surface: 'pedidos', type: 'panel.row', id: 'o482', cells: ['#482', 'Pablo', '20:40'], status: 'Recibido' },
      ],
    },
    agenda: {
      kind: 'calendar', title: 'Reservas de hoy', integration: 'calendar',
      seed: [
        { surface: 'agenda', type: 'calendar.book', id: 'ruiz', day: 'Viernes', time: '20:00', label: 'Mesa 4 · Familia Ruiz · 4 personas' },
        { surface: 'agenda', type: 'calendar.book', id: 'gomez', day: 'Viernes', time: '20:30', label: 'Mesa 7 · Gómez · 2 personas' },
        { surface: 'agenda', type: 'calendar.book', id: 'torres', day: 'Viernes', time: '21:00', label: 'Mesa 2 · Torres · 3 personas' },
        { surface: 'agenda', type: 'calendar.book', id: 'sosa', day: 'Viernes', time: '21:30', label: 'Mesa 9 · Sosa · 2 personas' },
        { surface: 'agenda', type: 'calendar.book', id: 'acosta', day: 'Viernes', time: '22:00', label: 'Mesa 5 · Acosta · 4 personas' },
      ],
    },
    experiencias: {
      kind: 'panel', title: 'Experiencias', columns: ['Fecha', 'Comentario', 'Acción'], integration: 'followup',
      seed: [{ surface: 'experiencias', type: 'panel.row', id: 'e0', cells: ['Jueves', 'Mesa 8 · “Muy rica la carta”', 'Invitar a reseñar'] }],
    },
    ad: { kind: 'ad', title: 'Anuncio en redes', integration: 'ads' },
    store: { kind: 'store', title: 'Web del restaurante', integration: 'web' },
    resumen: { kind: 'panel', title: 'Lo que vimos hoy', columns: ['Qué cambia'] },
  },
  sims: { problema, bandeja, estado, reserva, confirmacion, experiencia, cierre, antes, despues, consulta },
  quickSims: ['consulta', 'experiencia'],
  comparisons: [
    {
      id: 'cmp', title: 'Antes y después', caseLabel: 'Julieta pide mesa para 6 con torta',
      before: {
        nodes: [
          { ...st('leer', 'Se lee cuando se puede', 'human', 0, 0), fate: 'automated' },
          { ...st('cuaderno', 'Buscar mesa en el cuaderno', 'human', 1, 0), fate: 'automated' },
          { ...st('cocina', 'Preguntar a cocina por la torta', 'human', 2, 0), fate: 'removed' },
          { ...st('encargado', 'Consultar al encargado', 'human', 3, 0), fate: 'human' },
          { ...st('responder', 'Responder a mano', 'human', 4, 0), fate: 'automated' },
          { ...st('acordarse', 'Acordarse de confirmar', 'human', 5, 0), fate: 'automated' },
        ],
        edges: chain('leer', 'cuaderno', 'cocina', 'encargado', 'responder', 'acordarse'),
      },
      after: {
        nodes: [
          st('organizada', 'Reserva organizada', 'ai', 0, 0),
          st('disponible', 'Mesa disponible', 'system', 1, 0),
          st('aprobacion', 'Aprobación del encargado', 'human', 3, 0),
          st('confirmacion', 'Confirmación enviada', 'system', 4, 0),
          st('recordatorio', 'Recordatorio antes del turno', 'system', 5, 0),
        ],
        edges: chain('organizada', 'disponible', 'aprobacion', 'confirmacion', 'recordatorio'),
      },
      beforeSim: 'antes',
      afterSim: 'despues',
    },
  ],
  diagnosis: [
    { id: 'mezcla', label: 'Se mezclan reservas y pedidos', blurb: 'Separemos cada mensaje según lo que necesita.', nodes: ['wa', 'asis'], chapter: 'pedidos' },
    { id: 'noshow', label: 'Hay reservas que no vienen', blurb: 'Veamos qué pasa entre la reserva y la hora de llegada.', nodes: ['confirm', 'mesas'], chapter: 'reservas' },
    { id: 'listo', label: 'No sé si el pedido está listo', blurb: 'Sigamos el recorrido de un pedido hasta el retiro.', nodes: ['cocina'], chapter: 'pedidos' },
    { id: 'grandes', label: 'Las mesas grandes son un lío', blurb: 'Veamos dónde necesita intervenir el encargado.', nodes: ['mesas'], chapter: 'reservas' },
    { id: 'repetido', label: 'Siempre preguntan lo mismo', blurb: 'Miremos qué información conviene dejar lista.', nodes: ['carta', 'asis'], chapter: 'pedidos' },
    { id: 'opiniones', label: 'No aprovechamos buenas opiniones', blurb: 'Veamos cómo escuchar al cliente después de su visita.', nodes: ['reviews'], chapter: 'experiencia' },
  ],
  services: [
    { id: 'marketing', label: 'Marketing digital', blurb: 'Anuncios para llegar a gente de la zona.', nodes: ['ads'], chapter: 'experiencia' },
    { id: 'webdev', label: 'Páginas web y reservas', blurb: 'La web muestra la carta y toma reservas fuera de horario.', nodes: ['web'], chapter: 'experiencia' },
    { id: 'ia', label: 'Inteligencia artificial', blurb: 'Un asistente que separa reservas, pedidos y preguntas.', nodes: ['asis', 'carta'], chapter: 'pedidos' },
    { id: 'auto', label: 'Automatización', blurb: 'Confirmaciones, avisos de pedido y opiniones sin pasos repetidos.', nodes: ['confirm', 'cocina', 'reviews'], chapter: 'reservas' },
    { id: 'software', label: 'Software a medida', blurb: 'Mesas y pedidos en un sistema que usa todo el equipo.', nodes: ['mesas', 'cocina'], chapter: 'reservas' },
  ],
  tour: {
    chapters: [
      {
        id: 'problema', title: 'El pico de mensajes',
        beats: [
          { dur: 4200, camera: 'all', highlight: ['wa'], caption: 'Así se ve un restaurante por dentro.' },
          { dur: 3800, camera: { nodes: ['wa', 'asis'], maxZoom: 1.1 }, surfaces: ['chat', 'pablo'], sim: { sim: 'problema' }, caption: 'Viernes a la noche: todo llega al mismo tiempo.' },
          { dur: 5000, caption: 'En hora pico, cada mensaje compite con la operación.' },
          { dur: 5000, caption: 'Una reserva mal tomada ocupa una mesa equivocada.' },
          { dur: 'sim', caption: 'Un pedido sin respuesta genera otra consulta.' },
        ],
      },
      {
        id: 'pedidos', title: 'Cada pedido en su lugar',
        beats: [
          { dur: 4200, sim: null, surfaces: [], camera: 'all', highlight: ['wa', 'asis', 'mesas', 'cocina', 'carta'], caption: 'Ahora, la misma noche con el local conectado.' },
          { dur: 4600, expanded: ['wa'], camera: { nodes: ['wa', 'asis'] }, surfaces: ['chat', 'bandeja'], sim: { sim: 'bandeja' }, caption: 'No todos los mensajes necesitan el mismo recorrido.' },
          { dur: 6000, expanded: ['asis'], camera: { nodes: ['asis'] }, caption: 'Primero se entiende qué está pidiendo cada persona.' },
          { dur: 'sim', camera: { nodes: ['asis', 'carta'] }, highlight: ['asis', 'carta'], caption: 'Después, cada consulta va al lugar correcto.' },
          { dur: 5200, expanded: ['cocina'], camera: { nodes: ['asis', 'cocina'] }, highlight: ['asis', 'cocina'], surfaces: ['pablo', 'pedidos'], sim: { sim: 'estado' }, caption: 'Pablo pregunta por su pedido.' },
          { dur: 'sim', caption: 'La respuesta sale de cocina, sin interrumpir a nadie.' },
        ],
      },
      {
        id: 'reservas', title: 'Reservar, confirmar, recordar',
        beats: [
          { dur: 5000, expanded: ['mesas'], camera: { nodes: ['asis', 'mesas'] }, highlight: ['asis', 'mesas'], surfaces: ['chat', 'agenda'], sim: { sim: 'reserva' }, caption: 'La reserva queda completa, no perdida entre mensajes.' },
          { dur: 4200, highlight: ['mesas', 'mesas/grupo'], caption: 'Las excepciones pasan por quien corresponde.' },
          { dur: 'sim', highlight: ['asis', 'mesas'], caption: 'Mesa, horario, personas y ocasión, en un solo lugar.' },
          { dur: 'sim', hold: true, expanded: ['mesas', 'confirm'], camera: { nodes: ['mesas', 'confirm'] }, highlight: ['mesas', 'confirm'], sim: { sim: 'confirmacion' }, caption: 'Una confirmación ayuda a ordenar la noche.' },
          { dur: 'sim', sim: { sim: 'confirmacion', choices: { 'sin-confirmar': 'recordatorio' } }, caption: 'Si no contesta, la mesa no queda en el aire.' },
        ],
      },
      {
        id: 'experiencia', title: 'Del anuncio a la reseña',
        beats: [
          { dur: 4200, expanded: [], camera: 'all', highlight: ['ads', 'web', 'asis', 'reviews'], surfaces: [], sim: null, caption: 'La experiencia empieza antes de sentarse a la mesa.' },
          { dur: 7000, expanded: ['ads', 'web'], camera: { nodes: ['ads', 'web'] }, surfaces: ['ad', 'store'], sim: { sim: 'experiencia' }, caption: 'Un anuncio lleva a la carta y a reservar.' },
          { dur: 5600, expanded: ['web'], camera: { nodes: ['web', 'asis', 'mesas'] }, caption: 'La reserva entra sola, incluso fuera de horario.' },
          { dur: 9000, expanded: ['reviews'], camera: { nodes: ['confirm', 'reviews'] }, highlight: ['confirm', 'cocina', 'reviews'], surfaces: ['chat', 'experiencias'], caption: 'Y continúa cuando el cliente se va.' },
          { dur: 'sim', camera: { nodes: ['cocina', 'reviews'] }, caption: 'Los comentarios ayudan a cuidar el servicio.' },
        ],
      },
      {
        id: 'comparar', title: 'Antes y después',
        beats: [
          { dur: 3600, view: { kind: 'compare', id: 'cmp', phase: 'before' }, expanded: [], camera: 'all', highlight: null, surfaces: [], sim: null, caption: 'Es la misma reserva, con dos recorridos distintos.' },
          { dur: 7000, sim: { sim: 'antes' }, caption: 'Hoy, la reserva depende de acordarse de cada paso.' },
          { dur: 'sim', caption: 'Los mensajes se pierden entre servicio y cocina.' },
          { dur: 5200, view: { kind: 'compare', id: 'cmp', phase: 'shift' }, sim: null, caption: 'Algunos pasos desaparecen. Otros se hacen solos.' },
          { dur: 'sim', view: { kind: 'compare', id: 'cmp', phase: 'after' }, sim: { sim: 'despues' }, caption: 'Más contexto para atender cada mesa.' },
          { dur: 5600, highlight: ['cmp/aprobacion', 'cmp/encargado'], caption: 'El equipo decide; el sistema ordena.' },
        ],
      },
      {
        id: 'impacto', title: 'Lo que cambia',
        beats: [
          { dur: 4200, view: { kind: 'map' }, expanded: [], camera: 'all', highlight: null, surfaces: ['resumen'], sim: { sim: 'cierre' }, caption: 'No se trata de sacar personas del salón.' },
          { dur: 4600, caption: 'Se trata de sacar pasos repetidos del medio.' },
          { dur: 5000, caption: 'Cada restaurante define qué se ordena primero.' },
          { dur: 5000, camera: { nodes: ['wa', 'asis', 'mesas', 'cocina'] }, caption: 'RIVECT diseña el recorrido con vos.' },
        ],
      },
    ],
  },
};
