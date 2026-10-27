import { chromium } from 'playwright-core';
import chromiumBinary, { inflate } from '@sparticuz/chromium';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { Ledger } from '../server/ledger.mjs';
import { createApp } from '../server/app.mjs';
import { pngBytes } from '../tests/helpers/png.mjs';

mkdirSync('data/qa',{recursive:true});
const ledger=new Ledger();
const server=createApp({ledger,demo:true,insecureCookies:true});
server.listen(0,'127.0.0.1');await once(server,'listening');
const url=`http://127.0.0.1:${server.address().port}`;
const libraryDir = !process.env.BROWSER_EXECUTABLE && process.platform==='linux'
  ? await inflate(fileURLToPath(new URL('../node_modules/@sparticuz/chromium/bin/al2023.tar.br',import.meta.url))) : null;
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||await chromiumBinary.executablePath(),
  args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--no-zygote','--use-gl=angle','--use-angle=swiftshader'],
  env:{...process.env,...(libraryDir?{LD_LIBRARY_PATH:`${libraryDir}/lib:${process.env.LD_LIBRARY_PATH||''}`}:{})},headless:true});
const errors=[];
// Un PNG de 1×1 real, generado: los comprobantes se validan por sus bytes y el navegador
// tiene que poder decodificarlos para probar el recorte antes de subir.
const PNG=pngBytes();
try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  // Reconocedor simulado: prueba el camino completo del dictado salvo el servicio de voz
  // real, que no existe sin micrófono ni red. Lo que se simula es la transcripción, no la lógica.
  await page.addInitScript(()=>{
    class ReconocimientoSimulado{
      start(){setTimeout(()=>{this.onresult&&this.onresult({results:[{0:{transcript:window.__voiceSaid||''}}]});this.onend&&this.onend();},20);}
      stop(){this.onend&&this.onend();}
    }
    window.SpeechRecognition=ReconocimientoSimulado;window.webkitSpeechRecognition=ReconocimientoSimulado;
  });
  await page.goto(url);await page.getByRole('heading',{name:/Saldos y compromisos|Control financiero del negocio/}).waitFor();
  await page.screenshot({path:'data/qa/desktop.png',fullPage:true});
  const read=()=>page.evaluate(async()=>await(await fetch('/api/state')).json());
  // `waitFor` solo espera el elemento: una miniatura puede estar en pantalla sin haber cargado.
  const thumbLoaded=()=>page.locator('.evidence-thumb').first().evaluate(img=>img.complete?img.naturalWidth>0
    :new Promise(resolve=>{const finish=value=>resolve(value);
      img.addEventListener('load',()=>finish(true),{once:true});img.addEventListener('error',()=>finish(false),{once:true});
      setTimeout(()=>finish(img.naturalWidth>0),5000);}));
  const initial=await read();assert.equal(initial.demo,true);
  // Paid expense with double submit. Both events reach the handler in one task.
  await page.getByRole('button',{name:'Registrar operación',exact:true}).click();
  // Dictación: el botón existe y arranca en reposo. No se simula voz en CI.
  assert.equal(await page.getByRole('button',{name:'Dictar Concepto'}).count(),1);
  assert.equal(await page.getByRole('button',{name:'Dictar Concepto'}).getAttribute('aria-pressed'),'false');
  await page.locator('[name=concept]').fill('Gasto QA sin comprobante');
  await page.locator('[name=amount]').fill('125,50');
  await page.locator('[name=accountId]').selectOption(initial.accounts[0].id);
  await page.locator('#operation-form').evaluate(f=>{f.requestSubmit();f.requestSubmit();});
  await page.locator('#modal').waitFor({state:'hidden'});
  assert.equal((await read()).operations.filter(o=>o.concept==='Gasto QA sin comprobante').length,1);
  await page.reload();await page.getByRole('heading',{name:/Saldos y compromisos|Control financiero del negocio/}).waitFor();
  assert.equal((await read()).operations.filter(o=>o.concept==='Gasto QA sin comprobante').length,1);
  // Dictado de una factura completa: se muestra antes de aplicar y no guarda nada por sí solo.
  await page.getByRole('button',{name:'Registrar operación',exact:true}).click();
  await page.evaluate(()=>{window.__voiceSaid='factura de proveedor de materiales por 1.250 pesos del 24 de octubre';});
  const beforeVoice=(await read()).operations.length;
  await page.getByRole('button',{name:'Dictar la factura'}).click();
  await page.locator('.voice-result').waitFor();
  assert.match(await page.locator('.voice-said').textContent(),/proveedor de materiales/i,'se muestra la transcripción tal como llegó');
  const voiceRows=(await page.locator('.voice-fields div').allTextContents()).join(' | ');
  assert.ok(voiceRows.includes('Proveedor de materiales'),voiceRows);
  assert.ok(/1\.250,00/.test(voiceRows),voiceRows);
  assert.equal((await read()).operations.length,beforeVoice,'el dictado no puede guardar nada por sí solo');
  await page.getByRole('button',{name:'Usar estos datos'}).click();
  assert.equal(await page.locator('[name=concept]').inputValue(),'Proveedor de materiales');
  assert.equal(await page.locator('[name=amount]').inputValue(),'1250.00');
  assert.equal(await page.locator('[name=date]').inputValue(),'2026-10-24');
  await page.locator('[name=accountId]').selectOption(initial.accounts[0].id);
  await page.locator('#operation-form [type=submit]').click();await page.locator('#modal').waitFor({state:'hidden'});
  assert.equal((await read()).operations.find(o=>o.concept==='Proveedor de materiales').amount,125000);
  // Sin importe reconocido se avisa y no se pisa lo que ya estaba escrito.
  await page.getByRole('button',{name:'Registrar operación',exact:true}).click();
  await page.locator('[name=amount]').fill('99');
  await page.evaluate(()=>{window.__voiceSaid='factura de proveedor sin importe';});
  await page.getByRole('button',{name:'Dictar la factura'}).click();
  await page.locator('.voice-result').waitFor();
  assert.ok(await page.locator('.voice-warning').count()>0,'debe avisar que no reconoció el importe');
  await page.getByRole('button',{name:'Usar estos datos'}).click();
  assert.equal(await page.locator('[name=amount]').inputValue(),'99','un importe no reconocido no debe borrar el escrito');
  await page.getByRole('button',{name:'Cancelar'}).click();await page.locator('#modal').waitFor({state:'hidden'});
  // Saved on server, response lost: retry MUST reuse the same idempotency key.
  let lost=false;
  await page.route('**/api/commands',async route=>{
    const input=route.request().postDataJSON();
    if(input.concept==='Respuesta incierta'&&!lost){lost=true;await route.fetch();return route.abort('failed');}
    return route.continue();
  });
  await page.getByRole('button',{name:'Registrar operación',exact:true}).click();
  await page.locator('[name=concept]').fill('Respuesta incierta');await page.locator('[name=amount]').fill('10');
  await page.locator('[name=accountId]').selectOption(initial.accounts[0].id);
  await page.locator('#operation-form [type=submit]').click();
  await page.getByRole('button',{name:'Reintentar mismo registro'}).waitFor();
  assert.equal(await page.locator('[name=concept]').isDisabled(),true);
  await page.getByRole('button',{name:'Reintentar mismo registro'}).click();
  await page.locator('#modal').waitFor({state:'hidden'});
  assert.equal((await read()).operations.filter(o=>o.concept==='Respuesta incierta').length,1);
  await page.unroute('**/api/commands');
  // Pay part of the first obligation from the actual pending list.
  await page.locator('.sidebar [data-view=pending]').click();
  const obligation=(await read()).operations.find(o=>o.kind==='obligation');
  await page.locator(`[data-pay="${obligation.id}"]`).click();
  await page.locator('[name=amount]').fill('100');await page.locator('[name=accountId]').selectOption(initial.accounts[0].id);
  await page.locator('#operation-form [type=submit]').click();await page.locator('#modal').waitFor({state:'hidden'});
  assert.equal((await read()).operations.find(o=>o.id===obligation.id).applied,10000);
  // Reversión auditada: no borra nada, deja contra-asiento y devuelve el saldo.
  await page.locator('.sidebar [data-view=moves]').click();
  const reversible=(await read()).operations.find(o=>o.concept==='Gasto QA sin comprobante');
  const beforeUyu=(await read()).totals.find(t=>t.currency==='UYU').balance;
  await page.locator(`[data-operation="${reversible.id}"]`).click();
  await page.getByRole('button',{name:'Revertir…'}).click();
  await page.getByRole('button',{name:'Registrar reversión'}).click();
  await page.locator('#modal').waitFor({state:'hidden'});
  const after=await read();
  const reversal=after.operations.find(o=>o.kind==='reversal'&&o.related_id===reversible.id);
  assert.ok(reversal,'debe existir el contra-asiento');
  assert.equal(after.operations.find(o=>o.id===reversible.id).reversed_by,reversal.id,'la original queda marcada, no borrada');
  assert.equal(after.operations.find(o=>o.id===reversible.id).concept,'Gasto QA sin comprobante');
  assert.ok(after.audit.some(a=>a.action==='reversal.created'),'la reversión queda auditada');
  assert.equal(after.totals.find(t=>t.currency==='UYU').balance,beforeUyu+reversible.amount,'el contra-asiento devuelve el saldo');
  assert.ok(await page.getByText('Revertido',{exact:true}).count()>0,'la tabla muestra el estado revertido');
  // Una operación ya revertida no ofrece revertirse otra vez.
  await page.locator(`[data-operation="${reversible.id}"]`).click();
  assert.equal(await page.getByRole('button',{name:'Revertir…'}).count(),0,'no se ofrece revertir lo ya revertido');
  await page.getByRole('button',{name:'Cerrar diálogo'}).click();
  assert.equal((await read()).operations.filter(o=>o.kind==='reversal').length,1,null,'no se crea una segunda reversión');
  // Comprobantes: se adjuntan al registrar y desde el detalle, y se leen con la sesión.
  await page.getByRole('button',{name:'Registrar operación',exact:true}).click();
  await page.locator('[name=concept]').fill('Gasto QA con comprobante');
  await page.locator('[name=amount]').fill('310');
  await page.locator('[name=accountId]').selectOption(initial.accounts[0].id);
  await page.locator('[name=evidence]').setInputFiles({name:'ticket.png',mimeType:'image/png',buffer:PNG});
  await page.locator('#operation-form [type=submit]').click();
  await page.locator('#modal').waitFor({state:'hidden'});
  const conComprobante=(await read()).operations.find(o=>o.concept==='Gasto QA con comprobante');
  assert.ok(conComprobante,'el registro con archivo se guarda igual');
  let comprobantes=(await read()).evidence.filter(e=>e.operation===conComprobante.id);
  assert.equal(comprobantes.length,1,'el comprobante queda asociado a la operación');
  await page.locator(`[data-operation="${conComprobante.id}"]`).click();
  const descargado=await page.evaluate(async id=>{const r=await fetch(`/api/evidence/${id}`);return {status:r.status,type:r.headers.get('content-type'),cache:r.headers.get('cache-control')};},comprobantes[0].id);
  assert.equal(descargado.status,200,JSON.stringify(descargado));
  assert.equal(descargado.type,'image/jpeg',JSON.stringify(descargado));
  assert.equal(descargado.cache,'no-store','un comprobante no se cachea');
  await page.locator('.evidence-thumb').waitFor();
  assert.equal(await thumbLoaded(),true,'la miniatura carga desde la API privada');
  await page.getByRole('button',{name:'Cerrar diálogo'}).click();
  // Desde el detalle: el botón abre el selector y el archivo se adjunta a lo ya registrado.
  const sinComprobante=(await read()).operations.find(o=>o.concept==='Proveedor de materiales');
  await page.locator(`[data-operation="${sinComprobante.id}"]`).click();
  const selector=page.waitForEvent('filechooser');
  await page.getByRole('button',{name:'Adjuntar comprobante'}).click();
  await (await selector).setFiles({name:'factura.png',mimeType:'image/png',buffer:PNG});
  await page.locator('.evidence-thumb').waitFor();
  assert.equal(await thumbLoaded(),true,'el comprobante adjuntado desde el detalle también se muestra');
  comprobantes=(await read()).evidence.filter(e=>e.operation===sinComprobante.id);
  assert.equal(comprobantes.length,1,'el comprobante se adjunta a una operación ya registrada');
  assert.equal((await read()).evidence.length,2);
  await page.getByRole('button',{name:'Cerrar diálogo'}).click();
  // Revisión: duplicados dudosos e información incompleta se muestran, nunca se resuelven solos.
  // Mismo concepto, mismo importe, misma cuenta y misma fecha: el caso típico de doble carga.
  for(let n=0;n<2;n++){
    await page.getByRole('button',{name:'Registrar operación',exact:true}).click();
    await page.locator('[name=concept]').fill('Gasto QA repetido');
    await page.locator('[name=amount]').fill('777');
    await page.locator('[name=accountId]').selectOption(initial.accounts[0].id);
    await page.locator('#operation-form [type=submit]').click();
    await page.locator('#modal').waitFor({state:'hidden'});
  }
  await page.locator('.sidebar [data-view=pending]').click();
  await page.getByRole('heading',{name:'Duplicados dudosos'}).waitFor();
  await page.getByRole('heading',{name:'Información incompleta'}).waitFor();
  const cardDudosos=page.locator('.card').filter({hasText:'Duplicados dudosos'});
  const dudosos=await cardDudosos.textContent();
  assert.equal(await cardDudosos.locator('.duplicate-group .concept-button').count(),2,dudosos);
  assert.ok(dudosos.includes('Gasto QA repetido'),dudosos);
  assert.ok(dudosos.includes('No se fusionan solos'),'debe decir que no se resuelven automáticamente');
  // Dos gastos distintos con el mismo importe el mismo día no son duplicados: la demo tiene
  // dos de $1.250 el 24 de octubre y marcarlos sería ruido.
  assert.ok(!dudosos.includes('Proveedor de materiales'),'un importe compartido no es duplicado');
  // Cada registro del grupo se abre desde la propia revisión.
  await cardDudosos.locator('.concept-button').first().click();
  await page.locator('#modal').waitFor({state:'visible'});
  await page.getByRole('button',{name:'Cerrar diálogo'}).click();
  await page.locator('#modal').waitFor({state:'hidden'});
  assert.ok(await page.getByText('1 por revisar',{exact:true}).count()>0,'la cabecera cuenta los grupos');
  const incompleta=await page.locator('.card').filter({hasText:'Información incompleta'}).textContent();
  assert.ok(/sin comprobante/.test(incompleta),'debe señalar los registros sin comprobante');
  assert.ok(/Todas las aperturas|apertura sin verificar/.test(incompleta));
  // El servicio de la revisión no inventa datos: sigue mostrando la decisión pendiente del disponible.
  assert.ok(await page.getByText('Decisiones pendientes').count()>0);
  // Import preview + commit + repeated upload; also prove CSV markup stays inert.
  await page.locator('.sidebar [data-view=settings]').click();
  const csv='kind,date,concept,amount,currency,account_id,due,source,external_id,category\nsale,2026-10-24,<img src=x onerror=alert(1)>,50,UYU,,,QA,QA-CSV-01,Ventas';
  for(let n=0;n<2;n++){
    await page.getByRole('button',{name:'Importar CSV',exact:true}).click();
    await page.locator('#csv-file').setInputFiles({name:'qa.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
    await page.getByText(n?'0 registros nuevos · 1 ya existentes. Todavía no se guardó nada.':'1 registros nuevos · 0 ya existentes. Todavía no se guardó nada.',{exact:true}).waitFor();
    assert.equal(await page.locator('#import-preview img').count(),0);
    await page.locator('#import-submit').click();await page.locator('#modal').waitFor({state:'hidden'});
  }
  assert.equal((await read()).operations.filter(o=>o.external_id==='QA-CSV-01').length,1);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar CSV',exact:true}).click();
  assert.equal((await download).suggestedFilename(),'landur-operaciones.csv');
  // Mobile viewport, all navigation and account form, no horizontal overflow.
  await page.setViewportSize({width:390,height:844});
  await page.locator('.mobile-nav [data-view=home]').click();
  await page.screenshot({path:'data/qa/mobile.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('.mobile-nav [data-action=menu]').click();
  await page.locator('#modal [data-view=accounts]').click();
  await page.getByRole('button',{name:'Agregar cuenta',exact:true}).click();
  await page.locator('[name=name]').fill('Caja QA móvil');await page.locator('[name=accountKind]').selectOption('cash');
  await page.locator('[name=opening]').fill('0');await page.locator('[name=accessible]').check();
  await page.locator('#operation-form [type=submit]').click();await page.locator('#modal').waitFor({state:'hidden'});
  assert.equal((await read()).accounts.filter(a=>a.name==='Caja QA móvil').length,1);
  await page.getByRole('button',{name:'Agregar cuenta',exact:true}).click();
  assert.equal(await page.locator('#modal').evaluate(e=>e.scrollWidth>e.clientWidth),false);
  await page.screenshot({path:'data/qa/mobile-form.png',fullPage:true});
  await page.getByRole('button',{name:'Cerrar diálogo',exact:true}).click();
  // El panel de dictado no debe desbordar el diálogo en el ancho de un iPhone.
  await page.locator('.mobile-nav [data-action=register]').click();
  await page.locator('.voice-panel').waitFor();
  assert.equal(await page.locator('#modal').evaluate(e=>e.scrollWidth>e.clientWidth),false,'el panel de dictado desborda el diálogo');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.getByRole('button',{name:'Cancelar'}).click();await page.locator('#modal').waitFor({state:'hidden'});
  // Cache contains shell only. Offline reload cannot disclose finances.
  await page.evaluate(async()=>await navigator.serviceWorker.ready);
  await page.reload();await page.getByRole('heading',{name:/Saldos y compromisos|Control financiero del negocio/}).waitFor();
  const cached=await page.evaluate(async()=>{const all=[];for(const name of await caches.keys())for(const request of await(await caches.open(name)).keys())all.push(new URL(request.url).pathname);return all;});
  assert.ok(cached.includes('/'));assert.ok(!cached.some(p=>p.startsWith('/api/')));
  assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
  await context.setOffline(true);await page.reload();await page.locator('#login-form').waitFor();
  assert.equal(await page.getByText('Santander',{exact:true}).count(),0);
  await context.setOffline(false);await page.getByRole('heading',{name:/Saldos y compromisos|Control financiero del negocio/}).waitFor();
  await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await page.getByRole('button',{name:'Explorar demostración'}).waitFor();
  assert.equal(await page.evaluate(async()=>(await fetch('/api/state')).status),401);
  const privateLedger=new Ledger();
  const privateServer=createApp({ledger:privateLedger,password:'synthetic-browser-test-secret',insecureCookies:true});
  privateServer.listen(0,'127.0.0.1');await once(privateServer,'listening');
  const privateContext=await browser.newContext({viewport:{width:390,height:844}});
  try{
    const privatePage=await privateContext.newPage();privatePage.on('pageerror',e=>errors.push(e.message));
    await privatePage.goto(`http://127.0.0.1:${privateServer.address().port}`);
    await privatePage.getByLabel('Contraseña').fill('wrong');await privatePage.locator('#login-form button[type=submit]').click();
    await privatePage.getByText('No se pudo iniciar sesión.',{exact:true}).waitFor();
    await privatePage.getByLabel('Contraseña').fill('synthetic-browser-test-secret');await privatePage.locator('#login-form button[type=submit]').click();
    await privatePage.getByRole('button',{name:'Agregar mi primera cuenta'}).click();
    await privatePage.locator('[name=name]').fill('Cuenta sintética privada');await privatePage.locator('[name=currency]').selectOption('UYU');
    await privatePage.locator('[name=opening]').fill('1000');await privatePage.locator('[name=verified]').check();await privatePage.locator('[name=accessible]').check();
    await privatePage.locator('#operation-form [type=submit]').click();await privatePage.locator('#modal').waitFor({state:'hidden'});
    await privatePage.getByText('Cuenta sintética privada',{exact:true}).waitFor();
    await privatePage.reload();await privatePage.getByText('Cuenta sintética privada',{exact:true}).waitFor();
    await privatePage.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await privatePage.getByLabel('Contraseña').waitFor();
    assert.equal(await privatePage.getByText('Cuenta sintética privada',{exact:true}).count(),0);
  }finally{await privateContext.close();await new Promise(resolve=>privateServer.close(resolve));privateLedger.close();}
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:['dashboard','expense-double-submit','server-persistence','ambiguous-response-retry','partial-payment','csv-preview','csv-repeat','escaped-markup','csv-download','mobile-navigation','account-creation','no-horizontal-overflow','shell-only-cache','offline-lock','logout','private-login','private-empty-state','private-account-persistence','voice-dictation','voice-full-invoice','voice-refuses-unknown-amount','voice-panel-fits-mobile','audited-reversal','evidence-on-create','evidence-from-detail','evidence-not-cached','duplicate-review','incomplete-review'],screenshots:'data/qa/',limitations:['Chromium mobile emulation, not real iPhone/Safari','not a pentest','not deployed to Namecheap']},null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));ledger.close();}
