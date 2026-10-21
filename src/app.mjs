import {initLab} from './lab.mjs';
import {initOperations} from './operations.mjs';
import {initSync} from './sync.mjs';
import {initWorkspace} from './workspace.mjs';
let refreshV1=()=>{};
let refreshLab=null;
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>crypto.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);
const money=v=>'USD '+Math.round(Number(v)||0).toLocaleString('es-UY');
const safeUrl=value=>{try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return ''}};
const labels={
 workspace:['INTELIGENCIA COMERCIAL','Ciclo de oportunidad','La evidencia abre oportunidades.','Del conocimiento local a una reunión mejor preparada. Fuentes, contexto y decisiones que podés defender.'],
 command:['WORKSPACE RIVECT','Inicio','La claridad se convierte en acción.','Tu cartera, evidencia y próximos pasos. Un espacio para investigar mejor y construir con propósito.'],
 companies:['CARTERA','Empresas','Una vista única de cada empresa, su evidencia y el próximo paso.','Agregá empresas manualmente o desde el radar público de Rivera y Livramento.'],
 research:['INVESTIGACIÓN','Huella digital','Convertí presencia pública en un expediente trazable.','Enlaces, canales, señales operativas y vacíos visibles; hechos separados de hipótesis.'],
 benchmark:['PLANIFICACIÓN','Escenarios','Hacé explícitos tus supuestos.','Explorá horas, costos y oportunidades declaradas. Estas cifras no demuestran ahorro ni demanda comercial.'],
 demos:['LABORATORIOS','Demo Lab','Probá el flujo. Validá la mejora.','Laboratorios interactivos con registros editables, persistencia, respaldo y exportación independiente.'],
 agent:['CONFIGURACIÓN','Agente IA','Autonomía con evidencia, límites y aprobación humana.','La IA investiga y propone; nunca contacta empresas ni transforma supuestos en hechos.'],
 radar:['FUENTE LOCAL','Radar Rivera','Descubrí empresas cercanas para incorporar.','OpenStreetMap aporta registros públicos; no confirma actividad ni necesidad de compra.']
};

let store={companies:[],demos:[]};
try{store={...store,...JSON.parse(localStorage.getItem('pulso-intelligence')||'{}')}}catch{}
if(!Array.isArray(store.companies))store.companies=[];
if(!Array.isArray(store.demos))store.demos=[];
let activeId=store.companies[0]?.id||null;
let radar=[];
let radarLoading=false;
let currentDemo='';
let geminiKey='';

const preferredTheme=localStorage.getItem('pulso-theme')||'dark';
function applyTheme(theme){
 document.documentElement.dataset.theme=theme;
 const button=$('#theme-toggle');
 if(button){button.querySelector('span').textContent=theme==='dark'?'☼':'◐';button.querySelector('b').textContent=theme==='dark'?'Claro':'Oscuro';button.setAttribute('aria-label',theme==='dark'?'Activar modo claro':'Activar modo oscuro')}
}
applyTheme(preferredTheme);
$('#theme-toggle').onclick=()=>{const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';localStorage.setItem('pulso-theme',theme);applyTheme(theme)};

const references=[
 {sector:['retail','comercio','supermercado','ferretería','tienda'],name:'Zoho Inventory',pattern:'Inventario, pedidos, alertas y flujos conectados por webhooks.',source:'https://www.zoho.com/inventory/',fit:'Control de stock y seguimiento de pedidos'},
 {sector:['gastronomía','panadería','restaurante','alimentos'],name:"Domino's",pattern:'Pedido digital y seguimiento como parte central de la experiencia.',source:'https://www.dominos.com/',fit:'Pedidos estructurados y estado visible'},
 {sector:['servicios','belleza','peluquería','salud','taller'],name:'Fresha',pattern:'Reserva online, agenda, recordatorios y gestión de clientes.',source:'https://www.fresha.com/',fit:'Agenda y reducción de coordinación manual'},
 {sector:['all'],name:'Shopify Flow',pattern:'Automatizaciones basadas en eventos para operaciones de comercio.',source:'https://www.shopify.com/flow',fit:'Reglas, notificaciones y tareas repetitivas'}
];

function persist(){try{localStorage.setItem('pulso-intelligence',JSON.stringify(store));document.dispatchEvent(new Event('pulso:changed'))}catch{toast('No se pudo guardar en el navegador. Exportá un respaldo para conservar los cambios.');throw Error('Almacenamiento local no disponible')}}
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>$('#toast').hidden=true,3200)}
function company(id=activeId){return store.companies.find(c=>c.id===id)}
function setActive(id){activeId=id;refreshSelects();renderAll()}
function setView(view){
 if(view==='command')renderDashboard();if(view==='companies')renderCompanies();if(view==='demos'&&refreshLab)refreshLab();
 $$('.view').forEach(v=>v.hidden=v.id!==view+'-view');
 $$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
 const l=labels[view];$('#breadcrumb').textContent=l[1];$('#page-kicker').textContent=l[0];$('#page-title').textContent=l[2];$('#page-copy').textContent=l[3];
 $('#primary-action').textContent=(view==='workspace'||view==='companies'||view==='command')?'Agregar empresa':view==='demos'?'Crear laboratorio':'Abrir expediente';
 if(view==='workspace')refreshV1();
 if(view==='research')renderFootprint(company());if(view==='benchmark')renderGap(company());if(view==='radar')loadRadar(false);if(view==='agent')loadAIStatus();
}
$$('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
$$('[data-go]').forEach(b=>b.onclick=()=>setView(b.dataset.go));

function evidenceCount(c){return c?[c.website,c.footprint?.instagram,c.footprint?.facebook,c.footprint?.linkedin,c.footprint?.maps,c.footprint?.notes].filter(Boolean).length:0}
function maturity(c){return Math.min(100,evidenceCount(c)*13+(c?.website?18:0)+(c?.footprint?.notes?8:0))}
function opportunity(c){if(!c?.economics)return 0;return c.economics.mid||0}
function stage(c){if(c.demoId)return 'Demo lista';if(c.economics)return 'Diagnosticada';if(c.footprint)return 'Investigando';return 'Detectada'}
function nextAction(c){if(!c.footprint)return 'Completar huella digital';if(!c.economics)return 'Cuantificar la brecha';if(!c.demoId)return 'Generar una demo';return 'Validar supuestos en conversación'}

function renderDashboard(){
 const total=store.companies.reduce((s,c)=>s+opportunity(c),0);
 $('#total-opportunity').textContent=money(total);$('#metric-companies').textContent=store.companies.length;$('#metric-ready').textContent=store.companies.filter(c=>evidenceCount(c)>=2).length;$('#metric-demos').textContent=store.demos.length;$('#company-count').textContent=store.companies.length;
 const ranked=[...store.companies].sort((a,b)=>(opportunity(b)+evidenceCount(b)*35)-(opportunity(a)+evidenceCount(a)*35)).slice(0,5);
 $('#priority-list').innerHTML=ranked.map((c,i)=>`<div class="priority-row"><span class="priority-rank">${i+1}</span><div><b>${esc(c.name)}</b><p>${esc(nextAction(c))} · ${evidenceCount(c)} evidencias</p></div><span class="opportunity">${opportunity(c)?money(opportunity(c))+'/mes':'Sin estimar'}</span></div>`).join('')||'<div class="empty-state">Agregá la primera empresa para crear una cola de investigación.</div>';
 $('#portfolio-map').innerHTML=ranked.map(c=>`<div class="portfolio-bar" style="height:${Math.max(28,maturity(c)*1.35)}px" title="Madurez digital observada: ${maturity(c)}/100"><span>${esc(c.name)}</span><small>${maturity(c)}/100</small></div>`).join('')||'<div class="empty-state">El mapa aparecerá con la cartera.</div>';
}

function renderCompanies(){
 const q=$('#company-search').value.trim().toLowerCase(),filter=$('#company-filter').value;
 const list=store.companies.filter(c=>(filter==='all'||stage(c)===filter)&&[c.name,c.sector,c.city].join(' ').toLowerCase().includes(q));
 $('#company-grid').innerHTML=list.map(c=>`<article class="company-card"><header><div><p class="eyebrow">${esc(c.city||'Sin ciudad')} · ${esc(c.sector||'Sin sector')}</p><h3>${esc(c.name)}</h3></div><span class="status-pill">${stage(c)}</span></header><p>${esc(c.process||'Proceso manual todavía no documentado.')}</p><div class="gap-grid"><div><b>${maturity(c)}</b><span>madurez digital</span></div><div><b>${evidenceCount(c)}</b><span>evidencias</span></div><div><b>${opportunity(c)?money(opportunity(c)):'—'}</b><span>oportunidad/mes</span></div></div><footer><button class="text-button" data-open-company="${c.id}">${esc(nextAction(c))}</button><button class="ghost" data-remove-company="${c.id}">Eliminar</button></footer></article>`).join('')||'<div class="empty-state">No hay empresas con estos filtros.</div>';
 $$('[data-open-company]').forEach(b=>b.onclick=()=>{setActive(b.dataset.openCompany);setView('research')});
 $$('[data-remove-company]').forEach(b=>b.onclick=()=>{if(confirm('¿Eliminar esta empresa de la cartera local?')){store.companies=store.companies.filter(c=>c.id!==b.dataset.removeCompany);if(activeId===b.dataset.removeCompany)activeId=store.companies[0]?.id||null;persist();renderAll()}});
}

function refreshSelects(){
 const html=store.companies.map(c=>`<option value="${c.id}" ${c.id===activeId?'selected':''}>${esc(c.name)}</option>`).join('');
 ['research-company','economics-company','demo-company'].forEach(id=>{const select=$('#'+id);if(select)select.innerHTML=html||'<option value="">Agregá una empresa primero</option>'});
}

function fillResearch(c){
 $('#research-web').value=c?.website||'';$('#research-instagram').value=c?.footprint?.instagram||'';$('#research-facebook').value=c?.footprint?.facebook||'';$('#research-linkedin').value=c?.footprint?.linkedin||'';$('#research-maps').value=c?.footprint?.maps||'';$('#research-notes').value=c?.footprint?.notes||'';
}
function renderFootprint(c){
 fillResearch(c);$('#footprint-title').textContent=c?c.name:'Seleccioná una empresa';$('#footprint-score').textContent=c?maturity(c):'—';
 if(!c?.footprint){$('#footprint-result').className='empty-state';$('#footprint-result').textContent='Agregá enlaces y observaciones públicas para construir la primera huella.';return}
 const channels=[['Sitio',c.website],['Instagram',c.footprint.instagram],['Facebook',c.footprint.facebook],['LinkedIn',c.footprint.linkedin],['Google Maps',c.footprint.maps]].filter(x=>x[1]);
 const gaps=[];if(!c.website)gaps.push('sitio propio');if(!c.footprint.maps)gaps.push('ficha de ubicación/reseñas');if(!c.footprint.instagram&&!c.footprint.facebook)gaps.push('canal social visible');
 $('#footprint-result').className='';$('#footprint-result').innerHTML=`<div class="footprint-grid"><div class="signal-box"><b>${channels.length} canales</b><span>Dato aportado</span></div><div class="signal-box"><b>${evidenceCount(c)}</b><span>Referencias registradas</span></div><div class="signal-box"><b>${gaps.length} vacíos</b><span>No implica ausencia real</span></div></div><h3>Evidencia aportada</h3><div class="evidence-list">${channels.map(([n,u])=>`<div class="evidence-item"><span>${n}</span><a href="${esc(safeUrl(u)||'#')}" target="_blank" rel="noopener">${safeUrl(u)?'Abrir fuente':'Dato sin URL'}</a></div>`).join('')||'<p class="small">Sin enlaces todavía.</p>'}</div><h3>Hipótesis para validar</h3><p class="small">La presencia observada sugiere investigar ${gaps.length?gaps.join(', '):'la conexión entre sus canales y la operación interna'}. No sabemos si la empresa ya automatiza procesos fuera de lo visible.</p>${c.footprint.notes?`<h3>Observaciones</h3><p class="small">${esc(c.footprint.notes)}</p>`:''}`;
}

function calculateGap(c,values){
 const labor=values.hours*values.cost,revenue=values.leads*values.ticket*(values.margin/100);
 const low=labor*.35+revenue*.15,high=labor*.7+revenue*.4,mid=(low+high)/2;
 return {...values,labor,revenue,low,mid,high};
}
function renderGap(c){
 if(c?.economics){$('#manual-hours').value=c.economics.hours;$('#hour-cost').value=c.economics.cost;$('#missed-leads').value=c.economics.leads;$('#average-ticket').value=c.economics.ticket;$('#gross-margin').value=c.economics.margin}
 $('#gap-title').textContent=c?c.name:'Escenario de planificación';
 if(!c?.economics){$('#gap-result').className='empty-state';$('#gap-result').textContent='Ingresá tus supuestos para calcular costos declarados. El ahorro se valida con una medición antes/después.';return}
 const e=c.economics;$('#gap-result').className='';$('#gap-result').innerHTML=`<div class="gap-hero"><span>COSTO DE HORAS DECLARADAS / MES</span><strong>${money(e.labor)}</strong><small>${e.hours} horas × ${money(e.cost)} por hora</small></div><div class="gap-grid"><div><b>${money(e.revenue)}</b><span>Margen del escenario de oportunidades declaradas</span></div><div><b>${e.margin}%</b><span>Margen ingresado</span></div><div><b>Pendiente</b><span>Ahorro validado con el piloto</span></div></div><p class="assumptions">Estas cifras dependen de los datos ingresados. No prueban pérdidas, demanda ni dinero recuperable. Registrá la fuente de las cifras en el expediente y usá el piloto para medir resultados reales.</p>`;
}
function renderBenchmarks(c){
 const sector=(c?.sector||'').toLowerCase();const chosen=references.filter(r=>r.sector.includes('all')||r.sector.some(s=>sector.includes(s))).slice(0,3);
 $('#benchmark-cards').innerHTML=chosen.map(r=>`<article class="benchmark-card"><p class="eyebrow">REFERENTE FUNCIONAL</p><h3>${esc(r.name)}</h3><p><b>Patrón:</b> ${esc(r.pattern)}</p><p><b>Aplicación posible:</b> ${esc(r.fit)}.</p><a href="${r.source}" target="_blank" rel="noopener">Ver fuente oficial</a></article>`).join('');
}

function demoDocument(c,type,goal){
 const name=esc(c?.name||'Empresa demo'),g=esc(goal||'Reducir trabajo manual');
 const content={
  booking:`<h2>Agenda de hoy</h2><div class="kpis"><b>8 reservas</b><b>2 por confirmar</b></div><div class="item">09:00 · Ana — Confirmada</div><div class="item">10:30 · Marcos — Pendiente</div><button>Enviar recordatorio</button>`,
  orders:`<h2>Pedidos abiertos</h2><div class="kpis"><b>12 pedidos</b><b>USD 486</b></div><div class="item">#1042 · 3 productos — Preparando</div><div class="item">#1043 · 1 producto — Nuevo</div><button>Crear pedido</button>`,
  inventory:`<h2>Alertas de stock</h2><div class="kpis"><b>128 productos</b><b>6 alertas</b></div><div class="item">Producto A · 3 unidades — Bajo</div><div class="item">Producto B · 0 unidades — Reponer</div><button>Generar reposición</button>`,
  dashboard:`<h2>Operación de hoy</h2><div class="kpis"><b>24 tareas</b><b>87% a tiempo</b></div><div class="item">Pedidos procesados · 18/21</div><div class="item">Tiempo medio · 12 min</div><button>Ver detalle</button>`,
  assistant:`<h2>Asistente interno</h2><div class="chat"><p>¿Qué pedidos están demorados?</p><b>Hay 3 pedidos fuera del tiempo objetivo. Revisá #1041, #1048 y #1050.</b></div><input placeholder="Preguntá sobre la operación"><button>Consultar</button>`
 }[type];
 return `<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#eff4f5;font:15px Arial;color:#17353d;padding:24px}.app{max-width:680px;margin:auto;background:#fff;border:1px solid #d8e3e5;border-radius:14px;overflow:hidden}.top{background:#102f39;color:#fff;padding:20px}.top b{font-size:22px}.top p{color:#bdd0d4;margin:6px 0 0}.body{padding:24px}h2{margin-top:0}.kpis{display:flex;gap:10px;margin:15px 0}.kpis b{background:#fae1cf;padding:13px;border-radius:8px;flex:1}.item,.chat{border:1px solid #dce6e8;padding:14px;border-radius:8px;margin:9px 0}button{background:#102f39;color:#fff;border:0;padding:11px 15px;border-radius:7px;margin-top:12px}input{width:100%;padding:12px;border:1px solid #ccdadd;border-radius:7px}.goal{font-size:12px;color:#71858b;margin-top:18px}</style></head><body><div class="app"><div class="top"><b>${name}</b><p>Demo ilustrativa · datos ficticios</p></div><div class="body">${content}<p class="goal"><b>Objetivo:</b> ${g}</p></div></div></body></html>`;
}

function renderDemos(){if(refreshLab)return refreshLab();const d=store.demos.find(d=>d.id===company()?.demoId);if(d){currentDemo=d.html;$('#demo-frame').srcdoc=d.html;$('#demo-title').textContent=d.title;$('#open-demo').disabled=false}else{$('#demo-frame').srcdoc='';$('#demo-title').textContent='Sin demo';$('#open-demo').disabled=true}}

function renderRadar(){
 const q=$('#radar-search').value.trim().toLowerCase();const list=radar.filter(b=>[b.tags?.name,b.tags?.shop].join(' ').toLowerCase().includes(q));
 $('#radar-list').innerHTML=list.slice(0,100).map(b=>`<label class="radar-item"><input type="checkbox" data-radar-id="${b.type}/${b.id}"><span><b>${esc(b.tags.name)}</b><small>${esc(b.tags.shop)} · registro OSM</small></span></label>`).join('')||'<div class="empty-state">No hay resultados.</div>';
}
async function loadRadar(fresh){
 if(radarLoading)return;radarLoading=true;$('#refresh-radar').disabled=true;
 $('#radar-status').textContent=fresh?'Consultando OpenStreetMap…':'Cargando la última captura…';
 try{let data;if(!fresh){const r=await fetch('/api/agent/state',{signal:AbortSignal.timeout(10000)});const s=await r.json();if(!r.ok)throw Error(s.error||'No se pudo leer la captura');data=s.businesses}if(!data){const r=await fetch('/api/businesses?region=frontera',{signal:AbortSignal.timeout(35000)});data=await r.json();if(!r.ok)throw Error(data.error||'Fuente no disponible')}if(!Array.isArray(data?.elements))throw new Error(data?.error||'Fuente no disponible');radar=data.elements;$('#radar-status').textContent=`${radar.length} registros · ${new Date(data.fetchedAt).toLocaleString('es-UY')} · fuente OpenStreetMap${data.warning?' · '+data.warning:''}`;renderRadar()}catch(e){$('#radar-status').textContent='No se pudo actualizar: '+(e.name==='TimeoutError'?'La fuente demoró demasiado; volvé a intentar.':e.message)+'. Se conservan los datos ya visibles.'}finally{radarLoading=false;$('#refresh-radar').disabled=false}
}

function renderAll(){refreshSelects();renderDashboard();renderCompanies();renderFootprint(company());renderGap(company());renderBenchmarks(company());renderDemos();$('#company-count').textContent=store.companies.length;refreshV1()}

function openCompanyDialog(){$('#company-dialog').showModal();$('#company-name').focus()}
$('#quick-add').onclick=openCompanyDialog;$('#add-company').onclick=openCompanyDialog;
$('#primary-action').onclick=()=>{if(!store.companies.length||!$('#workspace-view')?.hidden)openCompanyDialog();else setView('research')};
$('#api-settings').onclick=()=>setView('agent');
$$('.dialog-close').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('#company-form').onsubmit=e=>{e.preventDefault();const c={id:uid(),name:$('#company-name').value.trim(),sector:$('#company-sector').value.trim(),city:$('#company-city').value.trim(),website:safeUrl($('#company-website').value),process:$('#company-process').value.trim(),createdAt:new Date().toISOString()};store.companies.unshift(c);activeId=c.id;persist();e.target.reset();$('#company-city').value='Rivera';$('#company-dialog').close();renderAll();toast('Empresa agregada a la cartera.');setView('research')};
$('#company-search').oninput=renderCompanies;$('#company-filter').onchange=renderCompanies;
['research-company','economics-company','demo-company'].forEach(id=>$('#'+id).onchange=e=>setActive(e.target.value));

$('#research-form').onsubmit=e=>{e.preventDefault();const c=company();if(!c)return toast('Agregá una empresa primero.');c.website=safeUrl($('#research-web').value);c.footprint={instagram:$('#research-instagram').value.trim(),facebook:$('#research-facebook').value.trim(),linkedin:$('#research-linkedin').value.trim(),maps:$('#research-maps').value.trim(),notes:$('#research-notes').value.trim(),updatedAt:new Date().toISOString()};persist();renderAll();toast('Huella digital guardada con sus fuentes.')};
$('#economics-form').onsubmit=e=>{e.preventDefault();const c=company();if(!c)return toast('Agregá una empresa primero.');c.economics=calculateGap(c,{hours:Math.max(0,+$('#manual-hours').value),cost:Math.max(0,+$('#hour-cost').value),leads:Math.max(0,+$('#missed-leads').value),ticket:Math.max(0,+$('#average-ticket').value),margin:Math.min(100,Math.max(0,+$('#gross-margin').value))});persist();renderAll();toast('Brecha calculada con supuestos visibles.')};
$('#demo-form').onsubmit=e=>{e.preventDefault();const c=company();if(!c)return toast('Agregá una empresa primero.');const type=$('#demo-type').value,goal=$('#demo-goal').value.trim();const d={id:uid(),companyId:c.id,title:`${c.name} · ${$('#demo-type').selectedOptions[0].text}`,type,goal,html:demoDocument(c,type,goal),createdAt:new Date().toISOString()};store.demos.unshift(d);c.demoId=d.id;persist();renderAll();toast('Demo generada con datos ficticios.')};
$('#open-demo').onclick=()=>{$('#demo-full').innerHTML=`<iframe style="width:100%;height:70vh;border:0" sandbox="allow-scripts"></iframe>`;$('#demo-full iframe').srcdoc=currentDemo;$('#demo-dialog').showModal()};
$('#radar-search').oninput=renderRadar;$('#refresh-radar').onclick=()=>loadRadar(true);
$('#import-selected').onclick=()=>{const ids=new Set($$('[data-radar-id]:checked').map(n=>n.dataset.radarId));const selected=radar.filter(b=>ids.has(`${b.type}/${b.id}`));if(!selected.length)return toast('Seleccioná al menos una empresa del radar.');let added=0;for(const b of selected){const sourceId=`osm:${b.type}/${b.id}`;if(store.companies.some(c=>c.sourceId===sourceId))continue;store.companies.push({id:uid(),sourceId,name:b.tags.name,sector:b.tags.shop,city:b.tags['addr:city']||'Rivera / Livramento',website:safeUrl(b.tags.website||b.tags['contact:website']),process:'',sourceUrl:`https://www.openstreetmap.org/${b.type}/${b.id}`,createdAt:new Date().toISOString()});added++}persist();renderAll();toast(`${added} empresas agregadas desde OSM.`)};

function updateKeyState(){const ready=geminiKey.length>=20;$('#gemini-key-state').textContent=ready?'Gemini listo durante esta pestaña':'Sin clave temporal';$('#ai-status').textContent=ready?'Gemini temporal listo':($('#run-ai').dataset.serverReady?'IA conectada en el servidor':'Conectar Gemini');$('#ai-chip').textContent=ready?'Gemini listo':($('#run-ai').dataset.serverReady?'IA conectada en el servidor':'Conectar Gemini');$('#run-ai').disabled=!ready&&!$('#run-ai').dataset.serverReady}
async function loadAIStatus(){try{const r=await fetch('/api/ai/status',{signal:AbortSignal.timeout(10000)});const d=await r.json();if(!r.ok)throw Error(d.error||'Estado no disponible');$('#run-ai').dataset.serverReady=d.configured?'1':'';if(!geminiKey){const text=d.configured?(d.provider==='gemini'?'Gemini conectado en el servidor':'OpenAI configurado'):'Conectar Gemini';$('#ai-status').textContent=text;$('#ai-chip').textContent=text;$('#ai-status').className='chip '+(d.configured?'':'neutral');$('#ai-chip').className='chip '+(d.configured?'':'neutral');$('#run-ai').disabled=!d.configured}else updateKeyState()}catch{$('#ai-status').textContent='Estado no disponible';$('#run-ai').disabled=!geminiKey}}
$('#gemini-key').oninput=e=>{geminiKey=e.target.value.trim();updateKeyState()};
$('#clear-gemini-key').onclick=()=>{geminiKey='';$('#gemini-key').value='';updateKeyState();toast('Clave temporal eliminada de la pestaña.')};
$('#refresh-ai').onclick=loadAIStatus;
$('#run-ai').onclick=async()=>{const c=company();if(!c)return toast('Agregá una empresa primero.');$('#ai-output').textContent='Investigando fuentes públicas y preparando el diagnóstico…';$('#run-ai').disabled=true;try{const headers={'Content-Type':'application/json'};if(geminiKey)headers['X-Pulso-Gemini-Key']=geminiKey;const r=await fetch('/api/ai/analyze',{method:'POST',headers,body:JSON.stringify({company:c,provider:geminiKey?'gemini':'openai'})});const d=await r.json();if(!r.ok)throw new Error(d.error||'No se pudo ejecutar');$('#ai-output').textContent=d.analysis||'Sin resultado'}catch(e){$('#ai-output').textContent=e.message}finally{updateKeyState()}};

renderAll();renderBenchmarks(company());loadAIStatus();


refreshV1=initWorkspace({getCompanies:()=>store.companies,getCompany:()=>company(),setCompany:id=>setActive(id),replaceCompanies:companies=>{const previous=store.companies;store.companies=companies;try{persist()}catch(error){store.companies=previous;throw error}activeId=companies[0]?.id||null;renderAll()},toast,getGeminiKey:()=>geminiKey,configureAI:()=>setView('agent')});
setView('command');


const operations=initOperations({getStore:()=>store,getCompany:()=>company(),setCompany:id=>setActive(id),persist,toast,navigate:setView,refresh:renderAll});
renderDashboard=operations.dashboard;renderCompanies=operations.companies;
refreshLab=initLab({getStore:()=>store,getCompany:()=>company(),persist,toast});
renderAll();
initSync({onReload:()=>location.reload(),toast});
setView('command');
