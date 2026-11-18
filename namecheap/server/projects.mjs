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
  pulso: '<span class="project-symbol pulso-symbol"><img src="/symbol.svg" alt="Pulso" width="32" height="32"></span>',
  studio: '<span class="project-symbol">S</span>',
  retail: '<span class="project-symbol">R</span>',
  landur: '<span class="project-symbol landur-logo"><img src="/landur-brand.png" alt="landur®" width="54" height="54"></span>'
};
const symbolFor = project => SYMBOLS[project.id] ?? `<span class="project-symbol">${escape(project.name.slice(0,1))}</span>`;
const GROUPS = [
  {id:'operacion',title:'Para trabajar',note:'Herramientas del día a día. Lo que hagas acá queda guardado.'},
  {id:'ventas',title:'Para mostrar',note:'Demos comerciales con datos de ejemplo. Solo administradores.'}
];
const projectRow = project => `<article class="project ${project.id} ${project.group}" data-spotlight="true"><div class="spotlight-glow" aria-hidden="true"></div><div class="card-glare" aria-hidden="true"></div><div class="project-id">${symbolFor(project)}<div><h3>${escape(project.name)}</h3><p class="kind">${escape(project.eyebrow.charAt(0)+project.eyebrow.slice(1).toLowerCase())}</p></div></div><p class="description">${escape(project.description)}</p>${project.links?.length?`<nav class="shortcuts" aria-label="Accesos directos de ${escape(project.name)}">${project.links.map(l=>`<a href="${escape(l.url)}">${escape(l.label)}</a>`).join('')}</nav>`:''}<div class="project-meta"><span class="access ${project.access}">${project.access==='editor'?'Edición':'Solo lectura'}</span><span class="status">${escape(project.status)}</span></div><a class="open" href="${escape(project.url)}">Abrir ${escape(project.name)}<span aria-hidden="true">↗</span></a></article>`;
const ADMIN_PANEL = `<section class="admin-panel" id="admin-panel" aria-labelledby="admin-title"><header class="admin-head"><p class="admin-eyebrow">Solo administradores</p><h2 id="admin-title">Administración del portal</h2><p>Administrá usuarios, invitaciones y permisos de Pulso y LANDUR. Cambiar rol, estado o permisos cierra las sesiones del usuario. Studio y Retail son solo para administradores.</p></header><div class="admin-tabs" role="tablist" aria-label="Secciones de administración"><button type="button" class="admin-tab" role="tab" id="tab-users" aria-controls="panel-users" aria-selected="true" tabindex="0">Usuarios</button><button type="button" class="admin-tab" role="tab" id="tab-invite" aria-controls="panel-invite" aria-selected="false" tabindex="-1">Invitar</button><button type="button" class="admin-tab" role="tab" id="tab-grants" aria-controls="panel-grants" aria-selected="false" tabindex="-1">Permisos</button><span class="admin-tab-indicator" aria-hidden="true"></span></div><div class="admin-tabpanel" role="tabpanel" id="panel-users" aria-labelledby="tab-users" tabindex="0"><div class="admin-toolbar"><label class="admin-search"><span>Buscar</span><input type="search" id="user-search" placeholder="Nombre o correo" autocomplete="off" spellcheck="false"></label><span id="user-count" class="admin-count" aria-live="polite"></span></div><div class="admin-table-wrap"><table class="admin-table" id="users-table"><caption class="sr-only">Usuarios del portal</caption><thead><tr><th scope="col">Usuario</th><th scope="col">Rol</th><th scope="col">Estado</th><th scope="col">Pulso</th><th scope="col">LANDUR</th><th scope="col"><span class="sr-only">Acciones</span></th></tr></thead><tbody id="users-body"><tr><td colspan="6" class="admin-empty">Cargando usuarios…</td></tr></tbody></table></div><p id="users-status" class="admin-status" role="status"></p></div><div class="admin-tabpanel" role="tabpanel" id="panel-invite" aria-labelledby="tab-invite" tabindex="0" hidden><form id="invite-form" class="admin-form" novalidate><label class="admin-field">Correo<input type="email" name="email" required maxlength="254" autocomplete="off" spellcheck="false" placeholder="nombre@empresa.com"></label><label class="admin-field">Rol<select name="role"><option value="member">Miembro</option><option value="admin">Administrador</option></select></label><label class="admin-field">Pulso<select name="pulso"><option value="">Sin acceso</option><option value="viewer">Solo lectura</option><option value="editor">Edición</option></select></label><label class="admin-field">LANDUR<select name="landur"><option value="">Sin acceso</option><option value="viewer">Solo lectura</option><option value="editor">Edición</option></select></label><button type="submit" class="admin-primary">Crear invitación</button></form><div id="invite-result" class="invite-result" hidden><label class="admin-field">Enlace de activación<input id="invite-url" type="text" readonly></label><button type="button" id="invite-copy" class="admin-secondary">Copiar enlace</button><p id="invite-expires" class="admin-hint"></p></div><p id="invite-status" class="admin-status" role="status"></p></div><div class="admin-tabpanel" role="tabpanel" id="panel-grants" aria-labelledby="tab-grants" tabindex="0" hidden><form id="grants-form" class="admin-form"><label class="admin-field">Usuario<select id="grant-user" name="id" required><option value="">Cargando usuarios…</option></select></label><label class="admin-field">Pulso<select name="pulso"><option value="">Sin acceso</option><option value="viewer">Solo lectura</option><option value="editor">Edición</option></select></label><label class="admin-field">LANDUR<select name="landur"><option value="">Sin acceso</option><option value="viewer">Solo lectura</option><option value="editor">Edición</option></select></label><button type="submit" class="admin-primary" disabled>Guardar permisos</button><p id="grants-status" class="admin-status" role="status"></p></form></div></section>`;
export function renderProjectsPage(user) {
  const projects=availableProjects(user);
  const first=escape(String(user.name??'').trim().split(/\s+/)[0]);
  const groups=GROUPS.map(g=>({...g,items:projects.filter(p=>p.group===g.id)})).filter(g=>g.items.length);
  const body=groups.map(g=>`<section class="group ${g.id}" aria-labelledby="g-${g.id}"><header><h2 id="g-${g.id}">${g.title}</h2><p>${g.note}</p></header><div class="rows">${g.items.map(projectRow).join('')}</div></section>`).join('')
    ||'<div class="empty"><h2>Todavía no tenés proyectos asignados.</h2><p>Solicitá acceso a un administrador. Tener cuenta en RIVECT no habilita proyectos automáticamente.</p></div>';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark"><meta name="theme-color" content="#11222C"><meta name="robots" content="noindex,nofollow"><title>Mis proyectos · RIVECT</title><link rel="stylesheet" href="/projects.css"><script type="module" src="/projects.mjs"></script></head><body><div class="ambient-canvas" aria-hidden="true"><div class="ambient-orb orb-1"></div><div class="ambient-orb orb-2"></div><div class="grid-pattern"></div></div><header class="top"><a class="brand" href="/portal" aria-label="RIVECT · Mis proyectos"><img src="/logo.svg" alt="RIVECT · Inteligencia que mueve" width="178" height="44"></a><div class="top-actions"><span class="who">${escape(user.name)}</span>${user.role==='admin'?'<a href="/admin">Administración</a>':''}<button id="logout">Cerrar sesión</button></div></header><main><section class="intro"><h1>Mis proyectos</h1><p>${first?`Hola, ${first}. `:''}${projects.length===1?'Tenés un proyecto habilitado.':`Tenés ${projects.length} proyectos habilitados.`}</p></section>${body}${user.role==='admin'?ADMIN_PANEL:''}<p id="portal-error" class="error" role="alert"></p><footer><span>RIVECT · Tecnología con propósito</span><span>Sesión privada · Acceso por proyecto</span></footer></main></body></html>`;
}