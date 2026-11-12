import type { Scenario, Simulation } from '../../engine/types';
import { act, chain, edge, ev, fail, macro, msg, st, tok, wait } from '../dsl';

/*
 Map (col,row):
   ads(0,0) → web(1,0)        ficha(2,0)
                 ↓          ↗
   wa(0,1)  → asis(1,1) → agenda(2,1) → conf(3,1)
                     ↘                 ↙    ↓
                       crm(2,2)   ←   seg(3,2)
*/

const nodes = [
  macro('ads', 'ads', [0, 0], 'Anuncios de la clínica', 'Campañas que traen consultas', [
    st('oferta', 'Anuncio publicado', 'system', 0, 0, 'Un anuncio muestra un tratamiento a gente de la zona.'),
    st('destino', 'Destino del anuncio', 'system', 1, 0, 'Quien toca el anuncio llega a una página que explica el tratamiento.'),
    st('registro', 'Consulta registrada', 'system', 2, 0, 'Cada consulta queda asociada a la campaña que la trajo.'),
  ]),
  macro('web', 'web', [1, 0], 'Web de la clínica', 'Información y solicitud de turnos', [
    st('trat', 'Tratamientos claros', 'system', 0, 0, 'Explica cómo es cada tratamiento y cómo es la primera evaluación.'),
    st('faq', 'Preguntas comunes', 'ai', 1, 0, 'Responde las dudas de siempre, incluso fuera de horario.'),
    st('form', 'Formulario de consulta', 'system', 2, 0, 'La persona deja su consulta y llega a recepción con contexto.'),
  ]),
  macro('records', 'ficha', [2, 0], 'Ficha del paciente', 'Contexto para la atención', [
    st('nuevo', 'Paciente nuevo', 'system', 0, 0, 'Registra el primer contacto con los datos básicos.'),
    st('historial', 'Historial visible', 'system', 1, 0, 'Si ya vino antes, el equipo ve lo que hay disponible.'),
    st('proximo', 'Próximo tratamiento', 'human', 2, 0, 'El profesional deja anotado cuál es el siguiente paso.'),
  ]),
  macro('whatsapp', 'wa', [0, 1], 'WhatsApp de la clínica', 'Consultas de pacientes', [
    st('in', 'Mensaje recibido', 'system', 0, 0, 'Cada mensaje entra a una bandeja ordenada, aunque llegue de noche.'),
    st('motivo', 'Motivo de visita', 'ai', 1, 0, 'Distingue un dolor, un control, una limpieza o una pregunta suelta.'),
    st('derivar', 'Derivación humana', 'human', 1, 1, 'Lo que necesita criterio pasa directo a recepción.'),
  ], [edge('in', 'motivo'), edge('motivo', 'derivar')]),
  macro('assistant', 'asis', [1, 1], 'Organización de turnos', 'Ordena cada solicitud', [
    st('leer', 'Leer la consulta', 'ai', 0, 0, 'Lee el mensaje como lo escribió el paciente, sin formularios.'),
    st('ordenar', 'Ordenar solicitud', 'ai', 1, 0, 'Separa motivo, horario preferido y si es paciente nuevo.'),
    st('urgencia', 'Detectar urgencia', 'ai', 2, 0, 'Si aparece dolor o una molestia fuerte, lo marca para revisar.'),
    st('revision', 'Revisión de la odontóloga', 'human', 2, 1, 'Una persona del equipo decide la prioridad. El asistente no diagnostica.'),
  ]),
  macro('agenda', 'agenda', [2, 1], 'Agenda y turnos', 'Disponibilidad del equipo', [
    st('buscar', 'Buscar horario', 'system', 0, 0, 'Encuentra lugares reales según el horario que pidió el paciente.'),
    st('reservar', 'Reservar turno', 'system', 1, 0, 'Guarda el turno elegido en la agenda de la clínica.'),
    st('liberar', 'Liberar espacio', 'system', 2, 0, 'Un turno cancelado vuelve a quedar disponible para otro paciente.'),
    st('reprog', 'Reprogramar visita', 'ai', 1, 1, 'Si el paciente no puede, ofrece otro horario disponible.'),
  ], [edge('buscar', 'reservar'), edge('reservar', 'liberar', 'si cancela'), edge('reservar', 'reprog', 'si no puede')]),
  macro('confirm', 'conf', [3, 1], 'Confirmaciones', 'Recordatorios antes de la visita', [
    st('pedir', 'Pedir confirmación', 'system', 0, 0, 'Pregunta por WhatsApp si el paciente va a venir.'),
    st('recordar', 'Enviar recordatorio', 'system', 1, 0, 'Avisa con anticipación, con instrucciones simples.'),
    st('silencio', 'Detectar silencio', 'system', 1, 1, 'Identifica quién no respondió antes de que el turno quede vacío.'),
    st('avisar', 'Avisar a recepción', 'human', 2, 1, 'Crea una tarea para que recepción llame solo a quien hace falta.'),
  ], [edge('pedir', 'recordar'), edge('pedir', 'silencio'), edge('silencio', 'avisar')]),
  macro('followup', 'seg', [3, 2], 'Seguimiento clínico', 'Continuidad después de atender', [
    st('control', 'Control pendiente', 'system', 0, 0, 'Marca la próxima revisión para que no dependa de la memoria.'),
    st('consulta', 'Consulta posterior', 'ai', 1, 0, 'Pregunta cómo sigue el paciente después de la visita.'),
    st('tarea', 'Tarea profesional', 'human', 1, 1, 'Si algo no está bien, pide la revisión del equipo.'),
  ], [edge('control', 'consulta'), edge('consulta', 'tarea')]),
  macro('crm', 'crm', [2, 2], 'CRM de pacientes', 'Relación y estado de consultas', [
    st('nueva', 'Consulta nueva', 'system', 0, 0, 'Identifica el nuevo contacto y de dónde llegó.'),
    st('confirmado', 'Turno confirmado', 'system', 1, 0, 'Actualiza la situación de cada paciente, para todo el equipo.'),
    st('pendiente', 'Seguimiento pendiente', 'system', 2, 0, 'Señala la próxima acción y quién la tiene que hacer.'),
  ]),
];

const edges = [
  edge('ads', 'web'), edge('web', 'asis'), edge('wa', 'asis'), edge('asis', 'ficha'), edge('asis', 'agenda'),
  edge('agenda', 'conf'), edge('asis', 'crm'), edge('conf', 'crm'), edge('conf', 'seg'), edge('seg', 'crm'),
];

/* ── simulations ── */

const problema: Simulation = {
  id: 'problema', label: 'Así llega hoy un turno',
  steps: [
    ...msg('chat', 'Hola, necesito un turno por dolor en una muela.'),
    act('wa', 'Mensaje nuevo · 22:40'),
    ...msg('chat', '¿Atienden mañana después de las 17?'),
    wait(2600, 'La clínica está cerrada: nadie lo ve hasta mañana', 'wa'),
    wait(2800, '10:15 · Recepción atiende el teléfono y la sala a la vez', 'wa'),
    ...msg('chat', 'Hola Carolina, recién vemos tu mensaje. ¿Te sirve a las 17:30?', 'business'),
    ...msg('chat', 'Gracias, ya conseguí turno en otro lado.'),
    fail('wa', 'Carolina se atendió en otra clínica', { dur: 1200 }),
    wait(2600, '17:00 · El control de Daniel nunca se confirmó', 'conf'),
    ev({ surface: 'agenda', type: 'calendar.book', id: 'd1700', day: 'Mañana', time: '17:00', label: 'Control · Daniel P. · No vino' }),
    ev({ surface: 'agenda', type: 'calendar.cancel', id: 'd1700' }),
    fail('conf', 'La silla quedó vacía a las 17:00', { dur: 1400 }),
  ],
};

const solicitud: Simulation = {
  id: 'solicitud', label: 'La solicitud se ordena',
  steps: [
    ...msg('chat', 'Hola, necesito un turno por dolor en una muela.'),
    act('wa/in', 'Mensaje recibido · 22:40', { dur: 700 }),
    ...msg('chat', '¿Atienden mañana después de las 17?', 'customer', undefined, { par: true }),
    tok('wa/in>motivo'),
    act('wa/motivo', 'Pide un turno por dolor'),
    tok('wa>asis', 'Consulta de Carolina'),
    act('asis/leer', 'Leyendo el mensaje completo'),
    tok('asis/leer>ordenar'),
    act('asis/ordenar', 'Motivo, horario y tipo de paciente', { dur: 1100 }),
    ev({ surface: 'solicitud', type: 'panel.row', id: 'motivo', cells: ['Motivo', 'Dolor en una muela'] }, { par: true }),
    ev({ surface: 'solicitud', type: 'panel.row', id: 'horario', cells: ['Horario', 'Mañana, desde las 17'] }),
    ev({ surface: 'solicitud', type: 'panel.row', id: 'paciente', cells: ['Paciente', 'A confirmar'], status: 'Falta dato' }),
    tok('asis>ficha', 'Buscar ficha'),
    act('ficha/historial', 'No aparece en las fichas', { dur: 1000 }),
    ...msg('chat', 'Hola Carolina 👋 Gracias por escribir. ¿Ya te atendiste alguna vez con nosotros?', 'bot'),
    wait(1400, 'Carolina responde'),
    ...msg('chat', 'No, es la primera vez.'),
    act('ficha/nuevo', 'Paciente nueva: se arma su ficha', { dur: 1000 }),
    ev({ surface: 'solicitud', type: 'panel.row', id: 'paciente', cells: ['Paciente', 'Nueva'], status: 'Completo' }, { par: true }),
    tok('asis/ordenar>urgencia'),
    act('asis/urgencia', 'Hay dolor: se marca para revisar', { dur: 1100 }),
    ev({ surface: 'solicitud', type: 'panel.row', id: 'atencion', cells: ['Atención', 'Priorizar revisión'], status: 'Revisión humana' }, { par: true }),
    tok('asis/urgencia>revision'),
    wait(2600, 'Esperando a la Dra. Ríos', 'asis/revision'),
    act('asis/revision', 'La Dra. Ríos la prioriza para mañana', { dur: 1000 }),
    ev({ surface: 'solicitud', type: 'panel.status', id: 'atencion', status: 'Decidido por la Dra. Ríos' }, { par: true }),
    tok('asis>crm', 'Consulta nueva'),
    act('crm/nueva', undefined, { dur: 700 }),
    ev({ surface: 'crm', type: 'crm.card', id: 'carolina', stage: 'Consultas', title: 'Carolina M.', note: 'Dolor en una muela · paciente nueva' }, { par: true }),
    wait(800),
  ],
};

const turno: Simulation = {
  id: 'turno', label: 'Turno reservado', continues: 'solicitud',
  steps: [
    tok('asis>agenda', 'Mañana, desde las 17'),
    act('agenda/buscar', 'Buscando lugares reales en la agenda', { dur: 1200 }),
    ...msg('chat', 'La doctora ya vio tu consulta. Para mañana tenemos 17:30 o 18:30, o el viernes a las 17. ¿Cuál te queda mejor?', 'bot'),
    wait(1400, 'Carolina elige'),
    ...msg('chat', 'Mañana 17:30 👍'),
    tok('agenda/buscar>reservar'),
    act('agenda/reservar', 'Turno reservado: mañana 17:30'),
    ev({ surface: 'agenda', type: 'calendar.book', id: 'd1730', day: 'Mañana', time: '17:30', label: 'Carolina M. · Dolor de muela · Sin confirmar' }, { par: true }),
    ev({ surface: 'crm', type: 'crm.move', id: 'carolina', stage: 'Con turno', note: 'Mañana 17:30 · Dra. Ríos' }),
    wait(900),
  ],
};

const confirmar: Simulation = {
  id: 'confirmar', label: 'Pedir confirmación', continues: 'turno',
  steps: [
    tok('agenda>conf', 'Turno de Carolina'),
    act('conf/pedir', 'Pide confirmación por WhatsApp'),
    ...msg('chat', 'Hola Carolina, reservamos mañana a las 17:30. ¿Confirmás tu turno?', 'bot', {
      title: 'Turno reservado',
      lines: [
        { label: 'Día', value: 'Mañana' },
        { label: 'Hora', value: '17:30' },
        { label: 'Motivo', value: 'Dolor en una muela' },
        { label: 'Profesional', value: 'Dra. Ríos' },
      ],
      total: 'Confirmar · Necesito cambiarlo',
    }),
    tok('conf>crm', 'Esperando confirmación'),
    act('crm/pendiente', 'Queda a la vista de recepción', { dur: 1000 }),
  ],
};

const recordar: Simulation = {
  id: 'recordar', label: '¿Y si no confirma?', continues: 'confirmar',
  steps: [
    wait(2200, 'Pasan unas horas y Carolina no responde', 'conf/pedir'),
    {
      do: 'choice', id: 'sin-confirmar', prompt: '¿Qué pasa si Carolina no confirma?',
      options: [
        {
          id: 'recordatorio', label: 'Enviar un recordatorio',
          steps: [
            act('conf/pedir', undefined, { dur: 400 }),
            tok('conf/pedir>recordar'),
            act('conf/recordar', 'Recordatorio breve, con instrucciones simples'),
            ...msg('chat', 'Te recordamos tu turno mañana a las 17:30. Si necesitás reprogramar, avisá por acá.', 'bot'),
            wait(1600, 'Carolina responde a la tarde'),
            ...msg('chat', 'Confirmo, ahí estaré. ¡Gracias!'),
            ev({ surface: 'agenda', type: 'calendar.book', id: 'd1730', day: 'Mañana', time: '17:30', label: 'Carolina M. · Dolor de muela · Confirmado' }),
            tok('conf>crm'),
            ev({ surface: 'crm', type: 'crm.move', id: 'carolina', stage: 'Confirmados', note: 'Mañana 17:30 · confirmó' }),
            act('crm/confirmado', 'Recepción ya sabe que viene', { dur: 1000, par: true }),
            tok('conf>seg'),
            act('seg/control', 'Después de la visita, queda marcado el control', { dur: 1300 }),
          ],
        },
        {
          id: 'tarea', label: 'Crear una tarea para recepción',
          steps: [
            act('conf/pedir', undefined, { dur: 400 }),
            tok('conf/pedir>silencio'),
            act('conf/silencio', 'Sin respuesta desde ayer'),
            tok('conf/silencio>avisar'),
            act('conf/avisar', 'Tarea para recepción: llamar a Carolina', { dur: 1600 }),
            tok('conf>crm'),
            ev({ surface: 'crm', type: 'crm.move', id: 'carolina', stage: 'Seguimiento', note: 'Llamar hoy · Recepción' }),
            act('crm/pendiente', 'Nadie tiene que acordarse: está anotado', { dur: 1400, par: true }),
          ],
        },
        {
          id: 'liberar', label: 'Liberar el turno',
          steps: [
            act('conf/pedir', undefined, { dur: 400 }),
            tok('conf/pedir>silencio'),
            act('conf/silencio', 'Sin respuesta hasta el mediodía'),
            ...msg('chat', 'Carolina, como no tuvimos respuesta liberamos el turno de mañana. Si querés, te buscamos otro horario.', 'bot'),
            act('agenda/liberar', 'El 17:30 vuelve a estar disponible', { dur: 1200 }),
            ev({ surface: 'agenda', type: 'calendar.cancel', id: 'd1730' }, { par: true }),
            ev({ surface: 'agenda', type: 'calendar.book', id: 'd1730b', day: 'Mañana', time: '17:30', label: 'Disponible' }),
            tok('conf>crm'),
            ev({ surface: 'crm', type: 'crm.move', id: 'carolina', stage: 'Seguimiento', note: 'Turno liberado · ofrecer otro día' }),
            act('crm/pendiente', 'Otro paciente puede usar ese lugar', { dur: 1400, par: true }),
          ],
        },
      ],
    },
  ],
};

const web: Simulation = {
  id: 'web', label: 'Del anuncio a la consulta', surfaces: ['store', 'crm'],
  steps: [
    ev({ surface: 'ad', type: 'ad.show', headline: '¿Hace tiempo postergás una consulta por implantes?', body: 'Clínica Dental del Parque · primera evaluación con turno', cta: 'Conocer más' }),
    act('ads/oferta', 'Anuncio para gente de la zona'),
    tok('ads/oferta>destino'),
    act('ads/destino'),
    ev({ surface: 'ad', type: 'ad.click' }),
    tok('ads>web', 'Roberto tocó el anuncio'),
    act('web/trat', 'Roberto lee cómo es la primera evaluación', { dur: 1200 }),
    ev({ surface: 'store', type: 'store.view', product: 'Implantes: cómo es la primera evaluación', detail: 'Preguntas frecuentes y tiempos', cta: 'Solicitar una consulta' }, { par: true }),
    wait(1800),
    tok('web/trat>faq'),
    act('web/faq', '¿Duele? ¿Cuántas visitas son? Respondido', { dur: 1400 }),
    tok('web/faq>form'),
    act('web/form', 'Roberto deja su consulta · 21:50', { dur: 1200 }),
    tok('web>asis'),
    act('asis/ordenar', 'Implantes · primera vez · prefiere mañanas', { dur: 1200 }),
    tok('asis>crm', 'Consulta nueva'),
    act('crm/nueva', 'Roberto queda registrado, con origen: anuncio'),
    ev({ surface: 'crm', type: 'crm.card', id: 'roberto', stage: 'Consultas', title: 'Roberto G.', note: 'Implantes · desde anuncio' }, { par: true }),
    act('ads/registro', 'La campaña sabe qué consulta trajo', { par: true, dur: 1200 }),
    tok('asis>agenda', 'Evaluación'),
    act('agenda/reservar', 'Evaluación agendada', { dur: 1000 }),
    ev({ surface: 'agenda', type: 'calendar.book', id: 'v1000', day: 'Viernes', time: '10:00', label: 'Roberto G. · Evaluación de implantes' }, { par: true }),
    ev({ surface: 'crm', type: 'crm.move', id: 'roberto', stage: 'Con turno', note: 'Evaluación viernes 10:00' }),
    wait(1000),
  ],
};

const cierre: Simulation = {
  id: 'cierre', label: 'Todo conectado',
  steps: [
    tok(['wa>asis', 'web>asis'], undefined, { dur: 900 }),
    ev({ surface: 'resumen', type: 'panel.row', id: 'r1', cells: ['Consultas ordenadas desde el primer mensaje'] }, { par: true }),
    tok(['asis>ficha', 'asis>agenda'], undefined, { dur: 900 }),
    ev({ surface: 'resumen', type: 'panel.row', id: 'r2', cells: ['Casos urgentes decididos por una persona'] }, { par: true }),
    tok('agenda>conf', undefined, { dur: 900 }),
    tok(['conf>crm', 'conf>seg'], undefined, { dur: 900 }),
    ev({ surface: 'resumen', type: 'panel.row', id: 'r3', cells: ['Turnos confirmados sin llamar uno por uno'] }, { par: true }),
    tok('seg>crm', undefined, { dur: 900 }),
    ev({ surface: 'resumen', type: 'panel.row', id: 'r4', cells: ['Recepción enfocada en atender, no en perseguir'] }, { dur: 1800 }),
  ],
};

/* Before / after: same case, two lanes. Same col = same stage. */
const antes: Simulation = {
  id: 'antes', label: 'Hoy',
  steps: [
    wait(2400, 'Carolina escribe 22:40 · se lee 10:15', 'cmp/leer'),
    act('cmp/leer', undefined, { dur: 500 }),
    tok('cmp/leer>llamar', undefined, { dur: 1000 }),
    wait(2400, 'Recepción la llama: no atiende', 'cmp/llamar'),
    act('cmp/llamar', 'Al segundo intento: motivo y horario', { dur: 1400 }),
    tok('cmp/llamar>agenda', undefined, { dur: 900 }),
    act('cmp/agenda', 'Buscar un lugar entre llamada y llamada', { dur: 1600 }),
    tok('cmp/agenda>anotar', undefined, { dur: 900 }),
    act('cmp/anotar', 'Anotarlo en la libreta', { dur: 1200 }),
    tok('cmp/anotar>recordar', undefined, { dur: 900 }),
    wait(2400, 'El día anterior, si alguien se acuerda', 'cmp/recordar'),
    act('cmp/recordar', undefined, { dur: 600 }),
    tok('cmp/recordar>perseguir', undefined, { dur: 900 }),
    wait(2200, 'Tres pacientes sin responder', 'cmp/perseguir'),
    fail('cmp/perseguir', 'El control de las 17:00 no vino', { dur: 1200 }),
  ],
};

const despues: Simulation = {
  id: 'despues', label: 'Con RIVECT',
  steps: [
    act('cmp/organizada', 'La consulta se ordena al llegar', { dur: 1000 }),
    tok('cmp/organizada>revision', undefined, { dur: 800 }),
    wait(1600, 'La doctora decide la prioridad', 'cmp/revision'),
    act('cmp/revision', undefined, { dur: 500 }),
    tok('cmp/revision>opciones', undefined, { dur: 800 }),
    act('cmp/opciones', 'Opciones reales de la agenda', { dur: 1000 }),
    tok('cmp/opciones>recordatorio', undefined, { dur: 1300 }),
    act('cmp/recordatorio', 'Confirmación y recordatorio listos', { dur: 1200 }),
    tok('cmp/recordatorio>tarea', undefined, { dur: 800 }),
    act('cmp/tarea', 'Recepción llama solo si hace falta', { dur: 1200 }),
  ],
};

const consulta: Simulation = {
  id: 'consulta', label: 'Simular una consulta', surfaces: ['chat', 'agenda'],
  steps: [...solicitud.steps, ...turno.steps, ...confirmar.steps, ...recordar.steps],
};

export const dental: Scenario = {
  id: 'dental',
  business: { label: 'Clínica odontológica', icon: 'smile', tagline: 'Turnos, recordatorios y seguimiento' },
  nodes,
  edges,
  surfaces: {
    chat: { kind: 'chat', title: 'WhatsApp', contact: 'Carolina M.', integration: 'whatsapp' },
    solicitud: { kind: 'panel', title: 'Solicitud organizada', columns: ['Dato', 'Detalle'], integration: 'assistant' },
    agenda: {
      kind: 'calendar', title: 'Agenda de la clínica', integration: 'calendar',
      seed: [
        { surface: 'agenda', type: 'calendar.book', id: 'd1700', day: 'Mañana', time: '17:00', label: 'Control · Daniel P. · Sin confirmar' },
        { surface: 'agenda', type: 'calendar.book', id: 'd1730', day: 'Mañana', time: '17:30', label: 'Disponible' },
        { surface: 'agenda', type: 'calendar.book', id: 'd1800', day: 'Mañana', time: '18:00', label: 'Limpieza · Lucas F. · Confirmado' },
        { surface: 'agenda', type: 'calendar.book', id: 'd1830', day: 'Mañana', time: '18:30', label: 'Disponible' },
        { surface: 'agenda', type: 'calendar.book', id: 'v1700', day: 'Viernes', time: '17:00', label: 'Disponible' },
      ],
    },
    crm: {
      kind: 'crm', title: 'Pacientes', integration: 'crm', stages: ['Consultas', 'Con turno', 'Confirmados', 'Seguimiento'],
      seed: [
        { surface: 'crm', type: 'crm.card', id: 'daniel', stage: 'Con turno', title: 'Daniel P.', note: 'Control mañana 17:00 · sin respuesta' },
        { surface: 'crm', type: 'crm.card', id: 'lucas', stage: 'Confirmados', title: 'Lucas F.', note: 'Limpieza mañana 18:00' },
        { surface: 'crm', type: 'crm.card', id: 'sofia', stage: 'Seguimiento', title: 'Sofía L.', note: 'Reprogramar · tarea para recepción' },
      ],
    },
    ad: { kind: 'ad', title: 'Anuncio en redes', integration: 'ads' },
    store: { kind: 'store', title: 'Web de la clínica', integration: 'web' },
    resumen: { kind: 'panel', title: 'Lo que vimos hoy', columns: ['Qué cambia'] },
  },
  sims: { problema, solicitud, turno, confirmar, recordar, web, cierre, antes, despues, consulta },
  quickSims: ['consulta', 'web'],
  comparisons: [
    {
      id: 'cmp', title: 'Antes y después', caseLabel: 'Carolina pide un turno por WhatsApp',
      before: {
        nodes: [
          { ...st('leer', 'Se lee al otro día', 'human', 0, 0), fate: 'automated' },
          { ...st('llamar', 'Llamar para preguntar', 'human', 1, 0), fate: 'removed' },
          { ...st('agenda', 'Buscar lugar en la agenda', 'human', 2, 0), fate: 'automated' },
          { ...st('anotar', 'Anotar en la libreta', 'human', 3, 0), fate: 'removed' },
          { ...st('recordar', 'Recordatorio a mano', 'human', 4, 0), fate: 'automated' },
          { ...st('perseguir', 'Llamar a quien no confirma', 'human', 5, 0), fate: 'human' },
        ],
        edges: chain('leer', 'llamar', 'agenda', 'anotar', 'recordar', 'perseguir'),
      },
      after: {
        nodes: [
          st('organizada', 'Consulta organizada', 'ai', 0, 0),
          st('revision', 'Revisión si es urgente', 'human', 1, 1),
          st('opciones', 'Opciones reales', 'system', 2, 0),
          st('recordatorio', 'Confirmación y recordatorio', 'system', 4, 0),
          st('tarea', 'Tarea si hace falta', 'human', 5, 0),
        ],
        edges: [edge('organizada', 'opciones'), edge('organizada', 'revision'), edge('revision', 'opciones'), ...chain('opciones', 'recordatorio', 'tarea')],
      },
      beforeSim: 'antes',
      afterSim: 'despues',
    },
  ],
  diagnosis: [
    { id: 'ausencias', label: 'Faltan pacientes sin avisar', blurb: 'Veamos el recorrido antes de que un turno quede vacío.', nodes: ['conf', 'agenda'], chapter: 'agenda' },
    { id: 'agenda', label: 'La agenda se complica', blurb: 'Ordenemos una solicitud desde el primer mensaje.', nodes: ['agenda', 'asis'], chapter: 'solicitud' },
    { id: 'whatsapp', label: 'Respondo tarde por WhatsApp', blurb: 'Miremos cómo clasificar consultas sin perder calidez.', nodes: ['wa', 'asis'], chapter: 'problema' },
    { id: 'controles', label: 'Se olvidan controles', blurb: 'Veamos cómo recordar el próximo paso de cada paciente.', nodes: ['seg', 'ficha'], chapter: 'agenda' },
    { id: 'repite', label: 'Recepción repite siempre lo mismo', blurb: 'Identifiquemos qué dudas se pueden responder de forma clara.', nodes: ['web'], chapter: 'ecosistema' },
    { id: 'origen', label: 'No sabemos de dónde llegan', blurb: 'Veamos cómo registrar cada nueva consulta.', nodes: ['crm', 'ads'], chapter: 'ecosistema' },
  ],
  services: [
    { id: 'marketing', label: 'Marketing digital', blurb: 'Un anuncio que trae consultas reales, con su origen registrado.', nodes: ['ads'], chapter: 'ecosistema' },
    { id: 'webdev', label: 'Páginas web', blurb: 'La web explica tratamientos y recibe consultas fuera de horario.', nodes: ['web'], chapter: 'ecosistema' },
    { id: 'ia', label: 'Inteligencia artificial', blurb: 'Ordena cada consulta y avisa si hay dolor.', nodes: ['asis'], chapter: 'solicitud' },
    { id: 'auto', label: 'Automatización', blurb: 'Confirmaciones, recordatorios y tareas sin llamar uno por uno.', nodes: ['agenda', 'conf', 'seg'], chapter: 'agenda' },
    { id: 'software', label: 'Software a medida', blurb: 'Fichas y CRM que ordenan la información de cada paciente.', nodes: ['ficha', 'crm'], chapter: 'agenda' },
  ],
  tour: {
    chapters: [
      {
        id: 'problema', title: 'El turno que nunca confirmó',
        beats: [
          { dur: 4200, camera: 'all', highlight: ['wa', 'agenda', 'conf'], caption: 'Así se ve una clínica odontológica por dentro.' },
          { dur: 3800, camera: { nodes: ['wa', 'asis', 'agenda', 'conf'], maxZoom: 1.1 }, surfaces: ['chat', 'agenda'], sim: { sim: 'problema' }, caption: 'Los turnos llegan mientras recepción ya está atendiendo.' },
          { dur: 5000, caption: 'Carolina escribe de noche: tiene dolor y quiere turno.' },
          { dur: 5000, caption: 'Primero hay que entender urgencia, cobertura y horario.' },
          { dur: 'sim', caption: 'Y una ausencia empieza mucho antes de la silla vacía.' },
        ],
      },
      {
        id: 'solicitud', title: 'Encontrar el lugar correcto',
        beats: [
          { dur: 4200, sim: null, surfaces: [], camera: 'all', highlight: ['wa', 'asis', 'ficha', 'agenda', 'conf', 'crm'], caption: 'Ahora, el mismo mensaje con la clínica conectada.' },
          { dur: 4600, expanded: ['wa'], camera: { nodes: ['wa', 'asis'] }, surfaces: ['chat'], sim: { sim: 'solicitud' }, caption: 'La consulta se ordena antes de ocupar un turno.' },
          { dur: 6000, expanded: ['asis'], camera: { nodes: ['asis'] }, surfaces: ['chat', 'solicitud'], caption: 'Motivo, horario y si es paciente nueva.' },
          { dur: 5000, highlight: ['asis', 'asis/urgencia', 'asis/revision'], caption: 'Ante dolor, la odontóloga define la prioridad.' },
          { dur: 'sim', caption: 'La doctora decide la prioridad. El asistente no diagnostica.' },
        ],
      },
      {
        id: 'agenda', title: 'Confirmar, recordar, recuperar',
        beats: [
          { dur: 4000, expanded: ['agenda'], camera: { nodes: ['asis', 'agenda'] }, surfaces: ['chat', 'agenda'], sim: { sim: 'turno' }, highlight: ['asis', 'agenda', 'conf'], caption: 'La agenda muestra opciones reales.' },
          { dur: 'sim', caption: 'Carolina elige y el turno queda reservado.' },
          { dur: 3600, expanded: ['conf'], camera: { nodes: ['agenda', 'conf', 'crm'] }, surfaces: ['chat', 'crm'], sim: { sim: 'confirmar' }, highlight: ['agenda', 'conf', 'crm'], caption: 'Cada turno puede tener su recordatorio.' },
          { dur: 'sim', caption: 'Si alguien necesita cambiarlo, la agenda se actualiza.' },
          { dur: 'sim', hold: true, surfaces: ['chat', 'agenda'], highlight: ['agenda', 'conf', 'crm', 'seg'], camera: { nodes: ['agenda', 'conf', 'crm', 'seg'] }, sim: { sim: 'recordar' }, caption: '¿Qué pasa si Carolina no confirma?' },
          { dur: 'sim', surfaces: ['chat', 'crm'], sim: { sim: 'recordar', choices: { 'sin-confirmar': 'recordatorio' } }, caption: 'Un recordatorio amable, y el turno queda confirmado.' },
          { dur: 4800, highlight: ['conf', 'conf/silencio', 'conf/avisar'], camera: { nodes: ['conf'] }, caption: 'Si no responde, recepción sabe a quién llamar.' },
          { dur: 4200, caption: 'La atención humana aparece cuando hace falta.' },
        ],
      },
      {
        id: 'ecosistema', title: 'Toda la experiencia conectada',
        beats: [
          { dur: 4200, expanded: [], camera: 'all', highlight: ['ads', 'web', 'asis', 'agenda', 'crm'], surfaces: [], sim: null, caption: 'La relación puede empezar antes del primer mensaje.' },
          { dur: 7000, expanded: ['ads', 'web'], camera: { nodes: ['ads', 'web'] }, surfaces: ['ad', 'store'], sim: { sim: 'web' }, caption: 'Un anuncio de implantes lleva a una página clara.' },
          { dur: 6500, expanded: ['web'], camera: { nodes: ['web', 'asis'] }, surfaces: ['store', 'crm'], caption: 'La información clara baja dudas innecesarias.' },
          { dur: 'sim', expanded: [], camera: { nodes: ['web', 'asis', 'agenda', 'crm'] }, surfaces: ['agenda', 'crm'], caption: 'La consulta llega a recepción con contexto.' },
        ],
      },
      {
        id: 'comparar', title: 'Antes y después',
        beats: [
          { dur: 3600, view: { kind: 'compare', id: 'cmp', phase: 'before' }, expanded: [], camera: 'all', highlight: null, surfaces: [], sim: null, caption: 'Es el mismo turno, con dos recorridos distintos.' },
          { dur: 7000, sim: { sim: 'antes' }, caption: 'Hoy, el turno depende de llamadas y de una libreta.' },
          { dur: 'sim', caption: 'Las esperas aparecen entre llamadas, agenda y recordatorios.' },
          { dur: 5200, view: { kind: 'compare', id: 'cmp', phase: 'shift' }, sim: null, caption: 'Algunos pasos desaparecen. Otros se hacen solos.' },
          { dur: 'sim', view: { kind: 'compare', id: 'cmp', phase: 'after' }, sim: { sim: 'despues' }, caption: 'El recorrido deja de depender de una libreta.' },
          { dur: 5600, highlight: ['cmp/revision', 'cmp/tarea', 'cmp/perseguir'], caption: 'El equipo conserva el control de cada decisión.' },
          { dur: 4200, highlight: null, caption: 'La agenda sigue siendo de la clínica.' },
        ],
      },
      {
        id: 'impacto', title: 'Lo que cambia',
        beats: [
          { dur: 4200, view: { kind: 'map' }, expanded: [], camera: 'all', highlight: null, surfaces: ['resumen'], sim: { sim: 'cierre' }, caption: 'No se trata de sacar personas de la clínica.' },
          { dur: 4600, caption: 'Se trata de sacar pasos repetidos del medio.' },
          { dur: 4400, caption: 'Cada clínica define qué se ordena primero.' },
          { dur: 5000, camera: { nodes: ['wa', 'asis', 'agenda', 'conf'] }, caption: 'RIVECT diseña el recorrido con vos.' },
        ],
      },
    ],
  },
};
