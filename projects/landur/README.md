# LANDUR · PWA financiera privada

Proyecto de RIVECT para Rafael «Rafa» Sánchez, separado de la aplicación Pulso aunque comparte este repositorio.

## Acceso elegido: portal RIVECT

**LANDUR aparece junto a Pulso en «Mis proyectos» y usa el mismo login.** Ruta `/landur/`, permisos independientes `viewer`/`editor`, botón de retorno al portal y almacenamiento separado. Ver [PORTAL-RIVECT.md](docs/PORTAL-RIVECT.md) antes de desplegar. El ZIP y la guía de aplicación independiente anteriores no agregan el proyecto al portal.

## Traspaso para instalación asistida

Para compartir con ChatGPT u otro agente con acceso autorizado a cPanel: [INSTALACION-CPANEL-PARA-CHATGPT.md](docs/INSTALACION-CPANEL-PARA-CHATGPT.md). Es autónomo e indica cómo integrar LANDUR al portal existente, preservar Pulso y validar el despliegue sin usar el ZIP standalone.

## Empezar aquí

1. Leer el [contexto autónomo y plan de tres semanas](../../docs/landur/LANDUR-BRIEF-Y-SPRINTS-3-SEMANAS-IA.md).
2. Cumplir las [instrucciones de desarrollo](AGENTS.md).
3. Consultar el [backlog de sprints](docs/BACKLOG.md) y el [registro de decisiones pendientes](docs/DECISIONES.md).
4. Revisar el [modelo inicial propuesto](docs/MODELO-INICIAL.md) antes de implementar persistencia.

## Objetivo

Controlar cuentas, movimientos, ventas/cobros, obligaciones/pagos y disponible estimado desde una PWA privada instalable en iPhone. Evitar duplicaciones y mantener evidencia, origen y auditoría.

## Alcance y secuencia

| Sprint | Objetivo | Entrega prevista |
|---|---|---|
| Semana 1 | Base funcional e integridad financiera | Alfa privada con flujo completo |
| Semana 2 | Pulido y validación con Rafa en iPhone | Candidata al piloto, alcance congelado |
| Semana 3 | Pentesting autorizado, correcciones y retesting | Piloto solo si supera criterios de salida |

Integraciones automáticas, OCR, recetas, márgenes avanzados, push y escritura offline quedan fuera del piloto. No se automatizan repartos con porcentajes no validados.

## Estado real

**Sprint 1 en desarrollo.** Hay un primer backend Node/SQLite con cuentas, movimientos, gastos, obligaciones, pagos parciales, ventas/cobros, comisiones explícitas, transferencias, retiros, auditoría e idempotencia. Incluye sesiones de operador único para desarrollo y demo sintética aislada. Las reglas abiertas siguen pendientes: el disponible devuelve `null`, sin presentar una estimación como saldo confirmado.

**PWA alfa operativa:** Inicio, Movimientos, Cuentas, Egresos, Ventas, Pendientes y Configuración, con formularios conectados al servidor, importación CSV con vista previa, exportación, instalación mediante manifiesto/iconos y service worker de recursos públicos. No se cachea información financiera ni se permite escribir offline.

**Dictado de la factura completa:** una frase llena tipo, concepto, importe, moneda, fecha y vencimiento. El resultado se muestra con la transcripción literal antes de aplicarse y nada se guarda hasta confirmar. Un importe que el reconocimiento no entiende deja el campo como estaba y se avisa: el dictado nunca inventa una cifra. Chrome delega el audio en su proveedor de reconocimiento, así que exige conexión y, en producción, HTTPS.

**Corrección y reversión auditada:** un registro equivocado se corrige revirtiendo y volviendo a registrar. La reversión no borra ni edita la operación original: crea un contra-asiento vinculado, la marca como revertida, restaura el saldo y la saca de los totales vigentes. Se rechaza si algo se apoya en ella sin revertir. El esquema se versiona con `PRAGMA user_version` y se migra en el lugar, sin perder datos.

**Comprobantes adjuntos:** una foto o un PDF se adjunta al registrar o desde el detalle de la operación. El archivo se reduce en el teléfono antes de subir y vive dentro de la misma base privada, así que el respaldo y la restauración lo incluyen. El servidor decide el tipo por los bytes —firma y cierre del archivo—, no por lo que declare el navegador, y acepta JPEG, PNG, WebP y PDF hasta 1.536 KB. Se descargan con `no-store`, solo el espacio dueño los lee, y la reversión los conserva porque son parte de la historia.

**Revisión de pendientes:** además de obligaciones y ventas por cobrar, la vista Pendientes muestra «Duplicados dudosos» e «Información incompleta». Los duplicados se señalan cuando dos registros manuales coinciden en tipo, moneda, importe, fecha, cuenta **y concepto**: compartir solo importe y fecha no alcanza, porque la propia demo tiene dos gastos distintos de $1.250 el mismo día. La app nunca fusiona nada: lista los registros, permite abrir cada uno y deja la decisión al usuario. Los importes y las aperturas no verificados se muestran como faltantes, sin convertirlos en cero.

**Pendientes:** reservas operativas, recuperación de acceso y usuarios definitivos (los aporta el portal RIVECT), conciliación avanzada, informes por período y validación de reglas/datos reales. No se ha desplegado ni probado en Namecheap, en Safari/iPhone real ni se ha hecho pentesting. Es una alfa para pruebas, no está habilitada para datos reales.

### Ejecutar y verificar

Desde `projects/landur/`, con Node >=22.13 y `node:sqlite`:

```bash
npm ci
npm test
npm run test:browser
LANDUR_DEMO=1 npm run check:host
# Solo para HTTP de desarrollo local; datos sintéticos:
LANDUR_DEMO=1 LANDUR_INSECURE_LOCAL=1 npm start
```

El modo privado se niega a arrancar sin contraseña configurada. El servidor escucha en `0.0.0.0:3001` por defecto. No confundir el modo demo con control de acceso para datos reales.

**Destino: Namecheap/cPanel/Passenger.** El usuario confirmó disponibilidad de Node actualizado; el preflight real sigue pendiente. Empezar por [la lista paso a paso para subir a cPanel](docs/SUBIR-A-CPANEL.md). Leer [configuración y verificaciones del hosting](docs/NAMECHEAP.md). Entrada Passenger: `app.cjs`; código, datos y respaldo separados de Pulso. El runtime exacto del servidor todavía debe verificarse.

Los comandos de desarrollo de la raíz pertenecen a Pulso, no a LANDUR. No ejecutarlos como si levantaran esta aplicación.

## Aislamiento

- El código financiero de LANDUR se ubica en `projects/landur/`.
- El contexto y los planes se conservan en `docs/landur/`, sin duplicarlos aquí.
- Por decisión explícita del usuario se reutiliza la identidad del portal, no el almacenamiento financiero de Pulso. Los permisos se asignan por proyecto.
- La integración autorizada modifica el selector/rutas del portal y el listado de código a desplegar; no modifica la lógica ni los datos de Pulso.
- No versionar datos financieros reales, credenciales, extractos, comprobantes privados ni respaldos.

La rama de esta sesión es `arena/eab1cd0e-pulso-radar`. No se creó un repositorio adicional.

## Paquete de despliegue

`npm run package` genera `releases/landur-pwa-cpanel-0.2.0.zip` y su SHA256 desde una lista de archivos permitidos. Requiere Python 3 solamente para armar el paquete. No incluye bases, secretos, sesiones, dependencias instaladas ni capturas. En cPanel: `npm ci --omit=dev`; no hace falta compilar la PWA ni instalar dependencias de navegador.

## Verificación de este corte

- 141 pruebas locales en verde (60 desde la raíz y 81 en LANDUR): núcleo monetario, API privada, configuración, respaldos, CSV atómico, idempotencia, endurecimiento de la importación, parser del dictado, migración de esquema, reversión auditada, comprobantes y límite por sesión. Tres fallan por límites de Windows (enlace simbólico sin Developer Mode, ruta POSIX esperada y `chmod 0600` no aplicable); las tres se reproducen sobre `HEAD` limpio.
- QA de navegador con Chromium: 28 verificaciones en escritorio y viewport 390×844 — registros, doble envío, pérdida de respuesta después de guardar, pago parcial, CSV repetido, exportación, escape de texto, cuentas, persistencia, caché pública, bloqueo offline, logout, login privado, factura dictada con un reconocedor simulado, reversión auditada, comprobantes adjuntos desde el alta y desde el detalle, comprobantes fuera de la caché y revisión de duplicados e información incompleta. `npm run test:portal` agrega 13 verificaciones del montaje dentro del portal.
- Desde la raíz, `npm test` comprueba dos cosas derivadas de los propios archivos: que las dos listas de recursos de LANDUR (servidor autónomo y portal) sirven lo mismo, y que las rutas de API que llama `public/app.js` existen en las dos superficies con los mismos métodos. Existe porque la separación entre ambas ya rompió la aplicación en producción una vez.
- Capturas locales en `data/qa/`, fuera de Git. Dependencias de navegador son solo de desarrollo.
- No se reemplaza prueba en dispositivo real ni pentesting por emulación móvil.

Contrato técnico y plantilla: [API.md](docs/API.md).

## Pruebas de integración con el portal

Desde la raíz, `npm test` ejecuta la regresión de Pulso y el portal. Desde `projects/landur/`, `npm run test:portal` ejecuta la comprobación Chromium con un portal temporal sintético (puerto local 4180 libre). No sustituye el sitio ni la identidad real de Namecheap.

## Vista previa embebida de Arena

La demo sintética admite cookies particionadas HTTPS y una alternativa de sesión en memoria cuando el visor bloquea cookies de terceros. Esta alternativa solo funciona con `LANDUR_DEMO=1`; no autentica usuarios del portal ni del modo privado. El identificador no se guarda en localStorage, sessionStorage, URLs ni caché. Si todas las cookies están bloqueadas, recargar la página puede abrir una demo nueva: no usar datos reales.

Regresión específica: `npm run test:preview` prueba un iframe de otro sitio con todas las cookies suprimidas, incluyendo registros, exportación, logout y reingreso.
