// Portal catalogue and permissions. A Pulso grant never implies a LANDUR grant.
export const PROJECTS = Object.freeze([
  {id:'pulso',name:'Pulso',eyebrow:'INVESTIGACIÓN Y OPERACIÓN',description:'Tu espacio de investigación, seguimiento comercial y laboratorios de automatización.',url:'/pulso',status:'Espacio operativo',group:'operacion'},
  {id:'landur',name:'LANDUR',eyebrow:'CONTROL FINANCIERO',description:'Cuentas, movimientos, ventas y pendientes. Una mirada clara al dinero del negocio.',url:'/landur/',status:'Acceso privado',group:'operacion'},
  {id:'studio',name:'RIVECT Studio',eyebrow:'DEMOS COMERCIALES',description:'Recorridos visuales por rubro para mostrar en una visita lo que RIVECT puede hacer por un negocio.',url:'/studio/',status:'Uso interno',adminOnly:true,group:'ventas',links:[{label:'Gestión de restaurante',url:'/studio/restaurantes/'},{label:'Gestión odontológica',url:'/studio/odontologia/'}]},
  {id:'retail',name:'Rivect Retail Intelligence',eyebrow:'INTELIGENCIA COMERCIAL',description:'Demo interactiva para mostrar a una tienda cuánto tiempo y margen puede recuperar automatizando su operación.',url:'/retail/',status:'Uso interno',adminOnly:true,group:'ventas'}
]);
export function projectAccess(user, id='pulso') {
  if (!user || user.active !== true || !PROJECTS.some(p=>p.id===id)) return null;
  if (user.role==='admin') return 'editor';
  // Studio y Retail son herramientas internas de ventas: solo administradores, sin asignación por usuario.
  if (PROJECTS.find(p=>p.id===id).adminOnly) return null;
  return ['viewer','editor'].includes(user.projects?.[id]) ? user.projects[id] : null;
}
export const availableProjects = user => PROJECTS.flatMap(project => {
  const access=projectAccess(user,project.id);
  return access ? [{...project,access}] : [];
});
// A PATCH-style merge preserves other grants when the legacy admin UI saves Pulso.
export function mergeProjectGrants(current={}, body={}) {
  const result={...current};
  const changes={};
  if (Object.hasOwn(body,'access')) changes.pulso=['viewer','editor'].includes(body.access)?body.access:null;
  if (Object.hasOwn(body,'projects')) {
    if (!body.projects || typeof body.projects!=='object' || Array.isArray(body.projects)) throw Error('Permisos de proyectos inválidos.');
    Object.assign(changes,body.projects);
  }
  for (const [id,access] of Object.entries(changes)) {
    if (!PROJECTS.some(p=>p.id===id&&!p.adminOnly) || ![null,'viewer','editor'].includes(access)) throw Error('Proyecto o permiso no válido.');
    if(access===null)delete result[id];else result[id]=access;
  }
  return result;
}
const escape = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SYMBOLS = {
  pulso: '<span class="project-symbol">P</span>',
  studio: '<span class="project-symbol">S</span>',
  retail: '<span class="project-symbol">R</span>',
  landur: '<span class="project-symbol landur-logo"><img src="/landur-brand.png" alt="landur®" width="54" height="54"></span>'
};
const symbolFor = project => SYMBOLS[project.id] ?? `<span class="project-symbol">${escape(project.name.slice(0,1))}</span>`;
const GROUPS = [
  {id:'operacion',title:'Para trabajar',note:'Herramientas del día a día. Lo que hagas acá queda guardado.'},
  {id:'ventas',title:'Para mostrar',note:'Demos comerciales con datos de ejemplo. Solo administradores.'}
];
const projectRow = project => `<article class="project ${project.id} ${project.group}"><div class="project-id">${symbolFor(project)}<div><h3>${escape(project.name)}</h3><p class="kind">${escape(project.eyebrow.charAt(0)+project.eyebrow.slice(1).toLowerCase())}</p></div></div><p class="description">${escape(project.description)}</p>${project.links?.length?`<nav class="shortcuts" aria-label="Accesos directos de ${escape(project.name)}">${project.links.map(l=>`<a href="${escape(l.url)}">${escape(l.label)}</a>`).join('')}</nav>`:''}<div class="project-meta"><span class="access ${project.access}">${project.access==='editor'?'Edición':'Solo lectura'}</span><span class="status">${escape(project.status)}</span></div><a class="open" href="${escape(project.url)}">Abrir ${escape(project.name)}<span aria-hidden="true">↗</span></a></article>`;
export function renderProjectsPage(user) {
  const projects=availableProjects(user);
  const first=escape(String(user.name??'').trim().split(/\s+/)[0]);
  const groups=GROUPS.map(g=>({...g,items:projects.filter(p=>p.group===g.id)})).filter(g=>g.items.length);
  const body=groups.map(g=>`<section class="group ${g.id}" aria-labelledby="g-${g.id}"><header><h2 id="g-${g.id}">${g.title}</h2><p>${g.note}</p></header><div class="rows">${g.items.map(projectRow).join('')}</div></section>`).join('')
    ||'<div class="empty"><h2>Todavía no tenés proyectos asignados.</h2><p>Solicitá acceso a un administrador. Tener cuenta en RIVECT no habilita proyectos automáticamente.</p></div>';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="only light"><meta name="robots" content="noindex,nofollow"><title>Mis proyectos · RIVECT</title><link rel="stylesheet" href="/projects.css"><script type="module" src="/projects.mjs"></script></head><body><header class="top"><a class="brand" href="/portal" aria-label="RIVECT · Mis proyectos"><img src="/projects-brand.svg" alt="RIVECT · Inteligencia que mueve" width="178" height="44"></a><div class="top-actions"><span class="who">${escape(user.name)}</span>${user.role==='admin'?'<a href="/admin">Administración</a>':''}<button id="logout">Cerrar sesión</button></div></header><main><section class="intro"><h1>Mis proyectos</h1><p>${first?`Hola, ${first}. `:''}${projects.length===1?'Tenés un proyecto habilitado.':`Tenés ${projects.length} proyectos habilitados.`}</p></section>${body}${user.role==='admin'?`<section class="permissions" aria-labelledby="perm-title"><div><h2 id="perm-title">Acceso a proyectos</h2><p>Los permisos de Pulso y LANDUR se asignan por separado. Revocar un permiso cierra las sesiones del usuario. Studio y Retail solo están disponibles para administradores.</p></div><form id="grants-form"><label>Usuario<select id="grant-user" name="id" required><option value="">Cargando usuarios…</option></select></label><label>Pulso<select name="pulso"><option value="">Sin acceso</option><option value="viewer">Solo lectura</option><option value="editor">Edición</option></select></label><label>LANDUR<select name="landur"><option value="">Sin acceso</option><option value="viewer">Solo lectura</option><option value="editor">Edición</option></select></label><button type="submit" disabled>Guardar permisos</button><p id="grants-status" role="status"></p></form></section>`:''}<p id="portal-error" class="error" role="alert"></p><footer><span>RIVECT · Tecnología con propósito</span><span>Sesión privada · Acceso por proyecto</span></footer></main></body></html>`;
}