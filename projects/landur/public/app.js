import { parseSpokenInvoice, fold } from './voice.mjs';

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
let state = null, session = null, view = 'home', unit = '', query = '', filter = '', loadedAt = null, busy = false, actOther = false, searchOpen = false, pendingRequest = null, updateWorker = null, timer, authEpoch = 0;
const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Montevideo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const fmt = (cents, currency = unit) => new Intl.NumberFormat('es-UY',{style:'currency',currency:currency || 'UYU',minimumFractionDigits:2}).format(cents/100);
const dateFmt = date => date ? new Intl.DateTimeFormat('es-UY',{day:'2-digit',month:'short',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z')) : 'Sin fecha';
const decimal = cents => { const sign=cents<0?'-':'', abs=Math.abs(cents); return `${sign}${Math.trunc(abs/100)}.${String(abs%100).padStart(2,'0')}`; };
const pill = (text, cls='gray') => `<span class="pill ${cls}">${escape(text)}</span>`;
function toast(message) { clearTimeout(timer); $('#toast').textContent=message;$('#toast').hidden=false;timer=setTimeout(()=>$('#toast').hidden=true,6000); }
async function api(path, input, key) {
  if (!navigator.onLine) throw new Error('Sin conexión. No se guardó ningún cambio.');
  let response;
  try { response = await fetch(endpoint(path), {method:input === undefined ? 'GET':'POST',cache:'no-store',credentials:'same-origin',
    headers:input === undefined ? {} : {'Content-Type':'application/json','X-Landur-Request':'1',...(session?.csrf?{'X-CSRF-Token':session.csrf}:{}),...(key?{'Idempotency-Key':key}:{})},
    ...(input === undefined ? {} : {body:JSON.stringify(input)}),signal:AbortSignal.timeout(20000)}); }
  catch { const error=new Error(input===undefined?'No pudimos conectar con el servidor.':'No se pudo confirmar la respuesta. Reintentá con este mismo formulario para no duplicar la operación.');error.uncertain=input!==undefined;throw error; }
  let data;
  try { data=await response.json(); }
  catch { const error=new Error(input===undefined?'El servidor devolvió una respuesta incompleta.':'La respuesta quedó incompleta. Reintentá este mismo registro para verificar el resultado sin duplicarlo.');error.uncertain=input!==undefined;throw error; }
  if (!response.ok) { const error=new Error(data.error || 'No se pudo completar la operación.');error.status=response.status;error.uncertain=input!==undefined&&response.status>=500;if(response.status===401 && path!=='/api/login'){lock('Tu sesión venció. Volvé a ingresar.');}throw error; }
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
  app.innerHTML=`<div class="login"><section class="login-brand"><img class="brand-logo login-wordmark" src="${BASE}wordmark.png" alt="LANDUR®" width="300" height="84"><div><span class="eyebrow">Tu espacio financiero</span><h1>Control financiero<br>del negocio.</h1><p>Saldos, cobros y compromisos en un solo registro. Cada cifra conserva su origen y su fecha.</p></div><footer>UNA SOLUCIÓN DE RIVECT</footer></section><main class="login-main" id="main"><div class="login-box"><span class="eyebrow muted">ACCESO PRIVADO</span><h2>Bienvenido a LANDUR</h2><p>Ingresá con la contraseña configurada para esta aplicación.</p><form id="login-form"><label class="field">Contraseña<input type="password" name="password" autocomplete="current-password" required maxlength="256"></label><p class="error" id="login-error" role="alert">${escape(message)}</p><button class="primary" type="submit">Ingresar al espacio ${icon('arrow')}</button></form><p class="footnote">${navigator.onLine?'Conexión necesaria para consultar y guardar.':'Sin conexión. Volvé a conectarte para continuar.'} No se guarda una copia financiera offline en el navegador.</p><button class="text-btn" data-action="install">${icon('phone')} Instalar en el iPhone</button></div></main></div>`;
  if(portalMode){
    // El ingreso lo sirve el propio LANDUR: la aplicación no dibuja un formulario que no
    // puede autenticar ni muestra un camino de vuelta al ecosistema RIVECT.
    location.assign(BASE+'login');
    return;
  }
  $('#login-form').addEventListener('submit',async event=>{
    event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;
    try { await api('/api/login',{password:new FormData(event.currentTarget).get('password')}); await refresh(); }
    catch(error){if($('#login-error'))$('#login-error').textContent=error.message;button.disabled=false;}
  });
}
const selectedOps = () => state.operations.filter(o=>!unit || o.currency===unit);
// Una operación revertida conserva su contra-asiento en el saldo, pero deja de ser un pendiente.
const outstanding = kind => selectedOps().filter(o=>o.kind===kind && o.amount>o.applied && !o.reversed_by);
function navButton(key){return `<button class="nav-button ${view===key?'active':''}" data-view="${key}" ${view===key?'aria-current="page"':''}>${icon(viewIcons[key])}<span>${viewLabels[key]}</span>${key==='pending'?`<span class="nav-count">${outstanding('obligation').length+outstanding('sale').length+2}</span>`:''}</button>`;}
function render() {
  if(!state)return;
  const lite=['home','moves','expenses','sales','pending','accounts','settings'].includes(view);
  const heading = {home:['INICIO','Saldos y compromisos','Saldos reconstruidos desde el corte de cada cuenta y sus movimientos. No consulta tu banco.'],moves:['MOVIMIENTOS','Actividad','Tipo, origen, fecha y estado de cada registro. Ventas y cobros se guardan por separado.'],accounts:['CUENTAS','Cuentas','Un saldo por cuenta y moneda con su fecha de corte. Sin conversión automática.'],expenses:['EGRESOS','Actividad','Lo pagado descuenta caja. Lo pendiente queda como obligación hasta que registres el pago.'],sales:['VENTAS','Actividad','Una venta no es dinero disponible. Cada cobro se asocia a su venta con la comisión real.'],pending:['PENDIENTES','Pendientes','Obligaciones vencidas o próximas, cobros sin registrar y reglas sin validar.'],settings:['CONFIGURACIÓN','Configuración','Exportación, instalación y límites conocidos de esta versión.']}[view];
  app.innerHTML=`<aside class="sidebar"><div class="brand"><img class="brand-wordmark" src="${BASE}wordmark.png" alt="LANDUR®" width="132" height="37"><small>CONTROL FINANCIERO</small></div><div class="workspace"><div class="workspace-mark">L</div><div><strong>Mi negocio</strong><small>Espacio privado</small></div></div><div class="nav-label">PRINCIPAL</div><nav aria-label="Navegación principal">${Object.keys(viewLabels).filter(k=>k!=='settings').map(navButton).join('')}</nav><div class="sidebar-bottom">${navButton('settings')}<button class="nav-button" data-action="install">${icon('phone')} Instalar aplicación</button><div class="sidebar-note">Datos en el servidor.<br>Sin conexión bancaria activa.</div><div class="rivect">POR <b>✳ RIVECT</b></div></div></aside><div class="shell"><header class="topbar"><div class="breadcrumb">Mi negocio <span>/</span> <strong>${viewLabels[view]}</strong></div><img class="brand-logo mobile-logo" src="${BASE}icon-512.png" alt="LANDUR®" loading="lazy" width="40" height="40"><div class="top-actions"><span class="top-date">${new Intl.DateTimeFormat('es-UY',{day:'numeric',month:'long',year:'numeric'}).format(new Date())}</span><button class="icon-btn" data-action="refresh" aria-label="Actualizar datos">${icon('refresh')}</button><button class="icon-btn" data-action="logout" aria-label="Cerrar sesión">${icon('logout')}</button><div class="avatar" title="${escape(state.actor)}">${escape((state.actor||'').trim().split(/\s+/).slice(0,2).map(s=>s[0]||'').join('').toUpperCase())}</div></div></header>${updateWorker?'<div class="update-bar">Hay una actualización de la aplicación.<button class="mini-button" data-action="update">Actualizar</button></div>':''}<main class="page page-${view}" id="main"><section class="heading"><div><div class="eyebrow">${heading[0]}</div><h1>${heading[1]}</h1><p>${heading[2]}</p></div><button class="primary" data-action="register">${icon('plus')} Registrar operación</button></section><div class="toolbar${lite?' tb-home':''}" ${lite&&state.totals.length<2?'hidden':''}><div class="period">${icon('calendar')} ${view==='home'?'Resumen acumulado · sin filtro de período':'Registros acumulados'}</div><label class="flex muted"><span class="eyebrow">Moneda</span><select id="currency" class="currency-select" aria-label="Moneda del resumen">${state.totals.length?state.totals.map(t=>`<option ${t.currency===unit?'selected':''}>${t.currency}</option>`).join(''):'<option value="">Sin cuentas</option>'}</select></label></div><div id="view-content">${content()}</div><footer class="page-footer"><span class="flex">${icon('lock')} Información guardada en el servidor · Sin conexiones bancarias activas</span><span>Última lectura ${loadedAt?.toLocaleTimeString('es-UY',{hour:'2-digit',minute:'2-digit'})} · LANDUR × RIVECT</span></footer></main></div><nav class="mobile-nav" aria-label="Navegación móvil"><button data-view="home" class="${view==='home'?'active':''}">${icon('home')}Inicio</button><button data-view="moves" class="${['moves','expenses','sales'].includes(view)?'active':''}">${icon('moves')}Actividad</button><button data-action="voice" class="register" aria-label="Registrar por voz">${icon('mic')}Registrar</button><button data-view="pending" class="${view==='pending'?'active':''}">${icon('pending')}Pendientes</button><button data-action="menu">${icon('more')}Más</button></nav>`;
  if(portalMode&&state.access==='viewer'){
    document.querySelectorAll('button[data-action="register"],button[data-action="import"],button[data-form],button[data-pay]').forEach(b=>{b.disabled=true;b.title='Acceso de solo lectura';});
    const note=document.createElement('span');note.className='portal-access';note.textContent='Solo lectura';
    $('.top-actions')?.append(note);
  }
  $('#currency').addEventListener('change',e=>{unit=e.target.value;render();});
  $('#search')?.addEventListener('input',e=>{query=e.target.value;$('#operation-table').innerHTML=actList(filteredOps());});
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
    if(payBtn){const id=payBtn.getAttribute('data-pay');const type=payBtn.getAttribute('data-type')||'payment';quickCapture(type,id);return;}
    const attachBtn=event.target.closest('[data-attach]');
    if(attachBtn){const id=attachBtn.getAttribute('data-attach');attachFile(id,{files:[document.querySelector('[data-action="attach-file"]')?.files?.[0]]||null});return;}
    const closeBtn=event.target.closest('[data-action="close"]'); if(closeBtn){modal.close();return;}
    const exportBtn=event.target.closest('[data-action="export"]'); if(exportBtn){window.location.href=endpoint('/api/export.csv');return;}
    const registerBtn=event.target.closest('[data-action="register"],[data-action="voice"]'); if(registerBtn){quickCapture('expense','',{listen:registerBtn.dataset.action==='voice'});return;}
    const policyBtn=event.target.closest('[data-action="policy"]'); if(policyBtn){openDialog('Disponible estimado','Reglas pendientes','<div class="rule-list"><div class="rule-item"><strong>Regla aún no activada</strong><p>El cálculo de disponible descontando obligaciones, retiros y reservas todavía no tiene regla definida. Hasta tanto, el valor muestra «Por validar».</div></div>');return;}
    const updateBtn=event.target.closest('[data-action="update"]'); if(updateBtn){return;}
    const menuBtn=event.target.closest('[data-action="menu"]'); if(menuBtn)openMenu('Tu espacio','Elegí una sección.',`<div class="dialog-body settings-stack">${['accounts','expenses','sales','settings'].map(k=>`<button class="secondary" data-view="${k}">${icon(viewIcons[k])} ${viewLabels[k]}</button>`).join('')}</div>`);
    const launchBtn=event.target.closest('[data-action="experiments"]'); if(launchBtn){const base=`${location.origin}${location.pathname}`;const side=`${base}side-by-side/qa.html`;window.open(side,'_blank');return;}
  });
  app.addEventListener('click',event=>{const viewBtn=event.target.closest('[data-view]');if(viewBtn){view=viewBtn.getAttribute('data-view');actOther=false;render();};});
  app.addEventListener('click',event=>{const formBtn=event.target.closest('[data-form]');if(formBtn){quickCapture(formBtn.getAttribute('data-form')==='account'?'account':'expense');};});
  app.addEventListener('click',event=>{const installBtn=event.target.closest('[data-action="install"]');if(installBtn)install();});
}
function content(){
  if(view==='home')return home();
  if(view==='accounts')return accounts();
  if(view==='pending')return pending();
  if(view==='settings')return settings();
  return activity();
}
// Inicio: una sola pantalla de vistazo. Saldo → compromisos → aviso del disponible → qué requiere atención →
// cuentas → movimientos recientes. Todas las cifras salen de los mismos cálculos de siempre; el texto técnico
// vive detrás del botón «i» y no se calcula nada nuevo.
function home(){
  const t=state.totals.find(t=>t.currency===unit);
  if(!t)return `<section class="card"><div class="empty">${icon('accounts')}<h2>Todavía no hay cuentas</h2><p>Registrá una cuenta con su saldo inicial y su fecha de corte.<br>No hace falta conectar un banco.</p><button class="primary" data-form="account">${icon('plus')} Agregar mi primera cuenta</button></div></section>`;
  const accounts=state.accounts.filter(a=>a.currency===unit);
  const payables=outstanding('obligation'),receivables=outstanding('sale');
  const overdue=payables.filter(o=>o.due<today()).length;
  const duplicates=doubtfulDuplicates().length;
  const unverified=accounts.filter(a=>!a.verified).length;
  const plural=(n,one,many)=>`${n} ${n===1?one:many}`;
  const attention=[
    overdue?['red',plural(overdue,'obligación vencida','obligaciones vencidas'),'Sin pago registrado']:null,
    duplicates?['amber',plural(duplicates,'posible duplicado','posibles duplicados'),'Para revisar a mano']:null,
    unverified?['amber',plural(unverified,'cuenta sin verificar','cuentas sin verificar'),'El saldo inicial no se confirmó']:null
  ].filter(Boolean);
  const accountRow=a=>`<div class="hm-row"><div class="hm-ico ${a.kind}">${icon(a.kind==='bank'?'accounts':a.kind==='cash'?'cash':'wallet')}</div><div class="hm-main"><b>${escape(a.name)}</b>${a.verified?'':'<small class="warn">Sin verificar</small>'}</div><div class="hm-amt">${fmt(a.balance,a.currency)}</div></div>`;
  const opRow=o=>`<button class="hm-row hm-op" data-operation="${o.id}"><div class="hm-main"><b>${escape(o.concept)}</b><small>${labels[o.kind]} · ${dateFmt(o.date)}</small></div><div class="hm-amt${o.reversed_by?' reversed':''}">${fmt(o.amount,o.currency)}<small>${opStatusText(o)}</small></div></button>`;
  return `<div class="hm">
    <section class="hm-hero" aria-label="Saldo registrado"><div class="hm-label">Saldo registrado<button type="button" class="hm-info" data-action="balanceinfo" aria-label="Cómo se calcula este saldo">${icon('info')}</button></div><div class="hm-balance">${moneyHtml(t.balance,unit)}</div><div class="hm-sub">${plural(accounts.length,'cuenta','cuentas')} · ${unit}</div></section>
    <section class="hm-pair" aria-label="Compromisos"><button type="button" class="hm-tile" data-view="pending"><span>Por pagar</span><b>${fmt(t.payable)}</b><small>${payables.length?plural(payables.length,'compromiso','compromisos'):'Sin compromisos'}</small></button><button type="button" class="hm-tile" data-view="pending"><span>Por cobrar</span><b>${fmt(t.receivable)}</b><small>${receivables.length?plural(receivables.length,'venta','ventas'):'Sin ventas pendientes'}</small></button></section>
    <button type="button" class="hm-notice" data-action="policy"><span>Disponible estimado <b>por validar</b></span><i>Ver reglas ›</i></button>
    <section class="hm-sec"><div class="hm-head"><h2>Requiere atención</h2>${attention.length?`<span class="hm-count">${attention.length}</span>`:''}</div>${attention.length?attention.map(([tone,main,sub])=>`<button type="button" class="hm-row hm-att" data-view="pending"><i class="dot ${tone}" aria-hidden="true"></i><div class="hm-main"><b>${main}</b><small>${sub}</small></div><span class="hm-go" aria-hidden="true">›</span></button>`).join(''):'<p class="hm-quiet">Nada urgente por revisar.</p>'}</section>
    <section class="hm-sec"><div class="hm-head"><h2>Cuentas</h2><button type="button" class="hm-link" data-view="accounts">Ver todas</button></div>${accounts.map(accountRow).join('')}</section>
    <section class="hm-sec"><div class="hm-head"><h2>Movimientos recientes</h2><button type="button" class="hm-link" data-view="moves">Ver todos</button></div>${selectedOps().slice(0,5).map(opRow).join('')||'<p class="hm-quiet">Todavía no hay operaciones.</p>'}</section>
  </div>`;
}
const opStatusText=o=>o.reversed_by?'Revertido':o.kind==='reversal'?'Reversión':['sale','obligation'].includes(o.kind)?(o.applied===o.amount?(o.kind==='sale'?'Cobrado':'Pagado'):o.applied?'Parcial':'Pendiente'):'';
function accountRow(a){return `<div class="account-row"><div class="account-logo ${a.kind}">${icon(a.kind==='bank'?'accounts':a.kind==='cash'?'cash':'wallet')}</div><div><div class="account-name">${escape(a.name)}</div><div class="account-sub">${a.verified?'Apertura verificada':'Apertura sin verificar'} · ${dateFmt(a.cutoff)}</div></div><div class="account-amount">${fmt(a.balance,a.currency)}<div class="account-sub">${a.accessible?'Fondos accesibles':'Acceso restringido'}</div></div></div>`;}
// Cuentas: total arriba y una fila por cuenta. El detalle, sus datos técnicos y «Eliminar» viven en una hoja.
const ACCOUNT_KIND_NAME={bank:'Cuenta bancaria',cash:'Efectivo',wallet:'Billetera digital'};
function accounts(){
  const list=state.accounts.filter(a=>!unit||a.currency===unit);
  const t=state.totals.find(t=>t.currency===unit);
  const row=a=>`<button type="button" class="hm-row" data-action="accsheet" data-v="${a.id}"><div class="hm-ico ${a.kind}">${icon(a.kind==='bank'?'accounts':a.kind==='cash'?'cash':'wallet')}</div><div class="hm-main"><b>${escape(a.name)}</b><small${a.verified?'':' class="warn"'}>${a.verified?(ACCOUNT_KIND_NAME[a.kind]||'Cuenta')+' · '+a.currency:'Sin verificar'}</small></div><div class="hm-amt">${fmt(a.balance,a.currency)}<small>${a.accessible?'Accesible':'Restringido'}</small></div></button>`;
  return `<div class="hm acc">${t?`<section class="hm-hero" aria-label="Total registrado"><div class="hm-label">Total registrado</div><div class="hm-balance">${moneyHtml(t.balance,unit)}</div><div class="hm-sub">${list.length===1?'1 cuenta':list.length+' cuentas'} · ${unit}</div></section>`:''}<section class="hm-sec"><div class="hm-head"><h2>Cuentas</h2><button type="button" class="hm-link" data-form="account">+ Agregar</button></div>${list.map(row).join('')||'<p class="hm-quiet">Todavía no hay cuentas en esta moneda.</p>'}<p class="act-note">Monedas separadas, sin conversiones automáticas. Cada saldo se reconstruye desde su fecha de corte.</p></section></div>`;
}
// Actividad: una lista agrupada por día. Egresos y Ventas son filtros de esta misma pantalla.
const SEGMENTS=[['all','Todo'],['expenses','Gastos'],['sales','Ventas'],['other','Otros']];
const segNow=()=>view==='expenses'?'expenses':view==='sales'?'sales':actOther?'other':'all';
const opSign=o=>o.reversed_by||o.kind==='reversal'?'':o.kind==='collection'?'+':['expense','payment','withdrawal'].includes(o.kind)?'−':'';
const opTone=o=>o.kind==='collection'?'in':o.kind==='sale'?'sale':o.kind==='obligation'?'due':['transfer','reversal'].includes(o.kind)?'flat':'out';
function opGlyph(o){return o.category?categoryEmoji(o.category):icon(o.kind==='collection'?'down':o.kind==='transfer'?'moves':o.kind==='sale'?'sales':o.kind==='obligation'?'pending':'up');}
function opAccounts(o){
  const names=(state.entries||[]).filter(e=>e.operation===o.id).map(e=>state.accounts.find(a=>a.id===e.account)?.name).filter(Boolean);
  return [...new Set(names)].slice(0,2).join(' → ');
}
function activity(){
  const seg=segNow();
  return `<div class="act"><div class="act-bar"><div class="seg" role="group" aria-label="Tipo de operación">${SEGMENTS.map(([k,n])=>`<button type="button" class="${seg===k?'on':''}" data-action="seg" data-v="${k}" aria-pressed="${seg===k}">${n}</button>`).join('')}</div><button type="button" class="icon-btn" data-action="actsearch" aria-label="Buscar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14m9 2-4.3-4.3"/></svg></button><button type="button" class="icon-btn" data-action="actmenu" aria-label="Importar o exportar">${icon('more')}</button></div>${searchOpen||query?`<input class="search act-search" id="search" placeholder="Buscar concepto o referencia…" aria-label="Buscar operaciones" value="${escape(query)}">`:''}${view==='sales'?'<p class="act-note">Se muestran ventas y cobros por separado. Los costos y repartos automáticos todavía no están habilitados.</p>':''}<div id="operation-table">${actList(filteredOps())}</div></div>`;
}
function actList(ops){
  if(!ops.length)return '<p class="hm-quiet">No hay operaciones para mostrar.</p>';
  const groups=[];
  for(const o of [...ops].sort((a,b)=>b.date.localeCompare(a.date))){const g=groups[groups.length-1];if(g&&g.date===o.date)g.ops.push(o);else groups.push({date:o.date,ops:[o]});}
  const ago=n=>new Date(new Date(today()+'T12:00:00Z').getTime()-n*864e5).toISOString().slice(0,10);
  const day=d=>d===today()?'Hoy':d===ago(1)?'Ayer':dateFmt(d);
  return groups.map(g=>`<section class="act-group"><h3 class="act-day">${day(g.date)}</h3>${g.ops.map(o=>{
    const st=opStatusText(o),show=['Pendiente','Parcial','Revertido','Reversión'].includes(st)?st:'';
    const sub=[labels[o.kind],o.category,opAccounts(o)].filter(Boolean).map(escape).join(' · ');
    return `<button type="button" class="hm-row act-op" data-operation="${o.id}"><div class="act-ico ${opTone(o)}">${opGlyph(o)}</div><div class="hm-main"><b>${escape(o.concept)}</b><small>${sub}</small></div><div class="hm-amt${o.reversed_by?' reversed':opTone(o)==='in'?' in':''}">${opSign(o)}${fmt(o.amount,o.currency)}${show?`<small>${show}</small>`:''}</div></button>`;
  }).join('')}</section>`).join('');
}
function filteredOps(){return selectedOps().filter(o=>(view!=='expenses'||['expense','obligation','payment','commission'].includes(o.kind))&&(view!=='sales'||['sale','collection'].includes(o.kind))&&(!actOther||['transfer','withdrawal','reversal'].includes(o.kind))&&(!filter||o.kind===filter)&&(!query||[o.concept,o.source,o.external_id].join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase())));}
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
// Pendientes: una sola lista agrupada. Vencidas → próximas → por cobrar → para revisar. Los grupos vacíos no se muestran.
// Las reglas abiertas y los duplicados se leen en una hoja; nada se calcula ni se fusiona aquí.
function pending(){
  const t=state.totals.find(t=>t.currency===unit);
  const payables=outstanding('obligation').sort((a,b)=>a.due.localeCompare(b.due));
  const late=payables.filter(o=>o.due<today()),soon=payables.filter(o=>o.due>=today());
  const receivables=outstanding('sale').sort((a,b)=>a.date.localeCompare(b.date));
  const dups=doubtfulDuplicates();
  const unverified=state.accounts.filter(a=>!a.verified);
  const withoutReceipt=selectedOps().filter(o=>!o.reversed_by&&['expense','obligation','sale'].includes(o.kind)&&!evidenceOf(o.id).length);
  const month=d=>new Intl.DateTimeFormat('es-UY',{month:'short',timeZone:'UTC'}).format(new Date(d+'T12:00:00Z')).replace('.','');
  const due=(o,tone,receivable=false)=>{const d=o.due||o.date;return `<div class="hm-row pd-row"><div class="date-tile ${tone}"><b>${d.slice(-2)}</b><small>${month(d)}</small></div><button type="button" class="hm-main pd-open" data-operation="${o.id}"><b>${escape(o.concept)}</b><small>${receivable?'Venta del ':o.due<today()?'Venció el ':'Vence el '}${dateFmt(d)}${o.applied?' · pago parcial':''}</small></button><div class="hm-amt">${fmt(o.amount-o.applied,o.currency)}<button type="button" class="mini-button" data-pay="${o.id}" data-type="${receivable?'collection':'payment'}">${receivable?'Cobrar':'Pagar'}</button></div></div>`;};
  const group=(title,count,tone,body)=>body?`<section class="hm-sec"><div class="hm-head"><h2>${title}</h2><span class="hm-count ${tone}">${count}</span></div>${body}</section>`:'';
  const review=[
    dups.length?`<button type="button" class="hm-row" data-action="dups"><i class="dot amber" aria-hidden="true"></i><div class="hm-main"><b>${dups.length===1?'1 posible duplicado':dups.length+' posibles duplicados'}</b><small>No se fusionan solos: los revisás a mano</small></div><span class="hm-go" aria-hidden="true">›</span></button>`:'',
    unverified.length?`<button type="button" class="hm-row" data-view="accounts"><i class="dot amber" aria-hidden="true"></i><div class="hm-main"><b>${unverified.length===1?'1 cuenta sin verificar':unverified.length+' cuentas sin verificar'}</b><small>La apertura no se confirmó contra su fuente</small></div><span class="hm-go" aria-hidden="true">›</span></button>`:'',
    withoutReceipt.length?`<button type="button" class="hm-row" data-view="moves"><i class="dot flat" aria-hidden="true"></i><div class="hm-main"><b>${withoutReceipt.length===1?'1 registro sin comprobante':withoutReceipt.length+' registros sin comprobante'}</b><small>Es opcional: un gasto sin factura también se registra</small></div><span class="hm-go" aria-hidden="true">›</span></button>`:''
  ].join('');
  const none=!payables.length&&!receivables.length&&!review;
  return `<div class="hm pd">
    <section class="hm-pair" aria-label="Compromisos"><div class="hm-tile"><span>Por pagar</span><b>${fmt(t?.payable||0)}</b><small>${payables.length?(payables.length===1?'1 compromiso':payables.length+' compromisos'):'Sin compromisos'}</small></div><div class="hm-tile"><span>Por cobrar</span><b>${fmt(t?.receivable||0)}</b><small>${receivables.length?(receivables.length===1?'1 venta':receivables.length+' ventas'):'Sin ventas pendientes'}</small></div></section>
    ${group('Vencidas',late.length,'red',late.map(o=>due(o,'late')).join(''))}
    ${group('Próximas',soon.length,'',soon.map(o=>due(o,'')).join(''))}
    ${group('Por cobrar',receivables.length,'blue',receivables.map(o=>due(o,'blue',true)).join(''))}
    ${group('Para revisar',(dups.length?1:0)+(unverified.length?1:0)+(withoutReceipt.length?1:0),'',review)}
    ${none?'<p class="hm-quiet">Nada pendiente en '+escape(unit||'esta moneda')+'.</p>':''}
    <button type="button" class="hm-notice" data-action="rules"><span>Reglas por validar <b>3 decisiones abiertas</b></span><i>Ver ›</i></button>
  </div>`;
}
// Configuración: lista tipo ajustes en tres grupos. Los textos largos viven en hojas, no en la pantalla.
function settings(){
  const item=(tone,glyph,title,sub,attrs,danger=false)=>`<button type="button" class="hm-row st-row${danger?' danger':''}" ${attrs}><div class="hm-ico ${tone}">${icon(glyph)}</div><div class="hm-main"><b>${title}</b><small>${sub}</small></div><span class="hm-go" aria-hidden="true">›</span></button>`;
  const group=(title,body)=>`<section class="hm-sec"><div class="hm-head"><h2>${title}</h2></div>${body}</section>`;
  return `<div class="hm st">
    ${group('Datos',item('wallet','up','Importar CSV','Plantilla acotada, con vista previa','data-action="import"')+item('cash','download','Exportar CSV','Todas las operaciones','data-action="export"'))}
    ${group('App',item('wallet','phone','Instalar en el iPhone','Desde Safari, con conexión','data-action="install"')+item('bank','logout','Cerrar sesión','Salir de este dispositivo','data-action="logout"',true))}
    ${group('Información',item('wallet','shield','Alcance del servicio','Qué hace y qué no hace esta versión','data-action="scope"')+item('wallet','info','Registro de actividad',`${state.audit.length?state.audit.length+' eventos':'Sin actividad todavía'}`,'data-action="audit"'))}
  </div>`;
}
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
// fusionan solos. Compartir solo importe y fecha no alcanza: dos gastos distintos de $1.250 el
// mismo día no deben marcarse como duplicados.
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
// Registro rápido (capa de interfaz): la fecha, la cuenta y la categoría pasan a una barra fija
// sobre el botón de guardar, de modo que queden visibles encima del teclado del iPhone.
// Los campos originales siguen siendo los que se envían: aquí solo se reubican y se muestran distinto.
// ===== Registro por voz (capa de interfaz) =====
// Pedido del usuario 29/10/2026: al abrir «Registrar» se ve primero un micrófono grande. Lo dictado se
// interpreta con parseSpokenInvoice (la misma función pura de siempre), se muestra en una confirmación
// compacta y solo se guarda al tocar «Guardar». El comprobante no se lee automáticamente.
const CATEGORY_HINTS=[['Comida',/comida|almuerzo|cena|desayuno|restaurante|pizza|cafe|merienda/],['Transporte',/nafta|combustible|taxi|uber|peaje|estacionamiento|transporte/],['Alquiler',/alquiler|renta/],['Suscripciones',/suscripcion|netflix|spotify|licencia|membresia/],['Servicios',/\b(luz|agua|internet|ute|ose|antel|telefono|gas)\b|servicio/],['Mercadería',/filamento|material|mercaderia|insumo|stock|rollo|proveedor|resina|repuesto/],['Envíos',/envio|correo|courier|flete|despacho/],['Publicidad',/publicidad|anuncio|\bads\b|campana|promocion/],['Sueldos',/sueldo|salario|jornal|aguinaldo/],['Impuestos',/impuesto|\bdgi\b|\bbps\b|\biva\b|tasa/],['Comisiones',/comision/]];
const guessCategory=said=>{const t=fold(said);return(CATEGORY_HINTS.find(([,re])=>re.test(t))||[])[0]||'';};
// Detecta la cuenta nombrada («con Santander», «desde Mercado Pago») y la quita del texto, para que no ensucie el concepto.
function takeAccount(said,currency){
  const list=state.accounts.filter(a=>a.currency===currency);
  const t=fold(said);
  const hit=list.find(a=>t.includes(fold(a.name)))||list.find(a=>fold(a.name).split(/\s+/).some(w=>w.length>3&&t.includes(w)));
  if(!hit)return {id:'',text:said};
  const words=fold(hit.name).split(/\s+/).filter(w=>t.includes(w)&&(w.length>3||fold(hit.name)===w));
  const first=Math.min(...words.map(w=>t.indexOf(w)));
  const end=Math.max(...words.map(w=>t.indexOf(w)+w.length));
  let from=first;
  const lead=t.slice(0,first).match(/(?:[,;]\s*|\s)(?:(?:lo\s+)?(?:pague|abone|pago)\s+)?(?:con|desde|de|en)\s+(?:la\s+)?(?:cuenta\s+)?(?:de\s+)?$/);
  if(lead)from=first-lead[0].length;
  return {id:hit.id,text:(said.slice(0,from)+' '+said.slice(end)).replace(/\s+/g,' ').replace(/[\s,;]+$/,'').trim()};
}
// El servidor lee «1.800» como 1,80: aquí «1.800» y «1,5» se normalizan antes de mostrar el importe, que la persona confirma.
function normAmount(raw,zero=false){
  let t=String(raw||'').trim().replace(/[^\d.,]/g,'');
  if(t.includes(','))t=t.replace(/\./g,'').replace(',','.');
  else if(/^\d{1,3}(\.\d{3})+$/.test(t))t=t.replace(/\./g,'');
  const n=Number(t);return Number.isFinite(n)&&(n>0||(zero&&n===0&&t!==''))?n.toFixed(2):'';
}
// Registro en pasos para todas las operaciones: capturar (solo gastos nuevos, por voz, foto o texto) →
// revisar (filas grandes que abren una hoja inferior) → «Más detalles» opcional → resumen y guardar.
// Solo cambia la interfaz: cada tipo envía al servidor el mismo comando, con los mismos campos y la misma
// clave de idempotencia de siempre.
const moneyHtml=(cents,cur)=>new Intl.NumberFormat('es-UY',{style:'currency',currency:cur||'UYU',minimumFractionDigits:2}).formatToParts(cents/100).map(p=>['currency','decimal','fraction'].includes(p.type)?`<small>${p.value}</small>`:p.value).join('');
const KIND_INFO={expense:['Gasto pagado','Ya salió de una cuenta'],obligation:['Obligación','Una deuda pendiente de pago'],sale:['Venta','Todavía no es un cobro'],payment:['Pago de obligación','Reduce una deuda pendiente'],collection:['Cobro de venta','Asocia un cobro a una venta'],transfer:['Transferencia','Entre tus cuentas, no es un gasto'],withdrawal:['Retiro personal','No es un gasto operativo'],account:['Nueva cuenta','Un saldo inicial no es un ingreso']};
const KIND_NEEDS={expense:['amount','account','concept'],obligation:['amount','concept'],sale:['amount','concept'],payment:['target','amount','account','concept'],collection:['target','amount','commission','account','concept'],transfer:['amount','account','toAccount','concept'],withdrawal:['amount','account','concept'],account:['name','amount']};
let lastCaptureAt=0;
const KIND_FILE=['expense','obligation','sale','payment','collection'];
const ACCOUNT_KINDS=[['bank','🏦','Banco'],['wallet','📱','Billetera digital'],['cash','💵','Efectivo']];
function quickCapture(kind='expense',targetId='',opts={}){
  if(!state)return;
  // Un mismo toque puede llegar por más de un manejador de la página: el segundo aviso se ignora.
  if(Date.now()-lastCaptureAt<500&&modal.open&&modal.classList.contains('capture'))return;
  lastCaptureAt=Date.now();
  if(state.access==='viewer'){toast('Tu acceso es de solo lectura.');return;}
  pendingRequest=null;
  const currencies=[...new Set(state.accounts.map(a=>a.currency))];
  const target0=state.operations.find(o=>o.id===targetId);
  const d={kind,concept:'',amount:'',currency:target0?.currency||unit||currencies[0]||'UYU',date:'',due:'',category:'',accountId:'',toAccountId:'',targetId:'',commission:'',name:'',accountKind:'bank',cutoff:today(),verified:false,accessible:false,file:null};
  let phase=kind==='expense'&&!targetId?'capture':'review',sheet='',listening=false,typed=false,err='',recognition=null,gen=0,shown='';
  const live=()=>modal.open&&modal.classList.contains('capture');
  const has=k=>({amount:()=>!!d.amount,account:()=>!!d.accountId,toAccount:()=>!!d.toAccountId&&d.toAccountId!==d.accountId,target:()=>!!d.targetId,commission:()=>d.commission!=='',concept:()=>!!d.concept,name:()=>!!d.name})[k]();
  const missing=()=>KIND_NEEDS[d.kind].find(k=>!has(k))||'';
  const cap=text=>text?text[0].toUpperCase()+text.slice(1):'';
  const todayLabel=v=>!v||v===today()?'Hoy':dateFmt(v);
  const accountsFor=(skip='')=>state.accounts.filter(a=>a.currency===d.currency&&a.id!==skip);
  const pendingFor=()=>state.operations.filter(o=>o.kind===(d.kind==='payment'?'obligation':'sale')&&o.amount>o.applied&&o.currency===d.currency&&!o.reversed_by);
  const accountName=id=>state.accounts.find(a=>a.id===id)?.name||'';
  const pickTarget=o=>{d.targetId=o.id;d.currency=o.currency;d.amount=decimal(o.amount-o.applied);d.concept=`${d.kind==='payment'?'Pago':'Cobro'} · ${o.concept}`;};
  if(target0&&['payment','collection'].includes(kind))pickTarget(target0);
  if(kind==='account'){d.currency=unit||currencies[0]||'UYU';}
  const absorb=said=>{
    const {id,text}=takeAccount(said,d.currency);
    const p=parseSpokenInvoice(text,{today:today(),currency:d.currency});
    if(!p.ok){err=p.warnings?.[0]||'No te escuché bien. Probá de nuevo.';return;}
    if(p.kind)d.kind=p.kind;
    if(p.concept)d.concept=cap(p.concept.replace(/\s+(por|de|con|a|en)$/i,'').trim());
    if(p.amountText)d.amount=p.amountText;
    if(p.understood.currency)d.currency=p.currency;
    if(p.date)d.date=p.date;
    if(p.due)d.due=p.due;
    const cat=guessCategory(said);if(cat)d.category=cat;
    if(id)d.accountId=id;
    err='';typed=false;enterReview();
  };
  // Al llegar a «Revisar» se abre sola la hoja del primer dato que falta: no hay formulario que recorrer.
  const enterReview=()=>{phase='review';sheet=missing();};
  const listen=()=>{
    if(listening){try{recognition?.stop();}catch{}return;}
    if(!SPEECH){typed=true;render();return;}
    stopDictation();const run=++gen;
    recognition=new SPEECH();recognition.lang='es-UY';recognition.interimResults=false;recognition.continuous=false;
    invoiceRecognition=recognition;listening=true;err='';render();
    recognition.onresult=e=>{if(run!==gen)return;const said=[...e.results].map(r=>r[0].transcript).join(' ').trim();if(said)absorb(said);};
    recognition.onerror=e=>{if(run!==gen)return;err=e.error==='not-allowed'||e.error==='service-not-allowed'?'Permití el micrófono en los ajustes para dictar.':'No te escuché bien. Probá de nuevo.';};
    recognition.onend=()=>{if(run!==gen)return;invoiceRecognition=null;listening=false;if(live())render();};
    try{recognition.start();}catch{listening=false;invoiceRecognition=null;err='No se pudo iniciar el micrófono.';render();}
  };
  const option=(attrs,main,sub='',on=false)=>`<button type="button" class="sh-opt${on?' on':''}" ${attrs}><span>${main}</span>${sub?`<small>${sub}</small>`:''}</button>`;
  const accountOpts=(act,list,sel)=>list.length?list.map(a=>option(`data-cap="${act}" data-v="${a.id}"`,`🏦 ${escape(a.name)}`,a.currency,sel===a.id)).join(''):`<p class="sh-note">No hay cuentas en ${d.currency}. Creá una desde Cuentas.</p>`;
  const amountTitle=()=>d.kind==='account'?'Saldo inicial':d.kind==='collection'?'Cobro bruto':'¿Cuánto fue?';
  const sheetHtml=()=>{
    if(!sheet)return '';
    let title='',body='';
    const input=(field,cls,ph,val,mode='')=>`<input class="${cls}" data-capfield="${field}" ${mode?`inputmode="${mode}"`:''} maxlength="180" autocomplete="off" placeholder="${ph}" value="${escape(val)}">`;
    const done='<button type="button" class="primary" data-cap="done">Listo</button>';
    if(sheet==='amount'){title=amountTitle();body=input('amount','sh-big','0,00',d.amount,'decimal')+done;}
    if(sheet==='concept'){title='¿De qué fue?';body=input('concept','sh-text','Ej.: dos rollos de filamento',d.concept)+done;}
    if(sheet==='name'){title='Nombre de la cuenta';body=input('name','sh-text','Ej.: Santander o caja física',d.name)+done;}
    if(sheet==='commission'){title='Comisión real del cobro';body=`${input('commission','sh-big','0,00',d.commission,'decimal')}<p class="sh-note">Usá «Sin comisión» solo si confirmaste que no hubo.</p><button type="button" class="sh-add" data-cap="nocomm">Sin comisión</button>${done}`;}
    if(sheet==='kind'){title='Tipo de operación';body=Object.entries(KIND_INFO).filter(([k])=>k!=='account').map(([k,[n,s]])=>option(`data-cap="pick-kind" data-v="${k}"`,n,s,d.kind===k)).join('');}
    if(sheet==='account'){title=d.kind==='collection'?'¿A qué cuenta entró?':d.kind==='transfer'?'Cuenta de origen':d.kind==='withdrawal'?'¿De qué cuenta salió?':'¿Con qué cuenta?';body=accountOpts('pick-account',accountsFor(d.kind==='transfer'?d.toAccountId:''),d.accountId);}
    if(sheet==='toAccount'){title='Cuenta de destino';body=accountOpts('pick-toaccount',accountsFor(d.accountId),d.toAccountId);}
    if(sheet==='target'){title=d.kind==='payment'?'¿Qué obligación pagás?':'¿Qué venta cobrás?';const list=pendingFor();body=list.length?list.map(o=>option(`data-cap="pick-target" data-v="${o.id}"`,escape(o.concept),fmt(o.amount-o.applied,o.currency)+' pendiente',d.targetId===o.id)).join(''):`<p class="sh-note">No hay ${d.kind==='payment'?'obligaciones':'ventas'} pendientes en ${d.currency}.</p>`;}
    if(sheet==='currency'){title='Moneda';body=(d.kind==='account'?['UYU','USD','BRL']:currencies).map(c=>option(`data-cap="pick-currency" data-v="${c}"`,c,'',d.currency===c)).join('');}
    if(sheet==='accountKind'){title='Tipo de cuenta';body=ACCOUNT_KINDS.map(([k,e,n])=>option(`data-cap="pick-akind" data-v="${k}"`,`${e} ${n}`,'',d.accountKind===k)).join('');}
    if(sheet==='category'){title='Categoría';body=`<div class="sh-grid">${CATEGORIES.map(([n,e])=>`<button type="button" class="sh-cat${d.category===n?' on':''}" data-cap="pick-category" data-v="${n}"><span>${e}</span>${n}</button>`).join('')}</div><input class="sh-text" data-capfield="category" maxlength="60" placeholder="Otra categoría…" aria-label="Otra categoría">${d.category?'<button type="button" class="sh-link" data-cap="pick-category" data-v="">Quitar categoría</button>':''}`;}
    if(sheet==='due'||sheet==='cutoff'){title=sheet==='due'?'Vencimiento':'Fecha de corte';body=`<label class="sh-field"><span>${sheet==='due'?'Fecha de vencimiento':'El saldo inicial vale al comenzar este día'}</span><input type="date" data-capfield="${sheet}" value="${sheet==='due'?(d.due||today()):d.cutoff}"></label>${done}`;}
    if(sheet==='more'){title='Más detalles';body=`<label class="sh-field"><span>Fecha de la operación</span><input type="date" data-capfield="date" value="${d.date||today()}" max="${today()}"></label>${KIND_FILE.includes(d.kind)?`<div class="sh-field"><span>Comprobante</span>${d.file?`<div class="sh-file"><b>📎 ${escape(d.file.name.slice(0,26))}</b><button type="button" data-cap="nophoto">Quitar</button></div>`:'<button type="button" class="sh-add" data-cap="pickfile">Agregar foto o PDF</button>'}</div>`:''}${done}`;}
    return `<div class="sheet-wrap"><div class="sheet-back" data-cap="closesheet"></div><div class="sheet" role="dialog" aria-label="${title}"><div class="sheet-grab"></div><h3>${title}</h3>${body}</div></div>`;
  };
  const row=(label,value,key,needFlag,toggle)=>`<button type="button" class="rv-row${needFlag?' need':''}" data-cap="${toggle?'toggle':'open'}" data-v="${key}"><span>${label}</span><b>${value}</b>${toggle?'':'<i aria-hidden="true">›</i>'}</button>`;
  const reviewRows=()=>{
    const k=d.kind,r=[];
    const catRow=()=>d.category?row('Categoría',`${categoryEmoji(d.category)} ${escape(d.category)}`,'category'):row('Categoría','Opcional','category');
    const conceptRow=()=>row('Concepto',d.concept?escape(d.concept):'Falta','concept',!d.concept);
    if(k==='account'){
      r.push(row('Nombre',d.name?escape(d.name):'Falta','name',!d.name));
      const ak=ACCOUNT_KINDS.find(a=>a[0]===d.accountKind);r.push(row('Medio',`${ak[1]} ${ak[2]}`,'accountKind'));
      r.push(row('Moneda',d.currency,'currency'));r.push(row('Fecha de corte',todayLabel(d.cutoff),'cutoff'));
      r.push(row('Saldo verificado',d.verified?'Sí, lo verifiqué':'Todavía no','verified',false,true));
      r.push(row('Fondos accesibles',d.accessible?'Sí':'No','accessible',false,true));
      return r.join('');
    }
    r.push(row('Tipo',KIND_INFO[k][0],'kind'));
    if(['payment','collection'].includes(k)){const o=state.operations.find(o=>o.id===d.targetId);r.push(row(k==='payment'?'Obligación':'Venta',o?escape(o.concept):'Falta','target',!o));}
    if(k==='collection')r.push(row('Comisión',d.commission!==''?fmt(Math.round(Number(d.commission)*100),d.currency):'Falta','commission',d.commission===''));
    if(['expense','payment','withdrawal'].includes(k))r.push(row('Cuenta',d.accountId?`🏦 ${escape(accountName(d.accountId))}`:'Falta','account',!d.accountId));
    if(k==='collection')r.push(row('Entra a',d.accountId?`🏦 ${escape(accountName(d.accountId))}`:'Falta','account',!d.accountId));
    if(k==='transfer'){r.push(row('Desde',d.accountId?`🏦 ${escape(accountName(d.accountId))}`:'Falta','account',!d.accountId));r.push(row('Hacia',has('toAccount')?`🏦 ${escape(accountName(d.toAccountId))}`:'Falta','toAccount',!has('toAccount')));}
    if(!['payment','collection'].includes(k))r.push(conceptRow());
    if(['expense','sale'].includes(k))r.push(catRow());
    if(k==='obligation')r.push(row('Vence',todayLabel(d.due||today()),'due'));
    if(['payment','collection'].includes(k))r.push(conceptRow());
    if(currencies.length>1&&!['payment','collection'].includes(k))r.push(row('Moneda',d.currency,'currency'));
    r.push(row('Más detalles',[todayLabel(d.date),KIND_FILE.includes(k)?(d.file?'1 comprobante':'sin comprobante'):''].filter(Boolean).join(' · '),'more'));
    return r.join('');
  };
  const summaryMeta=()=>{
    const k=d.kind,a=id=>`🏦 ${escape(accountName(id))}`,cat=d.category?`${categoryEmoji(d.category)} ${escape(d.category)}`:'',file=d.file?`📎 ${escape(d.file.name.slice(0,16))}`:'';
    if(k==='account')return [ACCOUNT_KINDS.find(x=>x[0]===d.accountKind)[2],d.currency,`corte ${todayLabel(d.cutoff)}`,d.verified?'verificada':''];
    if(k==='transfer')return [`${a(d.accountId)} → ${a(d.toAccountId)}`,todayLabel(d.date)];
    if(k==='obligation')return [`Vence ${todayLabel(d.due||today())}`,file];
    if(k==='sale')return [cat,todayLabel(d.date),file];
    if(k==='collection')return [`Comisión ${fmt(Math.round(Number(d.commission)*100),d.currency)}`,a(d.accountId),todayLabel(d.date),file];
    return [d.accountId?a(d.accountId):'',cat,todayLabel(d.date),file];
  };
  const render=()=>{
    if(!live())return;
    if(shown!==phase){shown=phase;modal.classList.add('enter');setTimeout(()=>modal.classList.remove('enter'),360);}
    const files='<input type="file" id="cap-file" accept="image/*" capture="environment" hidden><input type="file" id="cap-file2" accept="image/jpeg,image/png,image/webp,application/pdf" hidden>';
    const close=`<button class="icon-btn" data-action="close" aria-label="Cerrar">${icon('close')}</button>`;
    const voiceOk=['expense','obligation','sale'].includes(d.kind);
    if(phase==='capture'){
      modal.innerHTML=`<div class="cap-head"><span></span>${close}</div><div class="cap-main"><button type="button" class="cap-mic${listening?' on':''}" data-cap="mic" aria-label="${listening?'Detener la grabación':'Hablar para registrar'}">${icon('mic')}<i aria-hidden="true"></i></button><p class="cap-hint">${listening?'Escuchando…':typed?'Tocá el micrófono del teclado y hablá':'Tocá y contá qué hiciste'}</p>${typed?'<form class="cap-say"><input name="said" type="text" autocomplete="off" placeholder="Compré filamento por 1.800 pesos, pagué con Santander" aria-label="Qué hiciste"><button class="primary" type="submit">Listo</button></form>':!listening?'<p class="cap-example">«Compré dos rollos de filamento por 1.800 pesos, pagué con Santander»</p>':''}<p class="cap-err" role="alert">${escape(err)}</p></div><div class="cap-alt"><button type="button" data-cap="photo"><span>📷</span>Comprobante</button><button type="button" data-cap="type"><span>⌨️</span>Escribir</button></div>${files}`;
      if(typed)modal.querySelector('.cap-say input')?.focus();
      return;
    }
    const need=missing(),isAcc=d.kind==='account';
    const cents=Math.round(Number(d.amount)*100);
    const capLabel=isAcc?'Saldo inicial':d.kind==='collection'?'Cobro bruto':'';
    const amountBtn=`<button type="button" class="rv-amount${d.amount?'':' need'}" data-cap="open" data-v="amount">${d.amount?moneyHtml(cents,d.currency):`<span>${amountTitle()}</span>`}</button>`;
    if(phase==='review'){
      modal.innerHTML=`<div class="cap-head"><span class="cap-title">${isAcc?'Nueva cuenta':'Revisá'}</span>${close}</div><div class="rv">${capLabel&&d.amount?`<p class="rv-cap">${capLabel}</p>`:''}${amountBtn}<div class="rv-list">${reviewRows()}</div>${isAcc?'<p class="rv-note">Una cuenta nueva no es un ingreso. No cargues de nuevo movimientos anteriores al corte.</p>':''}</div><div class="cap-foot"><button type="button" class="primary" data-cap="next" ${need?'disabled':''}>Continuar</button>${voiceOk?`<button type="button" class="cap-voice${listening?' on':''}" data-cap="mic">${icon('mic')}<span>${listening?'Escuchando… tocá para detener':'Corregir por voz'}</span></button>`:''}</div>${files}${sheetHtml()}`;
    }else{
      const meta=summaryMeta().filter(Boolean);
      modal.innerHTML=`<div class="cap-head"><button class="icon-btn" data-cap="back" aria-label="Volver a revisar">‹</button>${close}</div><div class="sm"><p class="sm-kind">${KIND_INFO[d.kind][0]}</p><div class="sm-amount">${moneyHtml(cents,d.currency)}</div><p class="sm-concept">${escape(isAcc?d.name:d.concept)}</p><p class="sm-meta">${meta.join('  ·  ')}</p><p class="cap-err" role="alert">${escape(err)}</p></div><div class="cap-foot"><button type="button" class="primary" data-cap="save" ${busy?'disabled':''}>${isAcc?'Crear cuenta':'Guardar registro'}</button></div>${files}`;
    }
    const field=modal.querySelector('.sheet [data-capfield]');
    if(field&&field.tagName==='INPUT'&&field.type!=='date'&&sheet!=='category')field.focus({preventScroll:true});
  };
  const buildInput=()=>{
    const k=d.kind,date=d.date||today();
    if(k==='account')return {kind:'account',name:d.name,accountKind:d.accountKind,currency:d.currency,opening:d.amount,cutoff:d.cutoff,verified:d.verified,accessible:d.accessible};
    const i={kind:k,concept:d.concept,amount:d.amount,currency:d.currency,date};
    if(k==='obligation')i.due=d.due||today();
    if(['expense','sale'].includes(k)&&d.category)i.category=d.category;
    if(['expense','payment','collection','transfer','withdrawal'].includes(k))i.accountId=d.accountId;
    if(k==='transfer')i.toAccountId=d.toAccountId;
    if(['payment','collection'].includes(k))i.targetId=d.targetId;
    if(k==='collection')i.commission=d.commission;
    return i;
  };
  const save=async()=>{
    if(busy||missing())return;
    if(!pendingRequest)pendingRequest={key:crypto.randomUUID(),input:buildInput(),file:KIND_FILE.includes(d.kind)?d.file:null};
    busy=true;err='';render();
    try{
      const result=await api('/api/commands',pendingRequest.input,pendingRequest.key);
      const {key,file}=pendingRequest;pendingRequest=null;busy=false;modal.close();modal.innerHTML='';
      if(file)try{await uploadEvidence(result.id,file,`${key}-ev`);}catch(error){toast(`El registro se guardó, pero el comprobante no se adjuntó: ${error.message}`);}
      try{await refresh();toast(d.kind==='account'?'Cuenta creada correctamente.':'Registro guardado correctamente.');}catch{lock('El registro se guardó, pero no se pudo actualizar la vista. Reconectá antes de registrar otra operación.');}
    }catch(error){
      busy=false;err=error.message;if(!error.uncertain)pendingRequest=null;render();
    }
  };
  // Cierra la hoja y, si lo que se acaba de completar era lo que faltaba, abre la hoja del siguiente dato faltante.
  const resolve=()=>{const was=sheet;sheet='';const next=missing();if(phase==='review'&&next&&was!=='more'&&was!==next)sheet=next;render();};
  // Teclado del iPhone: la hoja se ajusta al área visible para que el botón principal no quede tapado.
  keyboardCleanup?.();
  const vv=window.visualViewport;
  if(vv){
    const fit=()=>{const kb=Math.max(0,window.innerHeight-vv.height-vv.offsetTop);modal.style.setProperty('--kb',kb+'px');modal.style.setProperty('--vvh',vv.height+'px');modal.classList.toggle('kb',kb>80);};
    vv.addEventListener('resize',fit);vv.addEventListener('scroll',fit);fit();
    keyboardCleanup=()=>{vv.removeEventListener('resize',fit);vv.removeEventListener('scroll',fit);modal.classList.remove('kb');modal.style.removeProperty('--kb');modal.style.removeProperty('--vvh');keyboardCleanup=null;};
  }
  modal.classList.add('capture');
  modal.addEventListener('close',()=>{gen++;modal.classList.remove('capture','enter');keyboardCleanup?.();modal.onclick=modal.onchange=modal.onsubmit=modal.onkeydown=null;},{once:true});
  modal.onclick=e=>{
    const b=e.target.closest('[data-cap]');if(!b||!live())return;
    const k=b.dataset.cap,v=b.dataset.v,locked=!!pendingRequest;
    if(k==='mic')listen();
    else if(k==='photo')modal.querySelector('#cap-file').click();
    else if(k==='pickfile')modal.querySelector('#cap-file2').click();
    else if(k==='type'){phase='review';sheet='amount';render();}
    else if(k==='open'&&!locked){sheet=v;render();}
    else if(k==='toggle'&&!locked){d[v]=!d[v];render();}
    else if(k==='closesheet'){sheet='';render();}
    else if(k==='done'){resolve();}
    else if(k==='nocomm'){d.commission='0.00';resolve();}
    else if(k==='pick-kind'){d.kind=v;d.targetId='';resolve();}
    else if(k==='pick-account'){d.accountId=v;if(d.toAccountId===v)d.toAccountId='';resolve();}
    else if(k==='pick-toaccount'){d.toAccountId=v;resolve();}
    else if(k==='pick-target'){pickTarget(state.operations.find(o=>o.id===v));resolve();}
    else if(k==='pick-currency'){d.currency=v;if(d.kind!=='account'){if(!accountsFor().some(a=>a.id===d.accountId))d.accountId='';if(!accountsFor().some(a=>a.id===d.toAccountId))d.toAccountId='';d.targetId='';}resolve();}
    else if(k==='pick-akind'){d.accountKind=v;resolve();}
    else if(k==='pick-category'){d.category=v;sheet='';render();}
    else if(k==='nophoto'&&!locked){d.file=null;render();}
    else if(k==='next'&&!missing()){phase='summary';sheet='';render();}
    else if(k==='back'){phase='review';err='';render();}
    else if(k==='save')save();
  };
  modal.onchange=e=>{
    const t=e.target;if(!live())return;
    if(t.id==='cap-file'||t.id==='cap-file2'){
      const file=t.files?.[0];if(!file)return;
      d.file=file;err='';
      if(phase==='capture')enterReview();
      render();return;
    }
    const f=t.dataset.capfield;if(!f||pendingRequest)return;
    if(f==='amount'){d.amount=normAmount(t.value,d.kind==='account');resolve();}
    else if(f==='commission'){d.commission=normAmount(t.value,true);resolve();}
    else if(f==='concept'){d.concept=cap(t.value.trim());resolve();}
    else if(f==='name'){d.name=t.value.trim();resolve();}
    else if(f==='category'){d.category=t.value.trim();sheet='';render();}
    else if(f==='date'){d.date=t.value;render();}
    else if(f==='due'){d.due=t.value;sheet='';render();}
    else if(f==='cutoff'){d.cutoff=t.value||today();sheet='';render();}
  };
  modal.onkeydown=e=>{if(e.key==='Enter'&&e.target.dataset?.capfield){e.preventDefault();e.target.blur();}};
  modal.onsubmit=e=>{if(!e.target.classList.contains('cap-say'))return;e.preventDefault();const v=e.target.said.value.trim();if(v)absorb(v);render();};
  if(phase==='review')sheet=missing();
  if(!modal.open)modal.showModal();
  render();
  if(opts.listen&&phase==='capture')listen();
}
const CATEGORIES=[['Comida','🍔'],['Transporte','🚕'],['Alquiler','🏠'],['Suscripciones','🔁'],['Servicios','💡'],['Mercadería','📦'],['Envíos','🚚'],['Publicidad','📣'],['Sueldos','👥'],['Impuestos','🧾'],['Comisiones','🏷️'],['Otros','➕']];
const categoryEmoji=name=>(CATEGORIES.find(([n])=>n.toLowerCase()===String(name||'').trim().toLowerCase())||[])[1]||'🏷️';
let keyboardCleanup=null;
function quickBar(f){
  const footer=f.querySelector('.dialog-footer');if(!footer)return;
  const bar=document.createElement('div');bar.className='quick-bar';
  const dateField=f.elements.date?.closest('label'),accountField=f.elements.accountId?.closest('label'),category=f.elements.category;
  const chip=(field,icon_,textFn)=>{
    field.classList.add('chip');const t=document.createElement('span');t.className='chip-text';field.prepend(t);
    const refresh=()=>{t.textContent=icon_+' '+textFn();};refresh();f.addEventListener('change',refresh);bar.append(field);
  };
  if(dateField)chip(dateField,'📅',()=>{
    const v=f.elements.date.value,time=new Date().toLocaleTimeString('es-UY',{hour:'2-digit',minute:'2-digit',hour12:false});
    const [y,m,d]=v.split('-').map(Number),label=new Intl.DateTimeFormat('es-UY',{day:'numeric',month:'short'}).format(new Date(y,m-1,d));
    return v===today()?`Hoy · ${time}`:label.replace('.','');
  });
  if(accountField)chip(accountField,'🏦',()=>{const s=f.elements.accountId;return s.selectedOptions[0]?.value?s.selectedOptions[0].textContent.split(' · ')[0]:'Cuenta';});
  const currencyField=f.elements.currency?.closest('label'),fileField=f.querySelector('input[type=file]')?.closest('label');
  if(currencyField&&dateField)chip(currencyField,'💱',()=>f.elements.currency.value||'Moneda');
  if(fileField&&dateField)chip(fileField,'📎',()=>f.elements.evidence?.files?.[0]?.name.slice(0,14)||'Comprobante');
  const dueField=f.elements.due?.closest('label');
  if(dueField&&dateField)chip(dueField,'⏰',()=>{const v=f.elements.due.value;if(!v)return 'Vence';const [y,m,d]=v.split('-').map(Number);return 'Vence '+(v===today()?'hoy':new Intl.DateTimeFormat('es-UY',{day:'numeric',month:'short'}).format(new Date(y,m-1,d)).replace('.',''));});
  if(dateField)f.classList.add('quick');
  if(category){
    category.closest('label').hidden=true;
    const btn=document.createElement('button');btn.type='button';btn.className='chip chip-category';
    const panel=document.createElement('div');panel.className='cat-panel';panel.hidden=true;
    panel.innerHTML=CATEGORIES.map(([n,e])=>`<button type="button" data-cat="${n}"><span>${e}</span>${n}</button>`).join('')+'<input type="text" class="cat-other" maxlength="60" placeholder="Otra categoría…" aria-label="Otra categoría">';
    const refresh=()=>{btn.textContent=category.value?`${categoryEmoji(category.value)} ${category.value}`:'🏷️ Categoría';};refresh();
    btn.addEventListener('click',()=>{panel.hidden=!panel.hidden;});
    panel.addEventListener('click',e=>{const b=e.target.closest('[data-cat]');if(!b)return;category.value=b.dataset.cat;panel.hidden=true;refresh();});
    panel.querySelector('.cat-other').addEventListener('input',e=>{category.value=e.target.value;refresh();});
    bar.append(btn,panel);
  }
  if(bar.children.length)footer.prepend(bar);
  // Teclado del iPhone: la hoja se ajusta al área realmente visible para que la barra y «Guardar» no queden tapados.
  keyboardCleanup?.();
  const vv=window.visualViewport;
  if(vv){
    const fit=()=>{const kb=Math.max(0,window.innerHeight-vv.height-vv.offsetTop);modal.style.setProperty('--kb',kb+'px');modal.style.setProperty('--vvh',vv.height+'px');modal.classList.toggle('kb',kb>80);};
    vv.addEventListener('resize',fit);vv.addEventListener('scroll',fit);fit();
    keyboardCleanup=()=>{vv.removeEventListener('resize',fit);vv.removeEventListener('scroll',fit);modal.classList.remove('kb');modal.style.removeProperty('--kb');modal.style.removeProperty('--vvh');keyboardCleanup=null;};
    modal.addEventListener('close',()=>keyboardCleanup?.(),{once:true});
  }
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
  quickBar(f);
  f.elements.amount?.focus({preventScroll:true});
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
  const kv=(k,v)=>`<div class="kv"><span>${k}</span><b>${v}</b></div>`;
  const editable=state.access!=='viewer'&&!o.reversed_by;
  const actions=[];
  if(editable&&['sale','obligation'].includes(o.kind)&&o.amount>o.applied)
    actions.push(`<button type="button" class="primary" data-pay="${o.id}" data-type="${o.kind==='sale'?'collection':'payment'}">Registrar ${o.kind==='sale'?'cobro':'pago'}</button>`);
  if(state.access!=='viewer'&&o.kind==='payment'&&!o.reversed_by)
    actions.push(`<button type="button" class="secondary" data-delete-payment="${o.id}">Eliminar pago</button>`);
  if(editable&&o.kind!=='reversal'&&o.kind!=='payment')
    actions.push(`<button type="button" class="secondary" data-revert="${o.id}">Eliminar registro</button>`);
  if(editable&&o.kind!=='reversal')
    actions.push(`<button type="button" class="secondary" data-attach="${o.id}">Adjuntar comprobante</button>`);
  const st=opStatusText(o);
  const rows=[kv('Fecha',dateFmt(o.date)),o.category?kv('Categoría',`${categoryEmoji(o.category)} ${escape(o.category)}`):'',o.due?kv('Vence',dateFmt(o.due)):'',['sale','obligation'].includes(o.kind)?kv('Pendiente',fmt(o.amount-o.applied,o.currency)):''].join('');
  openDialog(labels[o.kind],o.concept,`<div class="dialog-body"><div class="sh-hero"><div class="sh-amount${o.reversed_by?' reversed':''}">${moneyHtml(o.amount,o.currency)}</div>${st?pill(st,['Pagado','Cobrado'].includes(st)?'green':st==='Pendiente'||st==='Parcial'?'amber':'gray'):''}</div><div class="kv-list">${rows}</div>${entries.length?`<h3 class="kv-title">Movimientos de cuenta</h3>${entries.map(e=>kv(escape(state.accounts.find(a=>a.id===e.account)?.name||''),fmt(e.amount,o.currency))).join('')}`:'<p class="detail-note">Este registro no mueve dinero por sí mismo.</p>'}${related.length?`<h3 class="kv-title">Operaciones vinculadas</h3>${related.map(r=>`<div class="kv"><button type="button" class="concept-button" data-operation="${r.id}">${escape(r.concept)}<span class="concept-sub">${labels[r.kind]}</span></button><b>${fmt(r.amount,r.currency)}</b></div>`).join('')}`:''}<h3 class="kv-title">Comprobantes</h3>${evidenceSection(o.id,evidenceOf(o.id),editable)}<details class="tech"><summary>Datos técnicos</summary>${kv('Origen',escape(o.source))}${o.external_id?kv('Referencia externa',escape(o.external_id)):''}<p>Identificador</p><code>${escape(o.id)}</code></details></div>`,actions.length?`<div class="dialog-footer">${actions.join('')}</div>`:'');
}
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
// Eliminar una cuenta con movimientos exige decidir qué pasa con ellos: pasarlos a otra
// cuenta existente, crear una cuenta nueva con esa información, o borrarlos también.
function accountDeleteDialog(id){
  const account=state.accounts.find(a=>a.id===id);if(!account||state.access==='viewer')return;
  const movements=state.entries.filter(e=>e.account===id).length;
  if(!movements){
    commandDialog({title:'Eliminar cuenta',subtitle:'Sin movimientos: no se pierde historial.',body:`<p class="form-note">Se eliminará la cuenta «${escape(account.name)}» y su saldo inicial de ${fmt(account.opening,account.currency)}. Esta acción no se puede deshacer.</p>`,confirm:'Eliminar cuenta',retryLabel:'Reintentar eliminación',success:'Cuenta eliminada.',refreshMessage:'La cuenta se eliminó, pero no se pudo actualizar la vista. Reconectá antes de seguir.',input:()=>({kind:'account.delete',accountId:account.id})});
    return;
  }
  const targets=state.accounts.filter(a=>a.currency===account.currency&&a.id!==account.id);
  const plural=movements===1?'':'s';
  openDialog('Eliminar cuenta',`${movements} movimiento${plural} en «${escape(account.name)}»`,`<div class="dialog-body"><p class="form-note">«${escape(account.name)}» tiene ${movements} movimiento${plural} y un saldo de ${fmt(account.balance,account.currency)}. Elegí qué pasa con esa información antes de eliminarla.</p><label class="check"><input type="radio" name="mode" value="move" ${targets.length?'checked':'disabled'}><span><strong>Pasar todo a otra cuenta</strong><span class="choice-sub">Los movimientos y el saldo inicial se suman a la cuenta que elijas. No se pierde nada.</span></span></label><label class="field">Cuenta de destino<select name="toAccountId" ${targets.length?'':'disabled'}>${targets.map(a=>`<option value="${a.id}">${escape(a.name)} · ${a.currency}</option>`).join('')||'<option value="">No hay otra cuenta en esta moneda</option>'}</select></label><label class="check"><input type="radio" name="mode" value="new" ${targets.length?'':'checked'}><span><strong>Crear una cuenta nueva con esta información</strong><span class="choice-sub">Se crea una cuenta nueva con el mismo saldo inicial y ahí pasan los movimientos.</span></span></label><label class="field">Nombre de la cuenta nueva<input name="newname" value="${escape(account.name)}" maxlength="60" ${targets.length?'disabled':''}></label><label class="check"><input type="radio" name="mode" value="purge"><span><strong>Eliminar también sus movimientos</strong><span class="choice-sub">Se borran ${movements} movimiento${plural}, sus pagos, cobros y comprobantes. No se puede deshacer.</span></span></label><p class="error" id="account-error" role="alert"></p></div>`,`<div class="dialog-footer"><button class="secondary" data-action="close">Cancelar</button><button class="primary" id="account-confirm">Continuar</button></div>`);
  let key=null;
  const button=$('#account-confirm');
  const select=$('[name="toAccountId"]',modal), named=$('[name="newname"]',modal);
  const chosen=()=>modal.querySelector('input[name="mode"]:checked')?.value||'new';
  const sync=()=>{const mode=chosen();if(select)select.disabled=mode!=='move';if(named)named.disabled=mode!=='new';$('#account-error').textContent='';button.textContent=mode==='purge'?'Eliminar cuenta y movimientos':mode==='new'?'Crear cuenta y pasar todo':'Mover todo y eliminar cuenta';};
  modal.querySelectorAll('input[name="mode"]').forEach(radio=>radio.addEventListener('change',sync));
  sync();
  button.onclick=async()=>{
    if(busy)return;
    const mode=chosen();$('#account-error').textContent='';
    const input={kind:'account.delete',accountId:account.id};
    if(mode==='move'){
      if(!select?.value){$('#account-error').textContent='Elegí la cuenta de destino.';return;}
      input.mode='move';input.toAccountId=select.value;
    }else if(mode==='new'){
      const name=named?.value.trim();
      if(!name){$('#account-error').textContent='Escribí el nombre de la cuenta nueva.';return;}
      input.mode='move';input.newAccount={name};
    }else{
      input.mode='purge';input.confirm=true;
    }
    busy=true;button.disabled=true;key=key||crypto.randomUUID();
    try{
      await api('/api/commands',input,key);modal.close();modal.innerHTML='';
      try{await refresh();toast(mode==='purge'?'Cuenta y movimientos eliminados.':mode==='new'?'Cuenta nueva creada con los movimientos.':'Movimientos trasladados y cuenta eliminada.');}
      catch{lock('El cambio se guardó, pero no se pudo actualizar la vista. Reconectá antes de seguir.');}
    }catch(error){
      if($('#account-error'))$('#account-error').textContent=error.message;
      if(!error.uncertain)key=null;
      button.disabled=false;if(key&&error.uncertain)button.textContent='Reintentar';
    }finally{busy=false;}
  };
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
  if(busy)return;
  try{await api('/api/logout',{});if(portalMode){location.assign(BASE+'login');return;}session={authenticated:false};view='home';query='';filter='';unit='';lock('Sesión cerrada.');}
  catch{lock('No se pudo confirmar el cierre en el servidor. Reconectá y cerrá sesión antes de dejar este dispositivo.');}
}
function install(){openDialog('LANDUR en tu iPhone','Instalación desde Safari, con conexión HTTPS.',`<div class="dialog-body"><ol class="install-steps"><li>Abrí el enlace de LANDUR directamente en <strong>Safari</strong>, no dentro de otra aplicación.</li><li>Tocá <strong>Compartir</strong> y luego <strong>Agregar a pantalla de inicio</strong>.</li><li>Confirmá el nombre LANDUR y tocá <strong>Agregar</strong>.</li><li>Abrí el icono e ingresá a tu espacio.</li></ol><p class="form-note">Necesitás conexión para ver o registrar operaciones. Sin conexión se muestra una pantalla bloqueada: nunca se simula un guardado.</p></div>`);}
function closeDialog(){if(busy)return;if(pendingRequest&&!confirm('La respuesta anterior no se pudo confirmar. Antes de volver a registrar, revisá los movimientos para evitar duplicados. ¿Cerrar este formulario?'))return;pendingRequest=null;modal.close();modal.innerHTML='';}
modal.addEventListener('cancel',e=>{e.preventDefault();closeDialog();});
document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.view){view=b.dataset.view;query='';filter='';modal.close();render();window.scrollTo(0,0);return;}
  if(b.dataset.form){quickCapture(b.dataset.form);return;}
  if(b.dataset.pay){quickCapture(b.dataset.type,b.dataset.pay);return;}
  if(b.dataset.revert){revertDialog(b.dataset.revert);return;}
  if(b.dataset.attach){$('#evidence-file')?.click();return;}
  if(b.dataset.operation){detail(b.dataset.operation);return;}
  if(b.dataset.account){const a=state.accounts.find(a=>a.id===b.dataset.account);if(!a)return;const ids=new Set(state.entries.filter(e=>e.account===a.id).map(e=>e.operation));openDialog(a.name,`Saldo registrado: ${fmt(a.balance,a.currency)}`,`<div class="dialog-body">${actList(state.operations.filter(o=>ids.has(o.id)))}</div>`);return;}
  if(b.dataset.deleteAccount){accountDeleteDialog(b.dataset.deleteAccount);return;}
  if(b.dataset.removeEvidence){removeEvidenceDialog(b.dataset.removeEvidence);return;}
  if(b.dataset.deletePayment){deletePaymentDialog(b.dataset.deletePayment);return;}
  switch(b.dataset.action){
    case 'register':quickCapture();break;
    case 'voice':quickCapture('expense','',{listen:true});break;
    case 'balanceinfo':openDialog('Cómo se calcula este saldo','',`<div class="dialog-body"><p class="form-note">Los saldos se reconstruyen desde la fecha de corte de cada cuenta más los movimientos registrados desde entonces. LANDUR no consulta tu banco: lo que no está registrado, no aparece.</p><p class="detail-note">Información guardada en el servidor · Sin conexiones bancarias activas.</p></div>`);break;
    case 'close':closeDialog();break;
    case 'install':install();break;
    case 'logout':await logout();break;
    case 'refresh':try{await refresh();toast('Datos actualizados.');}catch(error){toast(error.message);}break;
    case 'scope':openDialog('Alcance del servicio','',`<div class="dialog-body"><p class="form-note">Sin conexiones bancarias ni de tienda activas, sin reservas operativas y sin repartos automáticos: nada de eso se inventa sin validar las reglas primero. Los comprobantes se adjuntan a su operación y quedan en el servidor privado, y las correcciones se hacen revirtiendo con contra-asiento auditado, nunca borrando. Los usuarios y permisos se gestionan en el acceso privado.</p></div>`);break;
    case 'audit':openDialog('Registro de actividad','Lo que se hizo en esta cuenta y quién lo hizo.',`<div class="dialog-body">${state.audit.map(a=>`<div class="audit-row"><span>${escape(a.action)}<span class="concept-sub">${escape(a.actor)}</span></span><span class="muted">${new Date(a.at).toLocaleString('es-UY')}</span></div>`).join('')||'<p class="detail-note">Sin actividad todavía.</p>'}</div>`);break;
    case 'accsheet':{
      const a=state.accounts.find(a=>a.id===b.dataset.v);if(!a)break;
      const kv=(k,v)=>`<div class="kv"><span>${k}</span><b>${v}</b></div>`;
      openDialog(a.name,`${ACCOUNT_KIND_NAME[a.kind]||'Cuenta'} · ${a.currency}`,`<div class="dialog-body"><div class="sh-hero"><div class="sh-amount">${moneyHtml(a.balance,a.currency)}</div>${pill(a.verified?'Apertura verificada':'Apertura sin verificar',a.verified?'green':'amber')}</div><div class="kv-list">${kv('Saldo inicial',`${fmt(a.opening,a.currency)} al inicio del ${dateFmt(a.cutoff)}`)}${kv('Fondos',a.accessible?'Accesibles':'Restringidos')}</div><details class="tech"><summary>Datos técnicos</summary><p>Identificador para importación CSV</p><code>${escape(a.id)}</code></details></div><div class="dialog-footer"><button type="button" class="text-btn" data-account="${a.id}">Ver movimientos ${icon('arrow')}</button>${state.access==='viewer'?'':`<button type="button" class="text-btn danger" data-delete-account="${a.id}">Eliminar cuenta</button>`}</div>`);
      break;}
    case 'seg':{const k=b.dataset.v;view=k==='expenses'?'expenses':k==='sales'?'sales':'moves';actOther=k==='other';render();break;}
    case 'actsearch':searchOpen=!searchOpen;if(!searchOpen)query='';render();$('#search')?.focus();break;
    case 'actmenu':openDialog('Opciones de actividad','',`<div class="dialog-body"><button type="button" class="sh-opt" data-action="import"><span>Importar CSV</span><small>Plantilla acotada, con vista previa</small></button><button type="button" class="sh-opt" data-action="export"><span>Exportar CSV</span><small>Todas las operaciones</small></button></div>`);break;
    case 'rules':openDialog('Decisiones pendientes','Hasta validarlas, no se calcula ni se asume nada.',`<div class="dialog-body"><div class="rule-list"><div class="rule-item"><strong>Disponible y reservas</strong><p>Validar qué compromisos reducen el disponible y cómo evitar descuentos duplicados. El cálculo permanece bloqueado.</p></div><div class="rule-item"><strong>Reinversión mayorista: 25 % o 30 %</strong><p>Los ejemplos difieren. No hay un porcentaje automático hasta confirmar las reglas con Rafa.</p></div><div class="rule-item"><strong>Calidad de la información</strong><p>${state.accounts.filter(a=>!a.verified).length} cuentas con apertura sin verificar. Los saldos actuales se reconstruyen a partir de los registros; no son una consulta bancaria en vivo. Lo que falta no se cuenta como cero ni como verificado.</p></div></div></div>`);break;
    case 'dups':{const list=doubtfulDuplicates();openDialog('Posibles duplicados','Revisión humana: la app señala y no decide.',`<div class="dialog-body"><div class="rule-list">${list.map(group=>`<div class="rule-item"><div class="duplicate-group">${group.map(o=>`<button type="button" class="concept-button" data-operation="${o.id}">${escape(o.concept)}<span class="concept-sub">${labels[o.kind]} · ${dateFmt(o.date)} · ${fmt(o.amount,o.currency)}</span></button>`).join('')}</div><p>${group.length} registros con el mismo importe, la misma cuenta y la misma fecha, escritos con el mismo concepto. No se fusionan solos: abrí cada uno, confirmá cuál es el duplicado y revertí el que sobre.</p></div>`).join('')}</div></div>`);break;}
    case 'policy':openDialog('Disponible: pendiente de validación','Saldo, compromisos y reservas no son lo mismo.',`<div class="dialog-body"><p class="form-note">Falta acordar qué obligaciones y reservas se descuentan, con qué horizonte y cómo evitar solapamientos. Por eso el disponible todavía no se calcula.</p><p class="detail-note">${state?escape(`En ${unit || 'la moneda seleccionada'} se muestran saldos reconstruidos y deudas pendientes por separado. No se asume que todo el saldo esté libre ni que los cobros futuros estén disponibles.`):''}</p></div>`);break;

    case 'import':importDialog();break;
    case 'export':{
      try{const r=await fetch(endpoint('/api/export.csv'),{cache:'no-store',credentials:'same-origin'});if(!r.ok){if(r.status===401)lock('La sesión venció.');throw new Error('No se pudo exportar.');}download(await r.text(),'landur-operaciones.csv','text/csv;charset=utf-8');toast('CSV de todas las monedas exportado. Guardalo en un lugar privado.');}catch(error){toast(error.message);}break;
    }
    case 'update':if(busy||modal.open){toast('Terminá o cerrá el formulario antes de actualizar.');return;}updateWorker?.postMessage('ACTIVATE_UPDATE');break;
  }
});
async function boot(){
  try{session=await api('/api/session');if(session.authenticated)await refresh();else lock();}
  catch(error){lock(error.message);}
}
window.addEventListener('offline',()=>{if(!busy)lock('Sin conexión. No se puede consultar ni guardar. Volvé a conectarte.');else toast('Se perdió la conexión. No cierres el formulario hasta verificar el resultado.');});
window.addEventListener('online',()=>{if(!busy&&!modal.open)boot();});
window.addEventListener('beforeunload',e=>{if(busy||pendingRequest){e.preventDefault();e.returnValue='';}});
window.addEventListener('pagehide',()=>{authEpoch++;state=null;app.innerHTML='';modal.close();modal.innerHTML='';});
window.addEventListener('pageshow',e=>{if(e.persisted)boot();});
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
