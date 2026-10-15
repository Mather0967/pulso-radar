import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRecord,searchEvidence,makeReport,alertsFor,pilotStatus,validateBackup,reportIsCurrent} from '../src/evidence.mjs';
const source={title:'Agenda contable',body:'Entrevista: conciliación en planillas.',source:'Entrevista autorizada E-01',date:'2026-01-01',companyId:'c1',type:'hecho',reviewed:true,sector:'Contable'};
const company={id:'c1',name:'Estudio de prueba'};
const evidence=[{...validateRecord(source),id:'e1'}];
const cases=[{...validateRecord({...source,title:'Caso documentado',source:'https://example.org/caso',conditions:'Otra escala; verificar alcance.'},'case'),id:'case1'}];
const analysis={problem:'Tiempo de conciliación documentado.',similarities:'Misma tarea.',differences:'Otra escala.',hypothesis:'Probar importación.',alternatives:'Planilla revisada.',missing:'Medir frecuencia.',next:'Matheus prepara prueba.',caseIds:['case1']};
const context={company,evidence,cases,analysis};
test('exige origen, fecha real y referencia de empresa; casos necesitan URL y condiciones',()=>{
 for(const override of [{source:''},{date:'2026-02-30'},{date:'2099-01-01'},{companyId:''}])assert.throws(()=>validateRecord({...source,...override}));
 assert.throws(()=>validateRecord({...source,source:'javascript:alert(1)',conditions:'X'},'case'));
 assert.throws(()=>validateRecord({...source,source:'https://example.org',conditions:''},'case'));
 assert.equal(validateRecord(source).body,source.body);
});
test('busca evidencia acentuada sin inventar resultados',()=>{
 assert.equal(searchEvidence(evidence,'qué tenemos sobre conciliacion').length,1);
 assert.equal(searchEvidence(evidence,'stock').length,0);
});
test('informe expresa faltantes, evita equivalencia y conserva copia independiente',()=>{
 const report=makeReport(context,new Date('2026-01-02'));
 assert.equal(report.ready,true);assert.equal(report.cases[0].conditions,cases[0].conditions);
 const original=evidence[0].body;evidence[0].body='Cambio';assert.equal(report.facts[0].body,original);evidence[0].body=original;
 const incomplete=makeReport({...context,analysis:{},evidence:[]},new Date('2026-01-02'));
 assert.equal(incomplete.ready,false);assert.match(incomplete.missing.join(' '),/hechos locales/);assert.match(incomplete.missing.join(' '),/casos internacionales/);
});
test('alertas justifican revisión y fuentes vencidas, sin puntuaciones',()=>{
 const alerts=alertsFor([{...evidence[0],reviewed:false}],new Date('2026-05-01'));
 assert.equal(alerts.length,2);assert.match(alerts[1].reason,/vigencia/);assert.equal('score' in alerts[0],false);
});
test('un informe anterior no cierra el piloto después de modificar la evidencia',()=>{
 const today=new Date().toISOString().slice(0,10);
 const fresh={...context,evidence:evidence.map(e=>({...e,date:today})),cases:cases.map(e=>({...e,date:today}))};
 const report=makeReport(fresh);assert.equal(reportIsCurrent(report,fresh),true);
 assert.equal(reportIsCurrent(report,{...fresh,analysis:{...analysis,next:'Otra prueba'}}),false);
});
test('cierre exige ahorro positivo, método y validación; cero o pérdida no aprueban',()=>{
 const pilot={reference:'Piloto real E-01',before:'30',after:'15',measurement:'Misma tarea, fecha y condiciones',validated:true};
 assert.equal(pilotStatus(pilot,{ready:true}).closed,true);
 for(const change of [{after:'30'},{before:''},{measurement:''},{validated:false},{after:'-1'}])assert.equal(pilotStatus({...pilot,...change},{ready:true}).closed,false);
 assert.equal(pilotStatus(pilot,{ready:false}).closed,false);
});
test('respaldo valida estructura y rechaza informes y análisis dañados',()=>{
 const backup={version:1,companies:[company],evidence,cases,analyses:{c1:analysis},pilots:{},reports:[makeReport(context)]};
 assert.equal(validateBackup(backup),backup);
 assert.throws(()=>validateBackup({...backup,analyses:{c1:{caseIds:'invalid'}}}));
 assert.throws(()=>validateBackup({...backup,reports:[{}]}));
 const draft=makeReport({...context,analysis:{}});assert.doesNotThrow(()=>validateBackup({...backup,reports:[draft]}));
});
