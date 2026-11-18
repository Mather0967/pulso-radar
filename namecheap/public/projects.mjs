const error=document.querySelector('#portal-error');
const PROJECTS=['pulso','landur'];
const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE_LABELS=[['member','Miembro'],['admin','Administrador']];
const ACCESS_BADGES={editor:['badge-editor','Edición'],viewer:['badge-viewer','Solo lectura'],none:['badge-none','Sin acceso']};
let csrf='',users=[],selfId='';
async function request(path,method='GET',body) {
  const response=await fetch(path,{method,cache:'no-store',credentials:'same-origin',headers:{'Content-Type':'application/json',...(method==='GET'?{}:{'X-CSRF-Token':csrf})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(response.status===401){location.assign('/login');throw Error('La sesión venció.');}
  const data=await response.json();if(!response.ok)throw Error(data.error||'No se pudo completar la solicitud.');return data;
}

// Helpers: todo el DOM de datos se construye con createElement/textContent, nunca con HTML.
function make(tag,options={},children=[]){
  const node=document.createElement(tag);
  if(options.className)node.className=options.className;
  if(options.text!==undefined)node.textContent=options.text;
  for(const [name,value] of Object.entries(options.attrs||{}))node.setAttribute(name,value);
  node.append(...children);
  return node;
}
const statusTimers=new WeakMap();
function setStatus(node,text,tone='info'){
  if(!node)return;
  node.textContent=text;
  node.dataset.tone=tone;
  // Los avisos de éxito se cierran solos; errores y notas quedan hasta la próxima acción.
  clearTimeout(statusTimers.get(node));
  if(text&&tone==='ok')statusTimers.set(node,setTimeout(()=>{if(node.textContent===text)node.textContent='';},5000));
}
// Avatar con iniciales y un tono estable por nombre (solo textContent y una variable CSS numérica).
function avatar(name){
  const words=String(name||'?').trim().split(/\s+/).filter(Boolean);
  const initials=((words[0]?.[0]||'?')+(words.length>1?words[words.length-1][0]:'')).toUpperCase();
  let hash=0;for(const ch of String(name))hash=(hash*31+ch.codePointAt(0))>>>0;
  const node=make('span',{className:'avatar',text:initials,attrs:{'aria-hidden':'true'}});
  node.style.setProperty('--avatar-hue',String(hash%360));
  return node;
}
function relativeTime(ms){
  const diff=Math.max(0,Date.now()-ms),min=Math.round(diff/60000);
  if(min<1)return 'recién';
  if(min<60)return `hace ${min} min`;
  const h=Math.round(min/60);
  if(h<24)return `hace ${h} h`;
  return new Date(ms).toLocaleDateString('es',{day:'numeric',month:'short'});
}
function normalize(text){
  return String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}
function expiryText(expires){
  if(typeof expires==='number'||/^\d+$/.test(String(expires)))return `Vence en ${expires} horas`;
  if(/^\d+\s+(horas|días|minutos)$/.test(String(expires)))return `Vence en ${expires}`;
  const date=new Date(expires);
  return Number.isNaN(date.getTime())?`Vence ${expires}`:`Vence el ${date.toLocaleString('es')}`;
}

async function setupAdmin(){
  const usersBody=document.querySelector('#users-body'),search=document.querySelector('#user-search'),countNode=document.querySelector('#user-count'),usersStatus=document.querySelector('#users-status');
  const grantsForm=document.querySelector('#grants-form'),grantUser=grantsForm?.elements.id,grantsStatus=document.querySelector('#grants-status');
  const inviteForm=document.querySelector('#invite-form'),inviteResult=document.querySelector('#invite-result'),inviteUrl=document.querySelector('#invite-url'),inviteCopy=document.querySelector('#invite-copy'),inviteExpires=document.querySelector('#invite-expires'),inviteStatus=document.querySelector('#invite-status');
  // pending: confirmación en curso {id, kind:'toggle'|'role', role?, timer?}. busyId: fila guardando.
  let pending=null,busyId=null;

  // ---------- Pestañas accesibles ----------
  const tablist=document.querySelector('.admin-tabs');
  const tabs=[['usuarios','tab-users','panel-users'],['invitar','tab-invite','panel-invite'],['permisos','tab-grants','panel-grants'],['mensajes','tab-messages','panel-messages']]
    .map(([name,tabId,panelId])=>({name,tab:document.getElementById(tabId),body:document.getElementById(panelId)}))
    .filter(t=>t.tab&&t.body);
  let activeTab=null;
  function placeIndicator(){
    if(!tablist||!activeTab)return;
    tablist.style.setProperty('--tab-x',`${activeTab.tab.offsetLeft}px`);
    tablist.style.setProperty('--tab-w',`${activeTab.tab.offsetWidth}px`);
  }
  function showTab(name,{focus=false}={}){
    const next=tabs.find(t=>t.name===name)||tabs[0];
    activeTab=next;
    for(const t of tabs){
      const on=t===next;
      t.tab.setAttribute('aria-selected',String(on));
      t.tab.tabIndex=on?0:-1;
      t.body.hidden=!on;
    }
    placeIndicator();
    if(focus)next.tab.focus();
    if(location.hash!=='#'+next.name)history.replaceState(null,'','#'+next.name);
  }
  tabs.forEach(t=>t.tab.addEventListener('click',()=>showTab(t.name)));
  tablist?.addEventListener('keydown',event=>{
    const index=Math.max(0,tabs.findIndex(t=>t.tab===event.target));
    let next;
    switch(event.key){
      case 'ArrowRight':next=(index+1)%tabs.length;break;
      case 'ArrowLeft':next=(index-1+tabs.length)%tabs.length;break;
      case 'Home':next=0;break;
      case 'End':next=tabs.length-1;break;
      default:return;
    }
    event.preventDefault();
    showTab(tabs[next].name,{focus:true});
  });
  window.addEventListener('hashchange',()=>showTab(location.hash.slice(1)));
  window.addEventListener('resize',placeIndicator);
  document.fonts?.ready.then(placeIndicator);
  showTab(location.hash.slice(1));

  // ---------- Usuarios ----------
  function clearPending(){
    if(pending?.timer)clearTimeout(pending.timer);
    pending=null;
  }
  function accessBadge(user,project){
    const level=user.role==='admin'?'editor':(user.projects?.[project]||'none');
    const [cls,label]=ACCESS_BADGES[level]||ACCESS_BADGES.none;
    return make('span',{className:`badge ${cls}`,text:label});
  }
  function userRow(user,index){
    const busy=busyId===user.id,self=user.id===selfId;
    const confirmingRole=pending?.id===user.id&&pending.kind==='role';
    const confirmingToggle=pending?.id===user.id&&pending.kind==='toggle';

    const roleSelect=make('select',{className:'row-role',attrs:{'aria-label':`Rol de ${user.name}`}});
    for(const [value,label] of ROLE_LABELS)roleSelect.add(new Option(label,value));
    roleSelect.value=confirmingRole?pending.role:user.role;
    roleSelect.disabled=busy;
    roleSelect.addEventListener('change',()=>onRoleChange(user,roleSelect.value));
    const roleCell=[roleSelect];
    if(confirmingRole){
      const yes=make('button',{className:'row-role-confirm',text:'Confirmar',attrs:{type:'button'}});
      const no=make('button',{className:'row-role-cancel',text:'Cancelar',attrs:{type:'button'}});
      yes.disabled=busy;no.disabled=busy;
      yes.addEventListener('click',()=>saveUser(user,{role:pending.role}));
      no.addEventListener('click',()=>{clearPending();renderAll();});
      roleCell.push(make('span',{className:'row-confirm'},[yes,no]));
    }

    const toggle=make('button',{
      className:'row-toggle',
      text:confirmingToggle?'¿Confirmar?':(user.active?'Desactivar':'Activar'),
      attrs:{type:'button'},
    });
    toggle.classList.toggle('is-confirming',confirmingToggle);
    toggle.disabled=busy;
    toggle.addEventListener('click',()=>{
      if(!user.active)return saveUser(user,{active:true});
      if(confirmingToggle)return saveUser(user,{active:false});
      askToggle(user);
    });

    const edit=make('button',{className:'row-edit',text:'Permisos',attrs:{type:'button'}});
    edit.disabled=busy;
    edit.addEventListener('click',()=>openGrants(user.id));

    const row=make('tr',{className:`user-row${user.active?'':' is-inactive'}${self?' is-self':''}${busy?' is-busy':''}`},[
      // data-label: en celular cada fila se muestra como tarjeta con su rótulo.
      make('td',{attrs:{'data-label':'Usuario'}},[make('div',{className:'user-cell'},[avatar(user.name),make('div',{className:'user-ident'},[make('strong',{text:user.name}),make('span',{className:'user-email',text:user.email})])])]),
      make('td',{attrs:{'data-label':'Rol'}},roleCell),
      make('td',{attrs:{'data-label':'Estado'}},[make('span',{className:`badge ${user.active?'badge-active':'badge-inactive'}`,text:user.active?'Activo':'Inactivo'})]),
      make('td',{attrs:{'data-label':'Pulso'}},[accessBadge(user,'pulso')]),
      make('td',{attrs:{'data-label':'LANDUR'}},[accessBadge(user,'landur')]),
      make('td',{attrs:{'data-label':'Acciones'},className:'row-actions-cell'},[make('div',{className:'row-actions'},[toggle,edit])]),
    ]);
    row.style.setProperty('--row-index',index);
    return row;
  }
  function renderUsers(){
    if(!usersBody)return;
    const raw=search?.value||'',query=normalize(raw);
    const shown=users.filter(u=>!query||normalize(u.name).includes(query)||normalize(u.email).includes(query));
    const rows=shown.map((user,index)=>userRow(user,index));
    if(!shown.length){
      const text=users.length?`Ningún usuario coincide con «${raw.trim()}»`:'Todavía no hay usuarios.';
      rows.push(make('tr',{},[make('td',{className:'admin-empty',text,attrs:{colspan:'6'}})]));
    }
    usersBody.replaceChildren(...rows);
    if(countNode)countNode.textContent=`${shown.length} de ${users.length} ${users.length===1?'usuario':'usuarios'}`;
  }
  function askToggle(user){
    clearPending();
    pending={id:user.id,kind:'toggle'};
    pending.timer=setTimeout(()=>{if(pending?.kind==='toggle'){pending=null;renderUsers();}},4000);
    renderUsers();
  }
  function onRoleChange(user,value){
    clearPending();
    if(value!==user.role)pending={id:user.id,kind:'role',role:value};
    renderUsers();
  }
  async function saveUser(user,patch){
    clearPending();
    busyId=user.id;
    renderAll();
    try{
      const result=await request('/api/admin/users','PUT',{id:user.id,...patch});
      if(result.selfChanged){location.assign('/login');return;}
      Object.assign(user,patch);
      const name=user.name;
      setStatus(usersStatus,patch.role?`Rol de ${name} actualizado.`:patch.active===false?`${name} desactivado.`:patch.active?`${name} activado.`:'Usuario actualizado.','ok');
    }catch(e){
      setStatus(usersStatus,e.message,'error');
    }finally{
      busyId=null;
      renderAll();
    }
  }
  search?.addEventListener('input',renderUsers);

  // ---------- Permisos ----------
  function syncGrantOptions(){
    if(!grantUser)return;
    const previous=grantUser.value;
    grantUser.replaceChildren(new Option('Seleccionar usuario',''));
    users.forEach(user=>grantUser.add(new Option(`${user.name} · ${user.email}${user.active?'':' (inactivo)'}`,user.id)));
    grantUser.value=users.some(u=>u.id===previous)?previous:'';
  }
  function chooseGrant(){
    if(!grantsForm)return;
    const user=users.find(u=>u.id===grantUser.value),admin=user?.role==='admin';
    for(const project of PROJECTS){
      const field=grantsForm.elements[project];
      field.value=admin?'editor':(user?.projects?.[project]||'');
      field.disabled=!user||admin;
    }
    grantsForm.querySelector('[type=submit]').disabled=!user||admin;
    setStatus(grantsStatus,admin?'Los administradores tienen edición en ambos proyectos. Para cambiar su rol, usá Administración.':user&&!user.active?'El usuario está inactivo. Asignar permisos no lo reactiva.':'','info');
  }
  function openGrants(id){
    clearPending();
    renderUsers();
    showTab('permisos');
    if(grantUser){
      grantUser.value=id;
      chooseGrant();
      grantUser.focus();
    }
  }
  grantUser?.addEventListener('change',chooseGrant);
  grantsForm?.addEventListener('submit',async event=>{
    event.preventDefault();
    const user=users.find(u=>u.id===grantUser.value);
    if(!user||user.role==='admin')return;
    const button=grantsForm.querySelector('[type=submit]');
    button.disabled=true;
    try{
      const projects=Object.fromEntries(PROJECTS.map(key=>[key,grantsForm.elements[key].value||null]));
      const saved=await request('/api/admin/project-access','PUT',{id:user.id,projects});
      user.projects=saved.projects;
      renderUsers();
      syncGrantOptions();
      setStatus(grantsStatus,'Permisos guardados. El usuario deberá volver a iniciar sesión.','ok');
    }catch(e){
      setStatus(grantsStatus,e.message,'error');
    }finally{
      button.disabled=false;
    }
  });

  // ---------- Invitaciones ----------
  inviteForm?.addEventListener('submit',async event=>{
    event.preventDefault();
    const fields=inviteForm.elements,email=fields.email.value.trim();
    if(!EMAIL_RE.test(email)){
      setStatus(inviteStatus,'Escribí un correo válido.','error');
      fields.email.focus();
      return;
    }
    const button=inviteForm.querySelector('[type=submit]');
    button.disabled=true;
    if(inviteResult)inviteResult.hidden=true;
    setStatus(inviteStatus,'Creando invitación…','info');
    try{
      const data=await request('/api/admin/invite','POST',{email,role:fields.role.value,projects:{pulso:fields.pulso.value||null,landur:fields.landur.value||null}});
      inviteUrl.value=data.url;
      inviteExpires.textContent=expiryText(data.expires);
      inviteResult.hidden=false;
      inviteForm.reset();
      setStatus(inviteStatus,'Invitación creada. Compartí el enlace por un canal seguro.','ok');
    }catch(e){
      setStatus(inviteStatus,e.message,'error');
    }finally{
      button.disabled=false;
    }
  });
  const copyLabel=inviteCopy?.textContent||'Copiar';
  let copyTimer=0;
  inviteCopy?.addEventListener('click',async()=>{
    const value=inviteUrl.value;
    let copied=false;
    try{await navigator.clipboard.writeText(value);copied=true;}catch{copied=false;}
    if(!copied){
      inviteUrl.focus();
      inviteUrl.select();
      inviteUrl.setSelectionRange(0,value.length);
      try{copied=document.execCommand('copy');}catch{copied=false;}
    }
    if(!copied){
      setStatus(inviteStatus,'No se pudo copiar. Seleccioná el enlace y copialo manualmente.','error');
      return;
    }
    inviteCopy.textContent='Copiado';
    clearTimeout(copyTimer);
    copyTimer=setTimeout(()=>{inviteCopy.textContent=copyLabel;},2000);
  });

  // ---------- Mensajes entre administradores ----------
  const messageForm=document.querySelector('#message-form'),messageTo=document.querySelector('#message-to'),messageCount=document.querySelector('#message-count');
  const messagesList=document.querySelector('#messages-list'),messagesStatus=document.querySelector('#messages-status'),readAll=document.querySelector('#messages-read-all');
  const badge=document.querySelector('#messages-badge'),statUnread=document.querySelector('#stat-unread');
  let messages=[],unread=0,messagesLoaded=false;
  function setUnread(count){
    unread=count;
    if(badge){badge.hidden=!count;badge.textContent=count>99?'99+':String(count);}
    if(statUnread)statUnread.textContent=String(count);
    if(readAll)readAll.disabled=!count;
  }
  function messageItem(m){
    const meta=make('div',{className:'msg-meta'},[
      make('strong',{text:m.mine?'Vos':m.fromName}),
      make('span',{className:'msg-to',text:m.to==='all'?'a todos':`a ${m.mine?m.toName:'vos'}`}),
      make('time',{text:relativeTime(m.createdAt),attrs:{datetime:new Date(m.createdAt).toISOString(),title:new Date(m.createdAt).toLocaleString('es')}}),
    ]);
    const item=make('li',{className:`msg-item${m.read?'':' is-unread'}${m.mine?' is-mine':''}`},[
      avatar(m.mine?'Vos':m.fromName),
      make('div',{className:'msg-content'},[meta,make('p',{className:'msg-body',text:m.body})]),
    ]);
    if(!m.read){
      const mark=make('button',{className:'msg-mark',text:'Marcar leído',attrs:{type:'button'}});
      mark.addEventListener('click',()=>markRead([m.id]));
      item.append(mark);
    }
    return item;
  }
  function renderMessages(){
    if(!messagesList)return;
    if(!messages.length){
      messagesList.replaceChildren(make('li',{className:'admin-empty',text:messagesLoaded?'Todavía no hay mensajes. Escribí el primero.':'Cargando mensajes…'}));
      return;
    }
    messagesList.replaceChildren(...messages.map(messageItem));
  }
  function syncRecipients(admins){
    if(!messageTo)return;
    const previous=messageTo.value;
    messageTo.replaceChildren(new Option('Todos los administradores','all'));
    admins.forEach(a=>messageTo.add(new Option(a.name,a.id)));
    messageTo.value=[...messageTo.options].some(o=>o.value===previous)?previous:'all';
  }
  async function loadMessages({quiet=false}={}){
    try{
      const data=await request('/api/admin/messages');
      messages=data.messages;messagesLoaded=true;
      syncRecipients(data.admins);
      setUnread(data.unread);
      renderMessages();
    }catch(e){
      if(!quiet)setStatus(messagesStatus,e.message,'error');
    }
  }
  async function markRead(ids){
    try{
      await request('/api/admin/messages/read','POST',ids?{ids}:{all:true});
      for(const m of messages)if(!ids||ids.includes(m.id))m.read=true;
      setUnread(messages.filter(m=>!m.read).length);
      renderMessages();
    }catch(e){setStatus(messagesStatus,e.message,'error');}
  }
  readAll?.addEventListener('click',()=>markRead(null));
  messageForm?.elements.body.addEventListener('input',()=>{
    if(messageCount)messageCount.textContent=`${messageForm.elements.body.value.length}/2000`;
  });
  messageForm?.addEventListener('submit',async event=>{
    event.preventDefault();
    const body=messageForm.elements.body.value.trim();
    if(!body){setStatus(messagesStatus,'Escribí un mensaje.','error');messageForm.elements.body.focus();return;}
    const button=messageForm.querySelector('[type=submit]');
    button.disabled=true;
    try{
      const {message}=await request('/api/admin/messages','POST',{to:messageTo.value,body});
      messages.unshift(message);
      renderMessages();
      messageForm.elements.body.value='';
      if(messageCount)messageCount.textContent='0/2000';
      setStatus(messagesStatus,message.to==='all'?'Mensaje enviado a todos los administradores.':`Mensaje enviado a ${message.toName}.`,'ok');
    }catch(e){
      setStatus(messagesStatus,e.message,'error');
    }finally{
      button.disabled=false;
    }
  });
  // Ctrl/Cmd + Enter envía desde el cuadro de texto.
  messageForm?.elements.body.addEventListener('keydown',event=>{
    if(event.key==='Enter'&&(event.ctrlKey||event.metaKey))messageForm.requestSubmit();
  });
  // Se refresca cada 30 s solo con la pestaña del navegador visible.
  setInterval(()=>{if(document.visibilityState==='visible')loadMessages({quiet:true});},30000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')loadMessages({quiet:true});});

  // ---------- Carga inicial ----------
  function renderStats(){
    const set=(id,value)=>{const node=document.getElementById(id);if(node)node.textContent=String(value);};
    set('stat-active',users.filter(u=>u.active).length);
    set('stat-admins',users.filter(u=>u.role==='admin'&&u.active).length);
    set('stat-inactive',users.filter(u=>!u.active).length);
    set('users-tab-count',users.length);
  }
  function renderAll(){
    renderUsers();
    renderStats();
    syncGrantOptions();
    chooseGrant();
  }
  loadMessages();
  try{
    const result=await request('/api/admin/users');
    users=result.users;
  }catch(e){
    setStatus(usersStatus,e.message,'error');
  }
  renderAll();
}

try {
  const me=await request('/auth/me');csrf=me.csrf;selfId=me.user?.id||'';
  document.querySelector('#logout').addEventListener('click',async event=>{
    event.currentTarget.disabled=true;
    try{await request('/auth/logout','POST',{});location.assign('/login');}
    catch(e){error.textContent=e.message;event.target.disabled=false;}
  });
  if(document.querySelector('#admin-panel'))await setupAdmin();
}catch(e){error.textContent=e.message;}
// React Bits · SpotlightCard & Micro-interactions
function setupSpotlights() {
  const cards = document.querySelectorAll('[data-spotlight]');
  cards.forEach((card, index) => {
    card.style.setProperty('--card-index', index);
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--spot-x', `${x}px`);
      card.style.setProperty('--spot-y', `${y}px`);
    });
    card.addEventListener('mouseleave', () => {
      card.style.removeProperty('--spot-x');
      card.style.removeProperty('--spot-y');
    });
  });
}
setupSpotlights();

// Never restore personalized project/permission HTML from back-forward cache.
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});

// Spotlight por puntero: expone --mx/--my relativos a cada tarjeta.
function setupPointerSpotlight() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || matchMedia('(pointer: coarse)').matches) return;
  document.querySelectorAll('article.project, [data-spotlight="true"]').forEach(card => {
    card.addEventListener('pointermove', e => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - rect.left}px`);
      card.style.setProperty('--my', `${e.clientY - rect.top}px`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.removeProperty('--mx');
      card.style.removeProperty('--my');
    });
  });
}
setupPointerSpotlight();
