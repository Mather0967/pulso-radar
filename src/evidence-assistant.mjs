const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fields={problem:'Problema',similarities:'Similitudes',differences:'Diferencias y límites',hypothesis:'Hipótesis',missing:'Datos faltantes',alternatives:'Alternativas',next:'Próxima prueba'};
export function wireEvidenceAssistant({root,tab,records,cases,getKey,configure,acceptExtraction,toast}){
 if(!['evidence','cases','analysis'].includes(tab))return;
 const panel=document.createElement('section');panel.className='panel evidence-assistant';
 panel.innerHTML=`<div class="panel-title"><div><p class="eyebrow">GEMINI / ASISTENCIA CON FUENTES</p><h2>${tab==='analysis'?'Proponer relaciones y análisis':'Consultar el conocimiento guardado'}</h2></div><span class="chip neutral">Revisión humana</span></div><p class="small">Al ejecutar se envían a Google los textos de este expediente y, para relaciones, los casos seleccionados. Se usa la conexión del servidor o tu clave temporal. Gemini propone; las fuentes originales se conservan.</p><div class="form-stack">${tab==='analysis'?'<button class="secondary" data-assist="relate">Proponer análisis con los casos seleccionados</button>':`<label>Pregunta sobre estos registros<input data-ai-question maxlength="500" placeholder="¿Qué sabemos sobre la coordinación de agendas?"></label><button class="secondary" data-assist="query">Consultar con Gemini</button><label>Original para extraer campos<select data-ai-original><option value="">Seleccionar un registro</option>${(tab==='cases'?cases:records).map(r=>`<option value="${esc(r.id)}">${esc(r.title)}</option>`).join('')}</select></label><button class="secondary" data-assist="extract">Proponer campos del original</button>`}</div><div class="assistant-output" aria-live="polite"></div>`;
 root.querySelector('#v1-content').append(panel);
 const output=panel.querySelector('.assistant-output');
 const buttons=[...panel.querySelectorAll('[data-assist]')];
 buttons.forEach(button=>button.onclick=async()=>{
  const key=getKey();if(!key||key.length<20){try{const status=await fetch('/api/ai/status',{signal:AbortSignal.timeout(10000)});const config=await status.json();if(!status.ok||!config.configured||config.provider!=='gemini')throw Error();}catch{toast('Configurá Gemini en el servidor o usá una clave temporal.');configure();return;}}
  const mode=button.dataset.assist;
  let selected=tab==='cases'?cases.map(r=>({...r,kind:'case'})):records.map(r=>({...r,kind:'evidence'}));
  if(mode==='extract')selected=selected.filter(r=>r.id===panel.querySelector('[data-ai-original]').value);
  if(mode==='relate'){
   const ids=new Set([...root.querySelectorAll('#v1-analysis input[name="caseIds"]:checked')].map(n=>n.value));
   selected.push(...cases.filter(r=>ids.has(r.id)).map(r=>({...r,kind:'case'})));
  }
  if(!selected.length)return toast('Seleccioná un original o agregá evidencia antes de consultar.');
  if(selected.length>40)return toast('La consulta admite hasta 40 registros. Usá un expediente más acotado.');
  const query=panel.querySelector('[data-ai-question]')?.value.trim()||'';
  if(mode==='query'&&!query)return toast('Escribí una pregunta.');
  buttons.forEach(b=>b.disabled=true);output.textContent='Consultando a Gemini. El original permanece sin cambios…';
  try{
   const response=await fetch('/api/ai/evidence',{method:'POST',headers:{'Content-Type':'application/json',...(key?{'X-Pulso-Gemini-Key':key}:{})},body:JSON.stringify({mode,query,records:selected}),signal:AbortSignal.timeout(65000)});
   const data=await response.json();if(!response.ok)throw new Error(data.error||'No se pudo consultar a Gemini.');
   if(!panel.isConnected)return;
   const result=data.result;
   const citations=(items)=>items.map(c=>{const original=selected.find(r=>r.id===c.recordId);return `<blockquote><p>${esc(c.quote)}</p><footer>${esc(original?.title)} · ${esc(original?.date)} · ${esc(original?.source)}</footer></blockquote>`}).join('');
   if(mode==='query')output.innerHTML=`<h3>Respuesta asistida, no verificada</h3><p class="original-text">${esc(result.answer)}</p>${citations(result.citations)}${result.missing.length?`<h3>Información faltante</h3><ul>${result.missing.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>`:''}`;
   if(mode==='extract'){
    output.innerHTML=`<h3>Campos propuestos · pendientes de revisión</h3>${result.suggestions.map((s,i)=>`<article class="evidence-card"><h3>${esc(s.title)}</h3><p class="original-text">${esc(s.summary)}</p>${citations([s])}<button class="secondary" data-accept-extraction="${i}">Guardar como hipótesis separada</button></article>`).join('')||'<p>No se encontraron campos sustentados en el original.</p>'}${result.missing.map(s=>`<p class="small">${esc(s)}</p>`).join('')}`;
    panel.querySelectorAll('[data-accept-extraction]').forEach(b=>b.onclick=()=>{try{const suggestion=result.suggestions[Number(b.dataset.acceptExtraction)];const original=selected.find(r=>r.id===suggestion.recordId);acceptExtraction(original,suggestion);b.disabled=true;b.textContent='Hipótesis guardada; original conservado';toast('La sugerencia quedó sin revisar.')}catch(error){toast(error.message)}});
   }
   if(mode==='relate'){
    output.innerHTML=`<h3>Borrador propuesto · no guardado</h3>${Object.entries(fields).map(([k,label])=>`<h4>${label}</h4><p class="original-text">${esc(result[k])}</p>`).join('')}${citations(result.citations)}<button class="secondary" data-apply-analysis>Cargar en el formulario para revisar</button><p class="small">Después revisá los campos y guardá el análisis. La propuesta no marca ninguna fuente como revisada.</p>`;
    panel.querySelector('[data-apply-analysis]').onclick=()=>{const form=root.querySelector('#v1-analysis');if(!form)return;for(const k of Object.keys(fields))form.elements[k].value=result[k];form.querySelectorAll('input[name="caseIds"]').forEach(n=>n.checked=result.caseIds.includes(n.value));const refs=result.citations.map(c=>{const r=selected.find(r=>r.id===c.recordId);return `[${r.id}] ${r.title} (${r.date}; ${r.source}): «${c.quote}»`}).join('\n');form.elements.problem.value+='\n\nReferencias propuestas por Gemini (revisar):\n'+refs;toast('Borrador cargado. Revisá y guardá el análisis.');form.scrollIntoView({behavior:'smooth',block:'start'});};
   }
  }catch(error){if(panel.isConnected)output.textContent=error.name==='TimeoutError'?'La consulta demoró demasiado. Tus registros siguen guardados.':error.message}
  finally{if(panel.isConnected)buttons.forEach(b=>b.disabled=false)}
 });
}
