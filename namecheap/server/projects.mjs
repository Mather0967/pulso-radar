// Portal catalogue and permissions. A Pulso grant never implies a LANDUR grant.
export const PROJECTS = Object.freeze([
  {id:'pulso',name:'Pulso',eyebrow:'INVESTIGACIÓN Y OPERACIÓN',description:'Tu espacio de investigación, seguimiento comercial y laboratorios de automatización.',url:'/pulso',status:'Espacio operativo'},
  {id:'landur',name:'LANDUR',eyebrow:'CONTROL FINANCIERO',description:'Cuentas, movimientos, ventas y pendientes. Una mirada clara al dinero del negocio.',url:'/landur/',status:'Alfa · pruebas'}
]);
export function projectAccess(user, id='pulso') {
  if (!user || user.active !== true || !PROJECTS.some(p=>p.id===id)) return null;
  if (user.role==='admin') return 'editor';
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
    if (!PROJECTS.some(p=>p.id===id) || ![null,'viewer','editor'].includes(access)) throw Error('Proyecto o permiso no válido.');
    if(access===null)delete result[id];else result[id]=access;
  }
  return result;
}
const escape = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderProjectsPage(user) {
  const projects=availableProjects(user);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Mis proyectos · RIVECT</title><link rel="stylesheet" href="/projects.css"><script type="module" src="/projects.mjs"></script></head><body><header class="top"><a class="brand" href="/portal" aria-label="RIVECT · Mis proyectos"><img src="/projects-brand.svg" alt="RIVECT · Inteligencia que mueve" width="178" height="44"></a><div class="top-actions"><span>${escape(user.name)}</span>${user.role==='admin'?'<a href="/admin">Administración</a>':''}<button id="logout">Cerrar sesión ↗</button></div></header><main><section class="intro"><p class="eyebrow">TU ESPACIO DE TRABAJO</p><h1>Mis proyectos<span>.</span></h1><p>Un solo acceso. Cada proyecto, en su lugar.</p></section><section class="project-grid" aria-label="Proyectos disponibles">${projects.map(project=>`<article class="project ${project.id}"><div class="project-top">${project.id==='pulso'?'<span class="project-symbol">P</span>':'<span class="project-symbol landur-logo"><img src="/landur-brand.svg" alt="landur®" width="54" height="54"></span>'}<span class="badge">${escape(project.status)}</span></div><p class="eyebrow">${project.eyebrow}</p><h2>${project.name}</h2><p class="description">${project.description}</p><div class="project-bottom"><span class="access">${project.access==='editor'?'Edición habilitada':'Solo lectura'}</span><a class="open" href="${project.url}">Abrir ${project.name} <span aria-hidden="true">↗</span></a></div></article>`).join('')||'<div class="empty"><h2>Todavía no tenés proyectos asignados.</h2><p>Solicitá acceso a un administrador. Tener cuenta en RIVECT no habilita proyectos automáticamente.</p></div>'}</section>${user.role==='admin'?`<section class="permissions"><div><p class="eyebrow">ADMINISTRACIÓN</p><h2>Acceso a proyectos</h2><p>Los permisos de Pulso y LANDUR se asignan por separado. Revocar un permiso cierra las sesiones del usuario.</p></div><form id="grants-form"><label>Usuario<select id="grant-user" name="id" required><option value="">Cargando usuarios…</option></select></label><label>Pulso<select name="pulso"><option value="">Sin acceso</option><option value="viewer">Solo lectura</option><option value="editor">Edición</option></select></label><label>LANDUR<select name="landur"><option value="">Sin acceso</option><option value="viewer">Solo lectura</option><option value="editor">Edición</option></select></label><button type="submit" disabled>Guardar permisos</button><p id="grants-status" role="status"></p></form></section>`:''}<p id="portal-error" class="error" role="alert"></p><footer><span>RIVECT · Tecnología con propósito</span><span>Sesión privada · Acceso por proyecto</span></footer></main></body></html>`;
}
