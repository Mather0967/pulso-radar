// LANDUR · aviso de la planilla. Se pega en Extensiones → Apps Script.
//
//   1. En configurar() reemplazá la URL (tu dominio) y el TOKEN (el mismo valor de LANDUR_SYNC_TOKEN
//      en el servidor) y ejecutala UNA vez. Después borrá el token de acá: queda guardado en las
//      propiedades del script, no a la vista de quien edite la planilla.
//   2. Ejecutá instalar() UNA vez y aceptá los permisos.
//
// Desde ese momento: cada edición, cada fila agregada o borrada y, además, un latido cada 5 minutos
// le avisan a LANDUR, que sincroniza (junta avisos seguidos y nunca corre dos a la vez).

function configurar() {
  PropertiesService.getScriptProperties().setProperties({
    LANDUR_URL: 'https://TU-DOMINIO/landur/api/hooks/sync',
    LANDUR_TOKEN: 'PEGAR_AQUI_EL_TOKEN'
  });
}

function instalar() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  var hoja = SpreadsheetApp.getActive();
  ScriptApp.newTrigger('avisarALandur').forSpreadsheet(hoja).onEdit().create();    // celdas editadas
  ScriptApp.newTrigger('avisarALandur').forSpreadsheet(hoja).onChange().create();  // filas agregadas o borradas
  ScriptApp.newTrigger('avisarALandur').timeBased().everyMinutes(5).create();      // latido de respaldo
}

function avisarALandur() {
  var p = PropertiesService.getScriptProperties();
  var respuesta = UrlFetchApp.fetch(p.getProperty('LANDUR_URL'), {
    method: 'post',
    headers: { Authorization: 'Bearer ' + p.getProperty('LANDUR_TOKEN') },
    muteHttpExceptions: true
  });
  if (respuesta.getResponseCode() >= 400) console.error('LANDUR respondió ' + respuesta.getResponseCode());
}
