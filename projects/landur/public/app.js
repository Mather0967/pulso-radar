import { parseSpokenInvoice } from './voice.mjs';

const BASE = new URL('./', import.meta.url).pathname;
const endpoint = path => BASE + path.replace(/^\//, '');
const portalMode = document.documentElement.dataset.portal === 'true';
const $ = (selector, root = document) => root.querySelector(selector);
const app = $('#app'), modal = $('#modal');
// El reconocimiento puede seguir activo al cerrar el diálogo: cortarlo siempre.
modal.addEventListener('close',stopDictation);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths = {
 home:'M3 10 12 3l9 7v10H3z M9 20v-7h6v7', moves:'M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4',
 accounts:'M3 8 12 3l9 5H3m2 3v7m5-7v7m4-7v7m5-7v7M3 21h18', expense:'M6 3h12v18l-3-2-3 2-3-2-3 2V3m3 5h6m-6 4h6',
 sales:'M4 8h16l-1 13H5L4 8m4 0V6a4 4 0 0 1 8 0v2', pending:'M12 8v5m0 3h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18',
 settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',
 plus:'M12 5v14M5 12h14',arrow:'M5 12h14m-5-5 5 5-5 5',down:'M12 4v15m-5-5 5 5 5-5',up:'M12 20V5m-5 5 5-5 5 5',
 check:'M5 12l4 4L19 6',lock:'M6 10h12v11H6V10m3 0V6a3 3 0 0 1 6 0v4',calendar:'M4 5h16v16H4V5m4-3v6m8-6v6M4 11h16',
 cash:'M3 6h18v13H3V6m9 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6M6 12h.1M18 12h.1',wallet:'M3 6h16v14H3V6m0 0 14-3v3m-2 5h6v5h-6v-5',
 close:'m6 6 12 12M6 18 18 6',logout:'M10 4H4v16h6m-1-8h12m-4-4 4 4-4 4',download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
 more:'M5 12h.1M12 12h.1M19 12h.1',refresh:'M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 13-3l2 7M4 12l2 7a8 8 0 0 0 13-3',
 phone:'M7 2h10v20H7V2m4 17h2',info:'M12 11v6m0-10h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18',shield:'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3m-4 9 3 3 5-6',mic:'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3M5 11a7 7 0 0 0 14 0M12 18v3'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.expense}"/></svg>`;
const labels = {expense:'Gasto pagado',obligation:'Obligación',payment:'Pago',sale:'Venta',collection:'Cobro',commission:'Comisión',transfer:'Transferencia',withdrawal:'Retiro personal',account:'Cuenta'};
const viewLabels = {home:'Inicio',moves:'Movimientos',accounts:'Cuentas',expenses:'Egresos',sales:'Ventas',pending:'Pendientes',settings:'Configuración'};
const viewIcons = {home:'home',moves:'moves',accounts:'accounts',expenses:'expense',sales:'sales',pending:'pending',settings:'settings'};
let state = null, session = null, view = 'home', unit = '', query = '', filter = '', loadedAt = null, busy = false, pendingRequest = null, updateWorker = null, timer, authEpoch = 0, demoToken = null;
const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Montevideo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const fmt = (cents, currency = unit) => new Intl.NumberFormat('es-UY',{style:'currency',currency:currency || 'UYU',minimumFractionDigits:2}).format(cents/100);
const dateFmt = date => date ? new Intl.DateTimeFormat('es-UY',{day:'2-digit',month:'short',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z')) : 'Sin fecha';
const decimal = cents => { const sign=cents<0?'-':'', abs=Math.abs(cents); return `${sign}${Math.trunc(abs/100)}.${String(abs%100).padStart(2,'0')}`; };
const pill = (text, cls='gray') => `<span class="pill ${cls}">${escape(text)}</span>`;
function toast(message) { clearTimeout(timer); $('#toast').textContent=message;$('#toast').hidden=false;timer=setTimeout(()=>$('#toast').hidden=true,6000); }
// Memory-only fallback for Arena's embedded, synthetic demo. Never stored in
// localStorage/sessionStorage, URLs, Cache Storage or used for the private portal.
const demoHeaders = () => !portalMode && session?.demo && demoToken
  ? {'X-Landur-Demo-Session':demoToken} : {};
async function api(path, input, key) {
  if (!navigator.onLine) throw new Error('Sin conexión. No se guardó ningún cambio.');
  let response;
  try { response = await fetch(endpoint(path), {method:input === undefined ? 'GET':'POST',cache:'no-store',credentials:'same-origin',
    headers:input === undefined ? demoHeaders() : {...demoHeaders(),'Content-Type':'application/json','X-Landur-Request':'1',...(session?.csrf?{'X-CSRF-Token':session.csrf}:{}),...(key?{'Idempotency-Key':key}:{})},
    ...(input === undefined ? {} : {body:JSON.stringify(input)}),signal:AbortSignal.timeout(20000)}); }
  catch { const error=new Error(input===undefined?'No pudimos conectar con el servidor.':'No se pudo confirmar la respuesta. Reintentá con este mismo formulario para no duplicar la operación.');error.uncertain=input!==undefined;throw error; }
  let data;
  try { data=await response.json(); }
  catch { const error=new Error(input===undefined?'El servidor devolvió una respuesta incompleta.':'La respuesta quedó incompleta. Reintentá este mismo registro para verificar el resultado sin duplicarlo.');error.uncertain=input!==undefined;throw error; }
  if (!response.ok) { const error=new Error(data.error || 'No se pudo completar la operación.');error.status=response.status;error.uncertain=input!==undefined&&response.status>=500;if(response.status===401 && path!=='/api/login'){demoToken=null;lock('Tu sesión venció. Volvé a ingresar.');}throw error; }
  if(path==='/api/demo' && !portalMode && session?.demo && /^[a-f0-9]{64}$/.test(data.demoToken || ''))demoToken=data.demoToken;
  if(path==='/api/logout')demoToken=null;
  return data;
}
async function refresh() {
  const epoch=authEpoch;
  const fresh=await api('/api/state');
  if(epoch!==authEpoch)return;
  state=fresh;loadedAt=new Date();
  if(!state.totals.some(t=>t.currency===unit))unit=state.totals[0]?.currency || '';
  render();
}
function lock(message='') {
  authEpoch++;state=null;modal.close();modal.innerHTML='';pendingRequest=null;busy=false;
  app.innerHTML=`<div class="login"><section class="login-brand"><img class="brand-logo" src="${BASE}icon-512.png" alt="LANDUR®" loading="lazy" width="56" height="56"><div><span class="eyebrow">Tu espacio financiero</span><h1>Control financiero<br>del negocio.</h1><p>Saldos, cobros y compromisos en un solo registro. Cada cifra conserva su origen y su fecha.</p></div><footer>UNA SOLUCIÓN DE RIVECT</footer></section><main class="login-main" id="main"><div class="login-box"><span class="eyebrow muted">${session?.demo?'ENTORNO DE PRUEBA':'ACCESO PRIVADO'}</span><h2>${session?.demo?'Conocé tu espacio':'Bienvenido a LANDUR'}</h2><p>${session?.demo?'Explorá con datos sintéticos. No ingreses información financiera real en esta demostración.':'Ingresá con la contraseña configurada para esta aplicación.'}</p><form id="login-form">${session?.demo?'':`<label class="field">Contraseña<input type="password" name="password" autocomplete="current-password" required maxlength="256"></label>`}<p class="error" id="login-error" role="alert">${escape(message)}</p><button class="primary" type="submit">${session?.demo?'Explorar demostración':'Ingresar al espacio'} ${icon('arrow')}</button></form><p class="footnote">${navigator.onLine?'Conexión necesaria para consultar y guardar.':'Sin conexión. Volvé a conectarte para continuar.'} No se guarda una copia financiera offline en el navegador.</p><button class="text-btn" data-action="install">${icon('phone')} Instalar en el iPhone</button></div></main></div>`;
  if(portalMode){
    $('.login-box h2').textContent='Tu acceso está en RIVECT';
    $('#login-form').innerHTML='<p class="error" role="alert"></p><a class="primary" href="/login">Ingresar desde el portal ↗</a><a class="text-btn" href="/portal"><span>←</span> Mis proyectos</a>';
    $('#login-form .error').textContent=message||'';
    return;
  }
  $('#login-form').addEventListener('submit',async event=>{
    event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;
    try { await api(session?.demo?'/api/demo':'/api/login',session?.demo?{}:{password:new FormData(event.currentTarget).get('password')}); await refresh(); }
    catch(error){if($('#login-error'))$('#login-error').textContent=error.message;button.disabled=false;}
  });
}
const selectedOps = () => state.operations.filter(o=>!unit || o.currency===unit);
// Una operación revertida conserva su contra-asiento en el saldo, pero deja de ser un pendiente.
const outstanding = kind => selectedOps().filter(o=>o.kind===kind && o.amount>o.applied && !o.reversed_by);
function navButton(key){return `<button class="nav-button ${view===key?'active':''}" data-view="${key}" ${view===key?'aria-current="page"':''}>${icon(viewIcons[key])}<span>${viewLabels[key]}</span>${key==='pending'?`<span class="nav-count">${outstanding('obligation').length+outstanding('sale').length+2}</span>`:''}</button>`;}
function render() {
  if(!state)return;
  const heading = {home:['INICIO','Saldos y compromisos','Saldos reconstruidos desde el corte de cada cuenta y sus movimientos. No consulta tu banco.'],moves:['MOVIMIENTOS','Registro de operaciones','Tipo, origen, fecha y estado de cada registro. Ventas y cobros se guardan por separado.'],accounts:['CUENTAS','Cuentas y saldos','Un saldo por cuenta y moneda con su fecha de corte. Sin conversión automática.'],expenses:['EGRESOS','Gastos y deudas','Lo pagado descuenta caja. Lo pendiente queda como obligación hasta que registres el pago.'],sales:['VENTAS','Ventas y cobros','Una venta no es dinero disponible. Cada cobro se asocia a su venta con la comisión real.'],pending:['PENDIENTES','Lo que requiere decisión','Obligaciones vencidas o próximas, cobros sin registrar y reglas sin validar.'],settings:['CONFIGURACIÓN','Datos y alcance','Exportación, instalación y límites conocidos de esta versión.']}[view];
  app.innerHTML=`<aside class="sidebar"><div class="brand"><div class="wordmark">LANDUR<span>®</span></div><small>CONTROL FINANCIERO</small></div><div class="workspace"><div class="workspace-mark">L</div><div><strong>Mi negocio</strong><small>${state.demo?'Espacio de demostración':'Espacio privado'}</small></div></div><div class="nav-label">PRINCIPAL</div><nav aria-label="Navegación principal">${Object.keys(viewLabels).filter(k=>k!=='settings').map(navButton).join('')}</nav><div class="sidebar-bottom">${navButton('settings')}<button class="nav-button" data-action="install">${icon('phone')} Instalar aplicación</button><div class="sidebar-note">Datos en el servidor.<br>Sin conexión bancaria activa.</div><div class="rivect">POR <b>✳ RIVECT</b></div></div></aside><div class="shell"><header class="topbar"><div class="breadcrumb">Mi negocio <span>/</span> <strong>${viewLabels[view]}</strong></div><img class="brand-logo mobile-logo" src="${BASE}icon-512.png" alt="LANDUR®" loading="lazy" width="40" height="40"><div class="top-actions"><span class="top-date">${state.demo?'Octubre 2026 · muestra':new Intl.DateTimeFormat('es-UY',{day:'numeric',month:'long',year:'numeric'}).format(new Date())}</span><button class="icon-btn" data-action="refresh" aria-label="Actualizar datos">${icon('refresh')}</button><button class="icon-btn" data-action="logout" aria-label="Cerrar sesión">${icon('logout')}</button><div class="avatar" title="${escape(state.actor)}">${state.demo?'DE':'RA'}</div></div></header>${state.demo?'<div class="demo-bar"><span></span>DEMOSTRACIÓN · Datos sintéticos, no representan las finanzas reales de LANDUR.</div>':'<div class="demo-bar"><span></span>VERSIÓN PRIVADA · Pentesting independiente y prueba en iPhone real pendientes. No cargues datos reales todavía.</div>'}${updateWorker?'<div class="update-bar">Hay una actualización de la aplicación.<button class="mini-button" data-action="update">Actualizar</button></div>':''}<main class="page" id="main"><section class="heading"><div><div class="eyebrow">${heading[0]}</div><h1>${heading[1]}</h1><p>${heading[2]}</p></div><button class="primary" data-action="register">${icon('plus')} Registrar operación</button></section><div class="toolbar"><div class="period">${icon('calendar')} ${view==='home'?'Resumen acumulado · sin filtro de período':'Registros acumulados'}</div><label class="flex muted"><span class="eyebrow">Moneda</span><select id="currency" class="currency-select" aria-label="Moneda del resumen">${state.totals.length?state.totals.map(t=>`<option ${t.currency===unit?'selected':''}>${t.currency}</option>`).join(''):'<option value="">Sin cuentas</option>'}</select></label></div><div id="view-content">${content()}</div><footer class="page-footer"><span class="flex">${icon('lock')} Información guardada en el servidor · Sin conexiones bancarias activas</span><span>Última lectura ${loadedAt?.toLocaleTimeString('es-UY',{hour:'2-digit',minute:'2-digit'})} · LANDUR × RIVECT</span></footer></main></div><nav class="mobile-nav" aria-label="Navegación móvil"><button data-view="home" class="${view==='home'?'active':''}">${icon('home')}Inicio</button><button data-view="moves" class="${view==='moves'?'active':''}">${icon('moves')}Actividad</button><button data-action="register" class="register">${icon('plus')}Registrar</button><button data-view="pending" class="${view==='pending'?'active':''}">${icon('pending')}Pendientes</button><button data-action="menu">${icon('more')}Más</button></nav>`;
  if(portalMode){
    const back=document.createElement('a');back.href='/portal';back.className='portal-back';back.innerHTML='<span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5m7-7-7 7 7 7"/></svg></span> ← Mis proyectos';
    $('.shell').prepend(back);
    $('.avatar').textContent=(state.actor||'').trim().split(/\s+/).slice(0,2).map(s=>s[0]||'').join('').toUpperCase();
    if(state.access==='viewer'){
      document.querySelectorAll('button[data-action="register"],button[data-action="import"],button[data-form],button[data-pay]').forEach(b=>{b.disabled=true;b.title='Acceso de solo lectura';});
      const note=document.createElement('span');note.className='portal-access';note.textContent='Solo lectura';back.append(note);
    }
  }
  $('#currency').addEventListener('change',e=>{unit=e.target.value;render();});
  $('#search')?.addEventListener('input',e=>{query=e.target.value;$('#operation-table').innerHTML=table(filteredOps());});
  $('#kind-filter')?.addEventListener('change',e=>{filter=e.target.value;$('#operation-table').innerHTML=table(filteredOps());});
  app.addEventListener('click',async event=>{
    const opBtn=event.target.closest('[data-operation]');
    if(opBtn){detail(opBtn.getAttribute('data-operation'));return;}
    const paymentBtn=event.target.closest('[data-delete-payment]');
    if(paymentBtn){const id=paymentBtn.getAttribute('data-delete-payment');if(!confirm('Eliminar este pago del saldo. La operación original queda registrada pero el dinero vuelve a la cuenta. ¿Continuás?'))return;try{await api('/api/commands',{kind:'payment.delete',paymentId:id});await refresh();toast('Pago eliminado del saldo.');}catch(error){toast(error.message);}}
    const revertBtn=event.target.closest('[data-revert]');
    if(revertBtn){const id=revertBtn.getAttribute('data-revert');if(!confirm('Eliminar este registro, sus comisiones y sus contra-asientos del saldo, con la cuenta de auditoría correspondiente. ¿Continuás?'))return;try{await api('/api/commands',{kind:'reversal',operationId:id});await refresh();toast('Registro revertido.');}catch(error){toast(error.message);}}
    const evidenceBtn=event.target.closest('[data-remove-evidence]');
    if(evidenceBtn){const id=evidenceBtn.getAttribute('data-remove-evidence');if(!confirm('Quitar este comprobante del registro. No se borra del todo, queda constancia en el registro. ¿Continuás?'))return;try{await api('/api/commands',{kind:'evidence.remove',evidenceId:id});await refresh();toast('Comprobante quitado.');}catch(error){toast(error.message);}}
    const payBtn=event.target.closest('[data-pay]');
    if(payBtn){const id=payBtn.getAttribute('data-pay');const type=payBtn.getAttribute('data-type')||'payment';form(type,id);return;}
    const attachBtn=event.target.closest('[data-attach]');
    if(attachBtn){const id=attachBtn.getAttribute('data-attach');attachFile(id,{files:[document.querySelector('[data-action="attach-file"]')?.files?.[0]]||null});return;}
    const closeBtn=event.target.closest('[data-action="close"]'); if(closeBtn){modal.close();return;}
    const importBtn=event.target.closest('[data-action="import"]'); if(importBtn)opendialog('Importar CSV','Una plantilla acotada con vista previa.');
    const exportBtn=event.target.closest('[data-action="export"]'); if(exportBtn){window.location.href=endpoint('/api/export.csv');return;}
    const registerBtn=event.target.closest('[data-action="register"]'); if(registerBtn){form('expense');return;}
    const policyBtn=event.target.closest('[data-action="policy"]'); if(policyBtn){openDialog('Disponible estimado','Reglas pendientes','<div class="rule-list"><div class="rule-item"><strong>Regla aún no activada</strong><p>El cálculo de disponible descontando obligaciones, retiros y reservas todavía no tiene regla definida. Hasta tanto, el valor muestra «Por validar».</div></div>');return;}
    const updateBtn=event.target.closest('[data-action="update"]'); if(updateBtn){return;}
    const menuBtn=event.target.closest('[data-action="menu"]'); if(menuBtn)openMenu('Tu espacio','Elegí una sección.',`<div class="dialog-body settings-stack">${['accounts','expenses','sales','settings'].map(k=>`<button class="secondary" data-view="${k}">${icon(viewIcons[k])} ${viewLabels[k]}</button>`).join('')}</div>`);
    const launchBtn=event.target.closest('[data-action="experiments"]'); if(launchBtn){const base=`${location.origin}${location.pathname}`;const side=`${base}side-by-side/qa.html`;window.open(side,'_blank');return;}
  });
  app.addEventListener('click',event=>{const viewBtn=event.target.closest('[data-view]');if(viewBtn){view=viewBtn.getAttribute('data-view');render();};});
  app.addEventListener('click',event=>{const formBtn=event.target.closest('[data-form]');if(formBtn){const kind=formBtn.getAttribute('data-form')==='account'?'account':'expense';form(kind);};});
  app.addEventListener('click',event=>{const installBtn=event.target.closest('[data-action="install"]');if(installBtn)install();});
  app.addEventListener('click',event=>{const logoutBtn=event.target.closest('[data-action="logout"]');if(logoutBtn){api('/api/logout').then(()=>{session=null;lock('Sesión cerrada.');});return;};});
}
function content(){
  if(view==='home')return home();
  if(view==='accounts')return accounts();
  if(view==='pending')return pending();
  if(view==='settings')return settings();
  return `<div class="toolbar"><input class="search" id="search" placeholder="Buscar concepto o referencia…" aria-label="Buscar operaciones" value="${escape(query)}"><div class="flex"><select id="kind-filter" class="filter-select" aria-label="Tipo de operación"><option value="">Todos los tipos</option>${Object.entries(labels).filter(([k])=>k!=='account').map(([k,v])=>`<option value="${k}" ${filter===k?'selected':''}>${v}</option>`).join('')}</select><button class="secondary" data-action="import">${icon('up')} Importar</button><button class="secondary" data-action="export">${icon('download')} CSV</button></div></div>${view==='sales'?'<p class="form-note">Se muestran ventas y cobros por separado. Los costos y repartos automáticos todavía no están habilitados.</p>':''}<section class="card activity-card" id="operation-table">${table(filteredOps())}</section>`;
}
function home(){
  const t=state.totals.find(t=>t.currency===unit);
  if(!t)return `<section class="card"><div class="empty">${icon('accounts')}<h2>Todavía no hay cuentas</h2><p>Registrá una cuenta con su saldo inicial y su fecha de corte.<br>No hace falta conectar un banco.</p><button class="primary" data-form="account">${icon('plus')} Agregar mi primera cuenta</button></div></section>`;
  return `<section class="summary-grid" aria-label="Resumen por moneda"><article class="stat dark"><div class="stat-label">Saldo registrado ${icon('wallet')}</div><div class="stat-value">${fmt(t.balance)}</div><div class="stat-note">${state.accounts.filter(a=>a.currency===unit).length} cuentas · reconstruido desde el corte</div></article><article class="stat"><div class="stat-label">Obligaciones pendientes ${icon('expense')}</div><div class="stat-value">${fmt(t.payable)}</div><div class="stat-note">${outstanding('obligation').length} compromisos por pagar</div></article><article class="stat"><div class="stat-label">Por cobrar ${icon('down')}</div><div class="stat-value">${fmt(t.receivable)}</div><div class="stat-note">Ventas pendientes · no es saldo</div></article><article class="stat"><div class="stat-label">Disponible estimado ${icon('info')}</div><div class="stat-value pending">Por validar</div><button class="stat-link" data-action="policy">Ver reglas pendientes</button></article></section><div class="main-grid"><div><section class="card"><div class="card-head"><div><h2>Tus cuentas</h2><p>Dónde está el dinero de tu negocio</p></div><button class="text-btn" data-view="accounts">Ver todas ${icon('arrow')}</button></div><div class="account-list">${state.accounts.filter(a=>a.currency===unit).map(accountRow).join('')}</div><div class="card-foot">${icon('info')} Saldos calculados desde la apertura y movimientos registrados.</div></section><section class="card activity-card"><div class="card-head"><div><h2>Últimas operaciones</h2><p>Origen y tipo, siempre a la vista</p></div><button class="text-btn" data-view="moves">Ver todas ${icon('arrow')}</button></div>${table(selectedOps().slice(0,5),true)}</section></div><div><section class="card"><div class="card-head"><div><h2>Próximos pagos</h2><p>Compromisos que requieren atención</p></div>${pill(`${outstanding('obligation').length} pendientes`,'amber')}</div>${obligations(outstanding('obligation').sort((a,b)=>a.due.localeCompare(b.due)).slice(0,4))}<div class="card-foot"><button class="text-btn" data-view="pending">Revisar todos los pendientes ${icon('arrow')}</button></div></section><aside class="notice-card">${icon('shield')}<div><h3>Saldo no es dinero libre</h3><p>Antes de calcular el disponible, hay que validar qué obligaciones y reservas descontar. No mostramos una certeza que todavía no tenemos.</p><button class="text-btn" data-action="policy">Revisar criterios ${icon('arrow')}</button></div></aside><aside class="notice-card">${icon('phone')}<div><h3>LANDUR en tu iPhone</h3><p>Instalá la app desde Safari. Necesita conexión: no guarda una copia financiera en el teléfono.</p><button class="text-btn" data-action="install">Cómo instalar ${icon('arrow')}</button></div></aside></div></div>`;
}
function accountRow(a){return `<div class="account-row"><div class="account-logo ${a.kind}">${icon(a.kind==='bank'?'accounts':a.kind==='cash'?'cash':'wallet')}</div><div><div class="account-name">${escape(a.name)}</div><div class="account-sub">${a.verified?'Apertura verificada':'Apertura sin verificar'} · ${dateFmt(a.cutoff)}</div></div><div class="account-amount">${fmt(a.balance,a.currency)}<div class="account-sub">${a.accessible?'Fondos accesibles':'Acceso restringido'}</div></div></div>`;}
function accounts(){return `<div class="toolbar"><p class="muted">Monedas separadas. Sin conversiones automáticas.</p><button class="secondary" data-form="account">${icon('plus')} Agregar cuenta</button></div><div class="accounts-grid">${state.accounts.filter(a=>!unit||a.currency===unit).map(a=>`<article class="card account-card"><div class="flex spread"><div class="account-logo ${a.kind}">${icon(a.kind==='bank'?'accounts':a.kind==='cash'?'cash':'wallet')}</div>${pill(a.verified?'Apertura verificada':'Sin verificar',a.verified?'green':'amber')}</div><h2>${escape(a.name)}</h2><p class="muted eyebrow">${a.currency} · ${a.kind==='bank'?'Cuenta bancaria':a.kind==='cash'?'Efectivo':'Billetera digital'}</p><div class="stat-value">${fmt(a.balance,a.currency)}</div><dl><dt>Saldo inicial al inicio del ${dateFmt(a.cutoff)}</dt><dd>${fmt(a.opening,a.currency)}</dd><dt>Accesibilidad declarada</dt><dd>${a.accessible?'Fondos accesibles':'Fondos restringidos'}</dd><dt>Identificador para importación CSV</dt><dd><code>${escape(a.id)}</code></dd></dl><div class="account-actions"><button class="text-btn" data-account="${a.id}">Ver movimientos ${icon('arrow')}</button>${state.access==='viewer'?'':`<button class="text-btn danger" data-delete-account="${a.id}">Eliminar cuenta</button>`}</div></article>`).join('') || '<div class="card empty">Todavía no hay cuentas en esta moneda.</div>'}</div>`;}
function filteredOps(){return selectedOps().filter(o=>(view!=='expenses'||['expense','obligation','payment','commission'].includes(o.kind))&&(view!=='sales'||['sale','collection'].includes(o.kind))&&(!filter||o.kind===filter)&&(!query||[o.concept,o.source,o.external_id].join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase())));}
function opStatus(o){
  if(o.reversed_by)return pill('Revertido','gray');
  if(o.kind==='reversal')return pill('Reversión','gray');
  if(['sale','obligation'].includes(o.kind))return o.applied===o.amount?pill(o.kind==='sale'?'Cobrado':'Pagado','green'):pill(o.applied?'Parcial':'Pendiente','amber');
  return pill(o.kind==='transfer'?'Entre cuentas':'Registrado',o.kind==='transfer'?'blue':'gray');
}
function table(ops,compact=false){
  if(!ops.length)return '<div class="empty">Todavía no hay operaciones para mostrar.<br>Registrá una operación o cambiá los filtros.</div>';
  return `<div class="table-scroll"><table class="table"><thead><tr><th>Concepto / origen</th>${compact?'':'<th class="hide-mobile">Fecha</th>'}<th class="hide-mobile">Estado</th><th>Importe</th></tr></thead><tbody>${ops.map(o=>`<tr><td><div class="concept-cell"><div class="op-icon">${icon(o.kind==='collection'?'down':o.kind==='transfer'?'moves':o.kind==='sale'?'sales':'up')}</div><button class="concept-button" data-operation="${o.id}">${escape(o.concept)}<span class="concept-sub">${labels[o.kind]} · ${escape(o.source)}</span></button></div></td>${compact?'':`<td class="hide-mobile muted">${dateFmt(o.date)}</td>`}<td class="hide-mobile">${opStatus(o)}</td><td class="amount ${o.reversed_by?'reversed':o.kind==='collection'?'positive':['expense','payment','withdrawal'].includes(o.kind)?'negative':''}">${fmt(o.amount,o.currency)}</td></tr>`).join('')}</tbody></table></div>`;
}
function obligations(ops,receivable=false){return ops.length?`<div class="obligation-list">${ops.map(o=>`<div class="obligation-row"><div class="date-tile"><b>${(o.due||o.date).slice(-2)}</b><small>${new Intl.DateTimeFormat('es-UY',{month:'short',timeZone:'UTC'}).format(new Date((o.due||o.date)+'T12:00:00Z'))}</small></div><div class="obligation-body"><strong>${escape(o.concept)}</strong><p>${receivable?'Venta del ':o.due<today()?'Venció el ':'Vence el '}${dateFmt(o.due||o.date)}${o.applied?' · pago parcial':''}</p></div><div class="obligation-right"><b>${fmt(o.amount-o.applied,o.currency)}</b><button class="mini-button" data-pay="${o.id}" data-type="${receivable?'collection':'payment'}">${receivable?'Registrar cobro':'Registrar pago'}</button></div></div>`).join('')}</div>`:'<div class="empty">Sin pendientes en esta moneda.</div>';}
function pending(){return `<div class="main-grid"><div class="settings-stack"><section class="card"><div class="card-head"><h2>Obligaciones por pagar</h2>${pill(outstanding('obligation').length,'amber')}</div>${obligations(outstanding('obligation').sort((a,b)=>a.due.localeCompare(b.due)))}</section><section class="card"><div class="card-head"><h2>Ventas por cobrar</h2>${pill(outstanding('sale').length,'blue')}</div>${obligations(outstanding('sale'),true)}</section>${duplicatesCard()}${incompleteCard()}</div><section class="card"><div class="card-head"><h2>Decisiones pendientes</h2>${icon('info')}</div><div class="rule-list"><div class="rule-item"><strong>Disponible y reservas</strong><p>Validar qué compromisos reducen el disponible y cómo evitar descuentos duplicados. El cálculo permanece bloqueado.</p></div><div class="rule-item"><strong>Reinversión mayorista: 25 % o 30 %</strong><p>Los ejemplos difieren. No hay un porcentaje automático hasta confirmar las reglas con Rafa.</p></div><div class="rule-item"><strong>Calidad de la información</strong><p>${state.accounts.filter(a=>!a.verified).length} cuentas con apertura sin verificar. Los saldos actuales se reconstruyen a partir de los registros; no son una consulta bancaria en vivo.</p></div></div></section></div>`;}
function settings(){return `<div class="main-grid"><div class="settings-stack"><section class="card"><h2>Datos e intercambio</h2><p>Plantilla CSV acotada, con vista previa y referencias obligatorias para no duplicar registros. No es un conector bancario.</p><div class="flex"><button class="secondary" data-action="import">${icon('up')} Importar CSV</button><button class="secondary" data-action="export">${icon('download')} Exportar CSV</button></div></section><section class="card"><h2>Instalación en iPhone</h2><p>La PWA se instala desde Safari y necesita conexión para consultar o guardar información financiera.</p><button class="secondary" data-action="install">${icon('phone')} Ver instrucciones</button></section><section class="card"><h2>Alcance de esta versión</h2><p>Sin conexiones bancarias ni de tienda activas, sin reservas operativas y sin repartos automáticos: nada de eso se inventa sin validar las reglas primero. Los comprobantes se adjuntan a su operación y quedan en el servidor privado, y las correcciones se hacen revirtiendo con contra-asiento auditado, nunca borrando. ${portalMode?'Usuarios y permisos gestionados en el portal RIVECT.':'Configuración de usuarios pendiente.'} Falta el pentesting independiente y la prueba en iPhone real antes de cargar datos reales.</p><button class="secondary" data-action="logout">${icon('logout')} Cerrar sesión</button></section></div><section class="card"><div class="card-head"><h2>Registro de actividad</h2>${icon('shield')}</div><div class="rule-list">${state.audit.map(a=>`<div class="audit-row"><span>${escape(a.action)}<span class="concept-sub">${escape(a.actor)}</span></span><span class="muted">${new Date(a.at).toLocaleString('es-UY')}</span></div>`).join('')||'<div class="empty">Sin actividad todavía.</div>'}</div></section></div>`;}
// Comprobantes: el archivo se reduce en el teléfono antes de subir, porque una foto de
// iPhone pesa varios megabytes y el servidor acepta hasta 1,5 MB. Si el navegador no puede
// redimensionar (un PDF, o una imagen que no sabe decodificar), se envía tal cual y el
// límite lo aplica el servidor: nunca se confía en el tamaño que declara el cliente.
const EVIDENCE_LIMIT = 1572864;
const evidenceOf = id => (state.evidence || []).filter(entry => entry.operation === id);
const fileToBase64 = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
  reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
  reader.readAsDataURL(file);
});
async function prepareEvidence(file) {
  if (file.type === 'application/pdf') return {name:file.name, mime:file.type, data:await fileToBase64(file)};
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const encoded = canvas.toDataURL('image/jpeg', 0.82);
    return {name:`${file.name.replace(/\.[^.]+$/, '') || 'comprobante'}.jpg`, mime:'image/jpeg', data:encoded.slice(encoded.indexOf(',') + 1)};
  } catch { return {name:file.name || 'comprobante', mime:file.type, data:await fileToBase64(file)}; }
}
async function uploadEvidence(operationId, file, key) {
  const prepared = await prepareEvidence(file);
  if (prepared.data.length > Math.floor(EVIDENCE_LIMIT * 4 / 3))
    throw new Error('El comprobante supera 1,5 MB. Sacá la foto con menos resolución e intentá otra vez.');
  return api('/api/evidence', {operationId, ...prepared}, key || crypto.randomUUID());
}
function evidenceRow(entry) {
  const href = endpoint(`/api/evidence/${encodeURIComponent(entry.id)}`);
  return `<div class="evidence-row"><a class="evidence-open" href="${escape(href)}" target="_blank" rel="noopener">${entry.mime === 'application/pdf' ? '<span class="evidence-kind">PDF</span>' : `<img class="evidence-thumb" src="${escape(href)}" alt="" loading="lazy">`}<span class="evidence-name">${escape(entry.name)}<span class="concept-sub">${Math.max(1, Math.round(entry.bytes / 1024))} KB · ${dateFmt(entry.created_at.slice(0, 10))}</span></span></a>${state.access==='viewer'?'':`<button class="evidence-remove" data-remove-evidence="${escape(entry.id)}">Quitar</button>`}</div>`;
}
function evidenceSection(operationId, attached, editable) {
  return `${attached.length ? `<div class="evidence-list">${attached.map(evidenceRow).join('')}</div>` : '<p class="detail-note">Sin comprobante adjunto. Es opcional: un gasto sin factura también se registra.</p>'}${editable ? '<input class="hidden-file" type="file" id="evidence-file" accept="image/jpeg,image/png,image/webp,application/pdf"><p class="form-note" id="evidence-status" role="status"></p>' : ''}`;
}
async function attachFile(operationId, input) {
  const file = input?.files?.[0];
  if (!file) return;
  const status = $('#evidence-status');
  input.disabled = true;
  try {
    if (status) status.textContent = 'Preparando y subiendo el comprobante…';
    await uploadEvidence(operationId, file);
    await refresh();
    detail(operationId);
    toast('Comprobante adjuntado.');
  } catch (error) {
    input.disabled = false;
    if (status) status.textContent = '';
    toast(error.message);
  }
}
// Dos registros manuales con el mismo tipo, moneda, importe, fecha y cuenta, y el mismo
// concepto escrito, son una coincidencia fuerte: se muestran para revisar y nunca se
// fusionan solos. Compartir solo importe y fecha no alcanza: la propia demo tiene dos
// gastos distintos de $1.250 el mismo día y marcarlos como duplicados sería ruido.
function doubtfulDuplicates() {
  const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const groups = new Map();
  for (const o of selectedOps().filter(o => !o.reversed_by && !['reversal','commission'].includes(o.kind))) {
    const account = (state.entries || []).filter(e => e.operation === o.id).map(e => e.account).sort().join('+');
    const key = [o.kind, o.currency, o.amount, o.date, account, normalize(o.concept)].join('|');
    groups.set(key, [...(groups.get(key) || []), o]);
  }
  return [...groups.values()].filter(list => list.length > 1 && list.filter(o => !o.external_id).length > 1);
}
// Revisión humana, nunca automática: la app señala y no decide.
function duplicatesCard() {
  const list = doubtfulDuplicates();
  return `<section class="card"><div class="card-head"><h2>Duplicados dudosos</h2>${list.length ? pill(`${list.length} por revisar`, 'amber') : pill('Sin coincidencias', 'green')}</div>${list.length ? `<div class="rule-list">${list.map(group => `<div class="rule-item"><div class="duplicate-group">${group.map(o => `<button class="concept-button" data-operation="${o.id}">${escape(o.concept)}<span class="concept-sub">${labels[o.kind]} · ${dateFmt(o.date)} · ${fmt(o.amount, o.currency)}</span></button>`).join('')}</div><p>${group.length} registros con el mismo importe, la misma cuenta y la misma fecha, escritos con el mismo concepto. No se fusionan solos: abrí cada uno, confirmá cuál es el duplicado y revertí el que sobre.</p></div>`).join('')}</div>` : '<div class="empty">Ningún par de registros manuales coincide en tipo, moneda, importe y fecha.</div>'}</section>`;
}
function incompleteCard() {
  const overdue = outstanding('obligation').filter(o => o.due < today());
  const unverified = state.accounts.filter(a => !a.verified);
  const withoutReceipt = selectedOps().filter(o => !o.reversed_by && ['expense','obligation','sale'].includes(o.kind) && !evidenceOf(o.id).length);
  const items = [
    overdue.length ? `${overdue.length} obligaciones vencidas y sin pago registrado` : 'Ninguna obligación vencida',
    unverified.length ? `${unverified.length} cuentas con apertura sin verificar contra su fuente` : 'Todas las aperturas de cuenta verificadas',
    withoutReceipt.length ? `${withoutReceipt.length} registros sin comprobante adjunto (es opcional)` : 'Todos los registros tienen comprobante',
  ];
  const open = items.filter(item => !/^(Ninguna|Todas|Todos)/.test(item)).length;
  return `<section class="card"><div class="card-head"><h2>Información incompleta</h2>${pill(open ? `${open} ${open === 1 ? 'punto' : 'puntos'} por revisar` : 'Sin faltantes', open ? 'amber' : 'green')}</div><div class="rule-list">${items.map(item => `<div class="rule-item"><p>${escape(item)}. Lo que falta no se cuenta como cero ni como verificado.</p></div>`).join('')}</div></section>`;
}
function openDialog(title,subtitle,body,footer=''){
  modal.innerHTML=`<div class="dialog-head"><div><h2 id="dialog-title">${escape(title)}</h2>${subtitle?`<p>${escape(subtitle)}</p>`:''}</div><button class="icon-btn" data-action="close" aria-label="Cerrar diálogo">${icon('close')}</button></div>${body}${footer}`;
  if(!modal.open)modal.showModal();
}
function openMenu(title,subtitle,body){
  openDialog(title,subtitle,body);
}
function field(label,name,type='text',value='',wide=false,extra=''){
  return `<label class="field ${wide?'wide':''}">${label}<input name="${name}" type="${type}" value="${escape(value)}" ${extra}></label>`;
}
function select(label,name,options,wide=false){return `<label class="field ${wide?'wide':''}">${label}<select name="${name}" required>${options}</select></label>`;}
// Dictación: complementa al teclado, no lo reemplaza. Solo campos de texto libre;
// importes y fechas se tipean a mano porque el reconocimiento de números no es fiable.
// Chrome delega el reconocimiento en su proveedor: requiere conexión y, en producción, HTTPS.
const SPEECH = window.SpeechRecognition || window.webkitSpeechRecognition;
let dictation = null, invoiceRecognition = null;
function stopDictation(){
  // El dictado de factura completa se corta con el mismo cierre del diálogo.
  if(invoiceRecognition){const current=invoiceRecognition;invoiceRecognition=null;try{current.stop();}catch{}}
  if(!dictation)return;
  const current=dictation;dictation=null;
  current.button.classList.remove('recording');
  current.button.setAttribute('aria-pressed','false');
  try{current.recognition.stop();}catch{}
}
function dictate(button,input){
  if(dictation?.button===button){stopDictation();return;}
  stopDictation();
  const recognition=new SPEECH();
  const base=input.value.trim()?input.value.trim()+' ':'';
  recognition.lang='es-UY';
  recognition.interimResults=true;
  recognition.continuous=false;
  recognition.onresult=event=>{
    let text='';
    for(const result of event.results)if(result.isFinal)text+=result[0].transcript;
    if(text)input.value=(base+text).trim();
  };
  recognition.onerror=event=>{
    stopDictation();
    toast(event.error==='not-allowed'||event.error==='service-not-allowed'
      ? 'Permití el micrófono en los ajustes del navegador para dictar.'
      : 'No se pudo dictar. Escribí el campo a mano.');
  };
  recognition.onend=()=>{if(dictation?.recognition===recognition)stopDictation();};
  dictation={recognition,button};
  button.classList.add('recording');
  button.setAttribute('aria-pressed','true');
  try{recognition.start();}catch{stopDictation();toast('No se pudo iniciar el micrófono.');}
}
function attachDictation(root){
  if(!SPEECH)return;
  for(const input of root.querySelectorAll('[data-dictate]')){
    const label=(input.parentElement?.textContent||'').trim().split('\n')[0];
    const button=document.createElement('button');
    button.type='button';button.className='dictate';button.innerHTML=icon('mic');
    button.setAttribute('aria-label',label?`Dictar ${label}`:'Dictar por voz');
    button.setAttribute('aria-pressed','false');
    button.title='Dictar por voz';
    button.addEventListener('click',()=>dictate(button,input));
    input.after(button);
  }
}
// Dictado de la factura completa: una sola frase llena varios campos. El resultado
// se muestra siempre antes de aplicarse, porque un importe mal escuchado es un error
// contable. Los campos se completan; guardar sigue siendo una acción aparte.
function wireVoice(formEl,kind){
  const start=$('#voice-start'),resultBox=$('#voice-result');
  if(!start||!resultBox)return;
  if(!SPEECH){start.disabled=true;start.textContent='Este navegador no permite dictar';return;}
  let recognition=null,listening=false,generation=0;
  const reset=()=>{listening=false;start.classList.remove('recording');start.innerHTML=`${icon('mic')} Dictar la factura`;};
  start.addEventListener('click',()=>{
    if(listening){try{recognition?.stop();}catch{}return;}
    stopDictation();
    const run=++generation;
    recognition=new SPEECH();
    recognition.lang='es-UY';recognition.interimResults=false;recognition.continuous=false;
    invoiceRecognition=recognition;
    listening=true;start.classList.add('recording');start.textContent='Escuchando… tocá para detener';
    recognition.onresult=event=>{
      if(run!==generation||invoiceRecognition!==recognition)return;
      listening=false;start.classList.remove('recording');start.innerHTML=`${icon('mic')} Dictar la factura`;
      const said=[...event.results].map(result=>result[0].transcript).join(' ').trim();
      if(said)showSpokenInvoice(resultBox,formEl,kind,said);
    };
    recognition.onerror=event=>{
      if(run!==generation||invoiceRecognition!==recognition)return;
      toast(event.error==='not-allowed'||event.error==='service-not-allowed'
        ? 'Permití el micrófono en los ajustes del navegador para dictar.'
        : 'No se pudo dictar. Escribí los campos a mano.');
    };
    recognition.onend=()=>{
      if(run!==generation||invoiceRecognition!==recognition)return;
      invoiceRecognition=null;reset();
    };
    try{recognition.start();}catch{if(run===generation){invoiceRecognition=null;reset();toast('No se pudo iniciar el micrófono.');}}
  });
}
function showSpokenInvoice(resultBox,formEl,kind,said){
  const parsed=parseSpokenInvoice(said,{today:today(),currency:formEl.elements.currency?.value||unit});
  const rows=[['Tipo',parsed.kind&&parsed.kind!==kind?`Cambiar a ${labels[parsed.kind].toLowerCase()}`:labels[kind]],
    ['Concepto',parsed.concept||'Sin reconocer'],
    ['Importe',parsed.cents?fmt(parsed.cents,parsed.currency||unit):'Sin reconocer'],
    ['Fecha',parsed.date?dateFmt(parsed.date):'La de hoy']];
  if(parsed.due)rows.push(['Vencimiento',dateFmt(parsed.due)]);
  const usable=!!(parsed.concept||parsed.cents);
  resultBox.innerHTML=`<div class="voice-result"><p class="voice-said">«${escape(said)}»</p><dl class="voice-fields">${rows.map(([key,value])=>`<div><dt>${escape(key)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl>${parsed.warnings.map(w=>`<p class="voice-warning">${escape(w)}</p>`).join('')}<div class="voice-actions"><button type="button" class="primary" id="voice-apply" ${usable?'':'disabled'}>Usar estos datos</button><button type="button" class="text-btn" id="voice-discard">Descartar</button></div><p class="voice-hint">Nada se guardó todavía. Revisá el importe: el dictado puede confundir cifras.</p></div>`;
  $('#voice-discard').onclick=()=>{resultBox.innerHTML='';};
  $('#voice-apply').onclick=()=>applySpoken(formEl,kind,parsed);
}
function applySpoken(formEl,kind,parsed){
  // Cambiar el tipo obliga a reconstruir el formulario, porque cambian sus campos.
  if(parsed.kind&&parsed.kind!==kind){form(parsed.kind,undefined,parsed);return;}
  if(parsed.concept&&formEl.elements.concept)formEl.elements.concept.value=parsed.concept;
  if(parsed.amountText&&formEl.elements.amount)formEl.elements.amount.value=parsed.amountText;
  if(parsed.date&&formEl.elements.date)formEl.elements.date.value=parsed.date;
  if(parsed.due&&formEl.elements.due)formEl.elements.due.value=parsed.due;
  if(parsed.currency&&formEl.elements.currency&&formEl.elements.currency.value!==parsed.currency){
    formEl.elements.currency.value=parsed.currency;
    formEl.elements.currency.dispatchEvent(new Event('change'));
  }
  $('#voice-result').innerHTML='';
  toast('Campos completados desde el dictado. Revisá el importe antes de guardar.');
}
function form(kind='expense',targetId,prefill=null){
  if(!state)return;
  if(state.access==='viewer'){toast('Tu acceso es de solo lectura.');return;}
  pendingRequest=null;
  const target=state.operations.find(o=>o.id===targetId);
  const currency=prefill?.currency||target?.currency||unit;
  const currencies=`<option value="">Elegir moneda</option>${['UYU','USD','BRL'].map(c=>`<option value="${c}" ${c===currency?'selected':''}>${c}</option>`).join('')}`;
  let fields=select('Tipo de registro','kind',Object.entries(labels).filter(([k])=>k!=='commission').map(([k,v])=>`<option value="${k}" ${kind===k?'selected':''}>${v}</option>`).join(''),true);
  if(kind==='account'){
    fields+=field('Nombre de la cuenta','name','text','',true,'required maxlength="60" placeholder="Ej.: Santander o caja física" data-dictate');
    fields+=select('Medio','accountKind','<option value="bank">Banco</option><option value="wallet">Billetera digital</option><option value="cash">Efectivo</option>');
    fields+=select('Moneda','currency',currencies);
    fields+=field('Saldo inicial','opening','text','',false,'required inputmode="decimal" placeholder="0,00"');
    fields+=field('Fecha de corte','cutoff','date',today(),false,'required');
    fields+='<p class="form-note">El saldo inicial se interpreta al inicio del día indicado. No cargues nuevamente movimientos anteriores al corte. Una cuenta nueva no es un ingreso.</p><label class="check"><input name="verified" type="checkbox">Verifiqué este saldo inicial contra su fuente.</label><label class="check"><input name="accessible" type="checkbox">El dinero de esta cuenta está accesible.</label>';
  }else{
    fields+=field('Concepto','concept','text',prefill?.concept||(target?`${kind==='payment'?'Pago':'Cobro'} · ${target.concept}`:''),true,'required maxlength="180" placeholder="¿A qué corresponde?" data-dictate');
    fields+=field(kind==='collection'?'Cobro bruto':'Importe','amount','text',prefill?.amountText||(target?decimal(target.amount-target.applied):''),false,'required inputmode="decimal" placeholder="0,00"');
    fields+=select('Moneda','currency',currencies);
    fields+=field('Fecha de operación','date','date',prefill?.date||today(),false,'required');
    if(kind==='obligation')fields+=field('Vencimiento','due','date',prefill?.due||today(),false,'required');
    else fields+=field('Categoría (opcional)','category','text','',false,'maxlength="60" placeholder="Ej.: materiales" data-dictate');
    if(['expense','transfer','withdrawal','payment','collection'].includes(kind))fields+=select(kind==='collection'?'Cuenta de destino':'Cuenta de origen','accountId',accountOptions(currency),true);
    if(kind==='transfer')fields+=select('Cuenta de destino','toAccountId',accountOptions(currency),true);
    if(['payment','collection'].includes(kind))fields+=select(kind==='payment'?'Obligación asociada':'Venta asociada','targetId',`<option value="">Seleccionar registro pendiente</option>${state.operations.filter(o=>o.kind===(kind==='payment'?'obligation':'sale')&&o.amount>o.applied&&o.currency===currency).map(o=>`<option value="${o.id}" ${o.id===targetId?'selected':''}>${escape(o.concept)} · ${fmt(o.amount-o.applied,o.currency)}</option>`).join('')}`,true);
    if(kind==='collection')fields+=field('Comisión real de este cobro','commission','text','',true,'required inputmode="decimal" placeholder="0 solo si confirmaste que no hubo comisión"');
    fields+=`<p class="form-note">${{expense:'Registra un gasto ya pagado y la salida de dinero. Si todavía debés pagarlo, elegí Obligación. No se requiere factura: podés adjuntar una foto o un PDF, o dejarlo sin comprobante.',obligation:'Registra un gasto y una deuda pendiente. No mueve dinero hasta registrar el pago.',sale:'Registra la venta, no un ingreso de caja. El cobro se asocia en un paso separado.',payment:'Reduce la deuda pendiente y el saldo de la cuenta. No registra el gasto otra vez.',collection:'Asocia el cobro a la venta. A la cuenta entra el bruto menos la comisión real indicada.',transfer:'Mueve fondos entre dos cuentas propias de igual moneda. No crea ingreso ni gasto.',withdrawal:'Dinero retirado por el titular. No se clasifica como gasto operativo.'}[kind]}</p>`;
    if(['expense','obligation','sale','payment','collection'].includes(kind))
      fields+='<label class="field wide">Comprobante (opcional)<input type="file" name="evidence" accept="image/jpeg,image/png,image/webp,application/pdf"></label>';
  }
  const voicePanel=['expense','obligation','sale'].includes(kind)
    ? `<div class="voice-panel"><button type="button" class="voice-start" id="voice-start">${icon('mic')} Dictar la factura</button><p class="voice-hint">Ejemplo: «factura de proveedor de materiales por 4.200 pesos del 24 de octubre».</p><p class="voice-privacy">El navegador puede enviar el audio a su proveedor de reconocimiento. Si el dato es reservado, escribilo a mano.</p><div id="voice-result"></div></div>`
    : '';
  openDialog('Registrar operación','Los cambios se guardan únicamente en el servidor.',`<form id="operation-form"><div class="dialog-body">${voicePanel}<div class="form-grid">${fields}</div><p class="error" id="form-error" role="alert"></p></div><div class="dialog-footer"><button type="button" class="secondary" data-action="close">Cancelar</button><button type="submit" class="primary">Guardar registro ${icon('check')}</button></div></form>`);
  const f=$('#operation-form');
  attachDictation(f);
  if(voicePanel)wireVoice(f,kind);
  f.elements.kind.addEventListener('change',e=>form(e.target.value));
  f.elements.currency.addEventListener('change',e=>{
    for(const name of ['accountId','toAccountId'])if(f.elements[name])f.elements[name].innerHTML=accountOptions(e.target.value);
    if(f.elements.targetId)f.elements.targetId.innerHTML=`<option value="">Seleccionar registro pendiente</option>${state.operations.filter(o=>o.kind===(kind==='payment'?'obligation':'sale')&&o.currency===e.target.value&&o.amount>o.applied).map(o=>`<option value="${o.id}">${escape(o.concept)} · ${fmt(o.amount-o.applied,o.currency)}</option>`).join('')}`;
  });
  f.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;
    if(!pendingRequest){const input=Object.fromEntries(new FormData(f));delete input.evidence;if(kind==='account'){input.verified=f.elements.verified.checked;input.accessible=f.elements.accessible.checked;}pendingRequest={key:crypto.randomUUID(),input,file:f.elements.evidence?.files?.[0]||null};}
    busy=true;f.querySelectorAll('input,select,button').forEach(e=>e.disabled=true);$('#form-error').textContent='';
    try{
      const result=await api('/api/commands',pendingRequest.input,pendingRequest.key);
      const {key,file}=pendingRequest;pendingRequest=null;modal.close();modal.innerHTML='';
      // El registro ya está guardado: si el comprobante falla, se avisa y no se pierde la operación.
      if(file)try{await uploadEvidence(result.id,file,`${key}-ev`);}catch(error){toast(`El registro se guardó, pero el comprobante no se adjuntó: ${error.message}`);}
      try{await refresh();toast('Registro guardado correctamente.');}catch{lock('El registro se guardó, pero no se pudo actualizar la vista. Reconectá antes de registrar otra operación.');}
    }catch(error){
      if($('#form-error'))$('#form-error').textContent=error.message;
      if(!error.uncertain)pendingRequest=null;
      f.querySelectorAll('button').forEach(e=>e.disabled=false);
      if(!pendingRequest)f.querySelectorAll('input,select').forEach(e=>e.disabled=false);
      const submit=f.querySelector('[type=submit]');if(submit)submit.textContent=pendingRequest?'Reintentar mismo registro':'Guardar registro';
    }finally{busy=false;}
  });
}
function accountOptions(currency){return `<option value="">Seleccionar cuenta</option>${state.accounts.filter(a=>a.currency===currency).map(a=>`<option value="${a.id}">${escape(a.name)} · ${a.currency}</option>`).join('')}`;}
function detail(id){
  const o=state.operations.find(o=>o.id===id);if(!o)return;
  const entries=state.entries.filter(e=>e.operation===id);
  const related=state.operations.filter(x=>x.related_id===id || x.id===o.related_id);
  const pair=(label,value)=>`<div><dt>${label}</dt><dd>${escape(value)}</dd></div>`;
  const actions=[];
  if(state.access!=='viewer'&&!o.reversed_by&&['sale','obligation'].includes(o.kind)&&o.amount>o.applied)
    actions.push(`<button class="primary" data-pay="${o.id}" data-type="${o.kind==='sale'?'collection':'payment'}">Registrar ${o.kind==='sale'?'cobro':'pago'}</button>`);
  if(state.access!=='viewer'&&o.kind==='payment'&&!o.reversed_by)
    actions.push(`<button class="secondary" data-delete-payment="${o.id}">Eliminar pago</button>`);
  if(state.access!=='viewer'&&!o.reversed_by&&o.kind!=='reversal'&&o.kind!=='payment')
    actions.push(`<button class="secondary" data-revert="${o.id}">Eliminar registro</button>`);
  if(state.access!=='viewer'&&!o.reversed_by&&o.kind!=='reversal')
    actions.push(`<button class="secondary" data-attach="${o.id}">Adjuntar comprobante</button>`);
  openDialog(labels[o.kind],o.concept,`<div class="dialog-body"><dl class="details">${pair('Importe',fmt(o.amount,o.currency))}${pair('Fecha',o.date)}${pair('Origen',o.source)}${pair('Referencia externa',o.external_id||'Sin referencia externa')}${pair('Categoría',o.category||'Sin categoría')}${pair('Vencimiento',o.due||'No aplica')}${['sale','obligation'].includes(o.kind)?pair('Pendiente',fmt(o.amount-o.applied,o.currency)):''}<div class="wide"><dt>Identificador</dt><dd>${escape(o.id)}</dd></div></dl><p class="detail-note">Movimientos de cuenta</p>${entries.map(e=>`<div class="account-row"><span>${escape(state.accounts.find(a=>a.id===e.account)?.name)}</span><strong class="account-amount">${fmt(e.amount,o.currency)}</strong></div>`).join('')||'<p class="detail-note">Este registro no mueve dinero por sí mismo.</p>'}${related.length?`<p class="detail-note">Operaciones vinculadas</p>${related.map(r=>`<div class="account-row"><button class="concept-button" data-operation="${r.id}">${escape(r.concept)}<span class="concept-sub">${labels[r.kind]}</span></button><span class="account-amount">${fmt(r.amount,r.currency)}</span></div>`).join('')}`:''}<p class="detail-note">Comprobantes adjuntos</p>${evidenceSection(o.id,evidenceOf(o.id),state.access!=='viewer'&&!o.reversed_by)}</div>`,actions.length?`<div class="dialog-footer">${actions.join('')}</div>`:'');
  const picker=$('#evidence-file');
  if(picker)picker.onchange=()=>attachFile(o.id,picker);
}
// Las operaciones financieras no se borran: se anulan con contra-asiento y quedan consultables.
function revertDialog(id){
  const o=state.operations.find(x=>x.id===id);if(!o)return;
  let key=null;
  openDialog('Eliminar registro','Se anula con una reversión auditada; el historial se conserva.',`<div class="dialog-body"><p class="form-note">Se va a anular «${escape(o.concept)}» por ${fmt(o.amount,o.currency)}, con fecha de hoy. Para mantener el historial financiero, el registro original no desaparece: queda marcado como anulado y su saldo se compensa con un contra-asiento.</p><p class="detail-note">Si existe una operación vinculada, como un pago o cobro, primero hay que anular esa operación.</p><p class="error" id="revert-error" role="alert"></p></div>`,`<div class="dialog-footer"><button class="secondary" data-action="close">Cancelar</button><button class="primary" id="revert-confirm">Eliminar registro</button></div>`);
  const button=$('#revert-confirm');
  button.onclick=async()=>{
    if(busy)return;busy=true;button.disabled=true;$('#revert-error').textContent='';
    key=key||crypto.randomUUID();
    try{
      await api('/api/commands',{kind:'reversal',operationId:o.id,date:today()},key);
      modal.close();modal.innerHTML='';
      try{await refresh();toast('Registro anulado; el historial se conserva.');}
      catch{lock('La anulación se guardó, pero no se pudo actualizar la vista. Reconectá antes de registrar otra operación.');}
    }catch(error){
      if($('#revert-error'))$('#revert-error').textContent=error.message;
      if(!error.uncertain)key=null;
      button.disabled=false;
      button.textContent=key&&error.uncertain?'Reintentar anulación':'Eliminar registro';
    }finally{busy=false;}
  };
}
function commandDialog({title,subtitle,body,confirm,retryLabel,success,input,refreshMessage}){
  let key=null;
  openDialog(title,subtitle,`<div class="dialog-body">${body}<p class="error" id="command-error" role="alert"></p></div>`,`<div class="dialog-footer"><button class="secondary" data-action="close">Cancelar</button><button class="primary" id="command-confirm">${escape(confirm)}</button></div>`);
  const button=$('#command-confirm');
  button.onclick=async()=>{
    if(busy)return;busy=true;button.disabled=true;$('#command-error').textContent='';key=key||crypto.randomUUID();
    try{
      await api('/api/commands',input(),key);modal.close();modal.innerHTML='';
      try{await refresh();toast(success);}catch{lock(refreshMessage);}
    }catch(error){
      if($('#command-error'))$('#command-error').textContent=error.message;
      if(!error.uncertain)key=null;
      button.disabled=false;button.textContent=key&&error.uncertain?retryLabel:confirm;
    }finally{busy=false;}
  };
}
function accountDeleteDialog(id){
  const account=state.accounts.find(a=>a.id===id);if(!account||state.access==='viewer')return;
  const movements=state.entries.filter(e=>e.account===id).length;
  if(movements){
    openDialog('No se puede eliminar la cuenta','Tiene movimientos en el historial.',`<div class="dialog-body"><p class="form-note">«${escape(account.name)}» tiene ${movements} movimiento${movements===1?'':'s'}. No se elimina para proteger los saldos y el historial. Abrí cada operación y usá <strong>Eliminar registro</strong> para anularla primero; después volvé aquí a quitar la cuenta.</p></div>`,`<div class="dialog-footer"><button class="primary" data-action="close">Entendido</button></div>`);
    return;
  }
  commandDialog({title:'Eliminar cuenta',subtitle:'Solo se pueden eliminar cuentas sin movimientos.',body:`<p class="form-note">Se eliminará la cuenta «${escape(account.name)}» y su saldo inicial de ${fmt(account.opening,account.currency)}. Esta acción no se puede deshacer.</p>`,confirm:'Eliminar cuenta',retryLabel:'Reintentar eliminación',success:'Cuenta eliminada.',refreshMessage:'La cuenta se eliminó, pero no se pudo actualizar la vista. Reconectá antes de seguir.',input:()=>({kind:'account.delete',accountId:account.id})});
}
function removeEvidenceDialog(id){
  const entry=(state.evidence||[]).find(e=>e.id===id);if(!entry||state.access==='viewer')return;
  commandDialog({title:'Quitar comprobante',subtitle:'La operación y sus importes no cambian.',body:`<p class="form-note">Se eliminará el archivo «${escape(entry.name)}» adjunto a esta operación. El movimiento financiero permanece intacto; el comprobante ya no se podrá recuperar.</p>`,confirm:'Quitar comprobante',retryLabel:'Reintentar eliminación',success:'Comprobante eliminado.',refreshMessage:'El comprobante se eliminó, pero no se pudo actualizar la vista. Reconectá antes de seguir.',input:()=>({kind:'evidence.remove',evidenceId:entry.id})});
}
function deletePaymentDialog(id){
  const payment=state.operations.find(o=>o.id===id&&o.kind==='payment');if(!payment||state.access==='viewer')return;
  const obligation=state.operations.find(o=>o.id===payment.related_id);
  commandDialog({title:'Eliminar pago',subtitle:'Quita este registro del historial y restaura el saldo pendiente.',body:`<p class="form-note">Se eliminará el pago «${escape(payment.concept)}» por ${fmt(payment.amount,payment.currency)}${obligation?` aplicado a «${escape(obligation.concept)}»`:''}. La deuda vuelve a quedar pendiente por ese importe y el saldo de la cuenta se recalcula sin este pago. La acción queda registrada en auditoría.</p><p class="detail-note">Esto solo se habilita para pagos. Los gastos y demás operaciones se anulan con <strong>Eliminar registro</strong>, que preserva el historial con un contra-asiento.</p>`,confirm:'Eliminar pago',retryLabel:'Reintentar eliminación',success:'Pago eliminado; la deuda volvió a pendiente.',refreshMessage:'El pago se eliminó, pero no se pudo actualizar la vista. Reconectá antes de seguir.',input:()=>({kind:'payment.delete',paymentId:payment.id})});
}
function download(contents,filename,type){const url=URL.createObjectURL(new Blob([contents],{type}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function importDialog(){
  if(state?.access==='viewer'){toast('Tu acceso es de solo lectura.');return;}
  let csv='',requestKey=crypto.randomUUID(),confirmed=false;
  openDialog('Importar operaciones','Plantilla CSV · máximo 200 filas / 100 KB',`<div class="dialog-body"><p class="form-note">Importa gastos pagados, obligaciones, ventas y retiros. Origen y referencia externa obligatorios. Cada lote es atómico: si una fila falla, no se guarda ninguna. La plantilla es propuesta y debe validarse con las hojas de Rafa.</p><button class="text-btn" id="template">${icon('download')} Descargar plantilla de ejemplo</button><label class="field">Archivo CSV UTF-8<input type="file" id="csv-file" accept=".csv,text/csv"></label><p class="error" id="import-error" role="alert"></p><div id="import-preview"></div></div>`,`<div class="dialog-footer"><button class="secondary" data-action="close">Cancelar</button><button class="primary" id="import-submit" disabled>Confirmar importación</button></div>`);
  $('#template').onclick=()=>download('\uFEFFkind,date,concept,amount,currency,account_id,due,source,external_id,category\r\nsale,2026-10-24,EJEMPLO SINTÉTICO - reemplazar,100.00,UYU,,,hoja-ejemplo,EJEMPLO-001,Ventas\r\n','landur-plantilla.csv','text/csv;charset=utf-8');
  $('#csv-file').onchange=async e=>{
    if(busy)return;csv='';confirmed=false;$('#import-submit').disabled=true;$('#import-preview').innerHTML='';$('#import-error').textContent='';
    const file=e.target.files[0];if(!file)return;
    if(file.size>100000){$('#import-error').textContent='El archivo supera 100 KB.';return;}
    busy=true;e.target.disabled=true;
    try{csv=await file.text();const result=await api('/api/import/preview',{csv});requestKey=crypto.randomUUID();confirmed=true;
      $('#import-preview').innerHTML=`<p class="form-note">${result.created} registros nuevos · ${result.existing} ya existentes. Todavía no se guardó nada.</p><div class="import-list">${result.rows.map(r=>`<div class="import-row"><span>Fila ${r.row}: ${escape(r.concept)}</span>${pill(r.status==='new'?'Nuevo':'Ya existe',r.status==='new'?'green':'gray')}</div>`).join('')}</div>`;
      $('#import-submit').disabled=false;
    }catch(error){if($('#import-error'))$('#import-error').textContent=error.message;}
    finally{busy=false;e.target.disabled=false;}
  };
  $('#import-submit').onclick=async()=>{
    if(busy||!confirmed)return;busy=true;$('#import-submit').disabled=true;$('#csv-file').disabled=true;
    try{const result=await api('/api/import/commit',{csv},requestKey);modal.close();modal.innerHTML='';await refresh();toast(`Importación guardada: ${result.created} nuevos, ${result.existing} existentes.`);}
    catch(error){if($('#import-error'))$('#import-error').textContent=error.message;if($('#import-submit'))$('#import-submit').disabled=false;if($('#csv-file')&&!error.uncertain)$('#csv-file').disabled=false;}
    finally{busy=false;}
  };
}
async function logout(){
  if(busy)return;const demo=session?.demo;
  try{await api('/api/logout',{});if(portalMode){location.assign('/login');return;}session={authenticated:false,demo};view='home';query='';filter='';unit='';lock('Sesión cerrada.');}
  catch{lock('No se pudo confirmar el cierre en el servidor. Reconectá y cerrá sesión antes de dejar este dispositivo.');}
}
function install(){openDialog('LANDUR en tu iPhone','Instalación desde Safari, con conexión HTTPS.',`<div class="dialog-body"><ol class="install-steps"><li>Abrí el enlace de LANDUR directamente en <strong>Safari</strong>, no dentro de otra aplicación.</li><li>Tocá <strong>Compartir</strong> y luego <strong>Agregar a pantalla de inicio</strong>.</li><li>Confirmá el nombre LANDUR y tocá <strong>Agregar</strong>.</li><li>Abrí el icono e ingresá a tu espacio.</li></ol><p class="form-note">Necesitás conexión para ver o registrar operaciones. Sin conexión se muestra una pantalla bloqueada: nunca se simula un guardado. La instalación debe verificarse en el iPhone real.</p></div>`);}
function closeDialog(){if(busy)return;if(pendingRequest&&!confirm('La respuesta anterior no se pudo confirmar. Antes de volver a registrar, revisá los movimientos para evitar duplicados. ¿Cerrar este formulario?'))return;pendingRequest=null;modal.close();modal.innerHTML='';}
modal.addEventListener('cancel',e=>{e.preventDefault();closeDialog();});
document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.view){view=b.dataset.view;query='';filter='';modal.close();render();window.scrollTo(0,0);return;}
  if(b.dataset.form){form(b.dataset.form);return;}
  if(b.dataset.pay){form(b.dataset.type,b.dataset.pay);return;}
  if(b.dataset.revert){revertDialog(b.dataset.revert);return;}
  if(b.dataset.attach){$('#evidence-file')?.click();return;}
  if(b.dataset.operation){detail(b.dataset.operation);return;}
  if(b.dataset.account){const a=state.accounts.find(a=>a.id===b.dataset.account);if(!a)return;const ids=new Set(state.entries.filter(e=>e.account===a.id).map(e=>e.operation));openDialog(a.name,`Saldo registrado: ${fmt(a.balance,a.currency)}`,`<div class="dialog-body">${table(state.operations.filter(o=>ids.has(o.id)))}</div>`);return;}
  if(b.dataset.deleteAccount){accountDeleteDialog(b.dataset.deleteAccount);return;}
  if(b.dataset.removeEvidence){removeEvidenceDialog(b.dataset.removeEvidence);return;}
  if(b.dataset.deletePayment){deletePaymentDialog(b.dataset.deletePayment);return;}
  switch(b.dataset.action){
    case 'register':form();break;
    case 'close':closeDialog();break;
    case 'install':install();break;
    case 'logout':await logout();break;
    case 'refresh':try{await refresh();toast('Datos actualizados.');}catch(error){toast(error.message);}break;
    case 'policy':openDialog('Disponible: pendiente de validación','Saldo, compromisos y reservas no son lo mismo.',`<div class="dialog-body"><p class="form-note">Falta acordar qué obligaciones y reservas se descuentan, con qué horizonte y cómo evitar solapamientos. Por eso el disponible todavía no se calcula.</p><p class="detail-note">${state?escape(`En ${unit || 'la moneda seleccionada'} se muestran saldos reconstruidos y deudas pendientes por separado. No se asume que todo el saldo esté libre ni que los cobros futuros estén disponibles.`):''}</p></div>`);break;

    case 'import':importDialog();break;
    case 'export':{
      try{const r=await fetch(endpoint('/api/export.csv'),{cache:'no-store',credentials:'same-origin',headers:demoHeaders()});if(!r.ok){if(r.status===401)lock('La sesión venció.');throw new Error('No se pudo exportar.');}download(await r.text(),'landur-operaciones.csv','text/csv;charset=utf-8');toast('CSV de todas las monedas exportado. Guardalo en un lugar privado.');}catch(error){toast(error.message);}break;
    }
    case 'update':if(busy||modal.open){toast('Terminá o cerrá el formulario antes de actualizar.');return;}updateWorker?.postMessage('ACTIVATE_UPDATE');break;
  }
});
async function boot(autoDemo=true){
  try{session=await api('/api/session');if(session.authenticated)await refresh();else if(session.demo&&autoDemo){await api('/api/demo',{});await refresh();}else lock();}
  catch(error){lock(error.message);}
}
window.addEventListener('offline',()=>{if(!busy)lock('Sin conexión. No se puede consultar ni guardar. Volvé a conectarte.');else toast('Se perdió la conexión. No cierres el formulario hasta verificar el resultado.');});
window.addEventListener('online',()=>{if(!busy&&!modal.open)boot(false);});
window.addEventListener('beforeunload',e=>{if(busy||pendingRequest){e.preventDefault();e.returnValue='';}});
window.addEventListener('pagehide',()=>{authEpoch++;state=null;app.innerHTML='';modal.close();modal.innerHTML='';});
window.addEventListener('pageshow',e=>{if(e.persisted)boot(false);});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&state&&!busy&&!modal.open)refresh().catch(()=>lock('No se pudo verificar la sesión. Volvé a ingresar.'));});
if('serviceWorker' in navigator){
  navigator.serviceWorker.register(endpoint('/sw.js'),{scope:BASE}).then(reg=>{
    const update=()=>{if(reg.waiting&&navigator.serviceWorker.controller){updateWorker=reg.waiting;if(state)render();}};
    update();reg.addEventListener('updatefound',()=>reg.installing?.addEventListener('statechange',update));
  }).catch(()=>{/* Installation status is not a financial save; app can operate online without SW. */});
  let controlled=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(controlled)location.reload();controlled=true;});
}
boot();
