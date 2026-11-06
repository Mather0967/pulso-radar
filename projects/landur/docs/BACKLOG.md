# Backlog de ejecución — LANDUR

Las casillas indican evidencia real, no intención. Prioridades: P0 seguridad/integridad; P1 operación diaria; P2 mejoras prescindibles. Hay un primer corte de backend probado; ninguna puerta de sprint se da por aprobada.

## Preparación realizada

- [x] Ubicación aislada en `projects/landur/`, sin reemplazar Pulso.
- [x] Brief y plan disponibles en `docs/landur/`.
- [x] Instrucciones para agentes y registro de decisiones pendientes.
- [x] Modelo inicial documentado y parcialmente implementado; validación del cliente pendiente.

## Sprint 1 — Base funcional

- [ ] Día 1 · P0: validar decisiones mínimas D01–D03, D06–D09; registrar muestras y resultados esperados.
- [ ] Día 1 · P0: validar esquema/estados y elegir arquitectura; definir autenticación, permisos y respaldo.
- [ ] Día 2 · P0: cuentas, saldos, movimientos, persistencia y sesión privada; comprobar autorización y recarga.
- [ ] Día 3 · P0: gastos, obligaciones, pagos parciales, transferencias y retiros; pruebas de atomicidad.
- [ ] Día 4 · P0: ventas/cobros y conciliación sin duplicar ingresos; CSV con vista previa y deduplicación.
- [ ] Día 4 · P1: Inicio con saldos y compromisos; disponible solo con reglas/cobertura suficientes.
- [ ] Día 5 · P0: probar el recorrido completo, reimportación, doble envío y precisión monetaria.
- [ ] Día 5 · P1: instalación PWA en entorno de pruebas y demo con Rafa; registrar ajustes.

**Puerta:** alfa privada persistente, sin duplicación, con origen/auditoría y controles básicos de acceso. La demo no implica aceptación del piloto.

## Sprint 2 — Pulido

- [ ] Día 6 · P1: incorporar observaciones y explicar cifras/estados del Inicio.
- [ ] Día 7 · P1: captura rápida, errores claros y comprobantes opcionales privados.
- [ ] Día 8 · P0: correcciones auditadas, pagos parciales y conciliación; validar devoluciones sin inferir pago.
- [ ] Día 8 · P1: filtros y exportación CSV segura.
- [ ] Día 9 · P0: probar red interrumpida, doble toque, suspensión, actualización y ausencia de datos sensibles en caché.
- [ ] Día 9 · P1: Safari e instalación en iPhone real, teclado, cámara, archivos y accesibilidad.
- [ ] Día 10 · P0: validar casos disponibles con Rafa y restaurar respaldo.
- [ ] Día 10 · P0: congelar alcance; aprobar inventario y autorización de pentesting.

**Puerta:** candidata sin bloqueos del flujo principal, restauración probada y evidencia de validación móvil.

## Sprint 3 — Pentesting y correcciones

- [ ] Día 11 · P0: revisar amenazas, configuración, dependencias y entorno autorizado.
- [ ] Día 12 · P0: probar sesiones, autorización, API, cargas, importaciones y exportaciones.
- [ ] Día 13 · P0: probar manipulación financiera, concurrencia, idempotencia, logout y caché; corregir hallazgos.
- [ ] Día 14 · P0: completar correcciones, retest de hallazgos y regresión financiera/móvil.
- [ ] Día 15 · P0: informe, restauración/rollback y decisión de habilitación con Rafa.

**Puerta:** sin hallazgos críticos/altos abiertos, sin duplicación/pérdida/acceso indebido, pruebas aprobadas. Si falla, no habilitar con datos reales.

## Fuera del piloto

Conectores automáticos, OCR/correo, recetas, recálculo de márgenes, repartos automáticos no validados, informes avanzados, XLSX, push y escritura offline. No convertir esta lista en tareas activas sin aprobación de alcance.

## Evidencia por tarea

Al marcar una tarea: agregar fecha, requisito/caso cubierto, referencia a archivos/pruebas, resultado y limitaciones. No se acreditan pruebas reales de integración o iPhone mediante mocks o emulación.

## Evidencia de avance — 24/10/2026

- Implementados en `server/ledger.mjs`: cuentas y corte de saldo inicial, movimientos, obligaciones/pagos parciales, ventas/cobros con comisión real explícita, transferencias y retiros; transacciones SQLite, aislamiento por espacio, claves idempotentes, referencias externas y auditoría.
- Implementados en `server/app.mjs`: API privada con sesión, logout/caducidad, control de origen, JSON acotado y límites de login; demo sintética separada por visitante. Autenticación definitiva y recuperación siguen pendientes.
- Preparación Namecheap: `app.cjs`, validación de configuración, preflight y copia consistente; documentación en `docs/NAMECHEAP.md`. Sin publicación remota.
- `npm test` en `projects/landur/`: 29 pruebas locales aprobadas del núcleo, HTTP, configuración del hosting, preflight y script de respaldo. Casos sintéticos, no muestras del cliente. Verificar el resultado actualizado en cada cambio.
- No se marcan días completos: faltan validación de reglas/datos, interfaz PWA, importación, pruebas reales en cPanel/iPhone y controles restantes del plan.
- El disponible permanece pendiente (`null`). No se implementó reparto 25/30 %, OCR ni ninguna integración fuera de alcance.

## PWA alfa 0.2.0 — avance del sprint 1

- [x] Interfaz móvil/escritorio de las seis vistas prioritarias y configuración mínima, sin tocar Pulso.
- [x] Formularios conectados a API: cuentas, gastos sin factura, obligaciones/pagos parciales, ventas/cobros con comisión explícita, transferencias y retiros.
- [x] Manifiesto, iconos, instrucciones iPhone y service worker; solo caché de interfaz pública. Offline bloqueado.
- [x] Reintento con la misma clave tras perder la respuesta de un guardado; controles de doble envío.
- [x] CSV propuesto: vista previa sin persistencia, lote atómico, referencias estables, reimportación sin duplicación, conflictos explícitos; exportación con protección contra fórmulas.
- [x] Guía de cPanel y empaquetado por lista permitida, sin datos ni secretos.
- [x] 36 pruebas automatizadas locales aprobadas; QA Chromium escritorio/móvil con 18 verificaciones de flujo reportadas por `scripts/qa-browser.mjs`.
- [ ] Muestras originales de Sheets y aceptación de la plantilla con Rafa/contador.
- [ ] Preflight y pruebas reales en Namecheap/Passenger.
- [ ] Safari/iPhone físico: instalación, teclado, cámara (cuando se habiliten adjuntos) y reanudación.
- [ ] Pendientes del MVP: evidencia adjunta privada, reservas, revisión/corrección/reversión, autenticación definitiva y reglas sin validar.

**No se declara terminado el sprint 1 ni el proyecto.** La interfaz es utilizable para pruebas, pero no sustituye la validación de negocio ni el pentesting. No hay integración bancaria activa, no se fija reinversión y el disponible sigue bloqueado.

## Integración de acceso solicitada por el usuario

- [x] Catálogo `/portal`: tarjetas Pulso/LANDUR según permisos.
- [x] Misma sesión RIVECT, CSRF y auditoría con usuario real; sin segunda contraseña.
- [x] Permisos independientes y administración de grants sin borrar accesos anteriores.
- [x] LANDUR en `/landur/`, manifiesto/service worker limitados al subdirectorio; retorno al portal.
- [x] Actualización del despliegue controlado para incluir código LANDUR y conservar bases/identidad/landing.
- [x] 58 pruebas de Pulso/portal y 36 de LANDUR aprobadas; 13 verificaciones de integración Chromium y 18 del modo independiente. Fixtures locales sintéticos, no hosting real.
- [ ] Publicación en Namecheap y validación de los archivos reales del portal, no disponibles en el checkout.
- [ ] Procedimiento de respaldo/restauración del conjunto identidad + SQLite en modo portal.

La actualización del acceso fue autorizada expresamente; no se considera terminada la validación de seguridad del sprint 3 ni el piloto financiero.

## Corrección de vista previa Arena (puerto 3001)

- [x] Demo embebida independiente de cookies de terceros: cookie HTTPS particionada y sesión alternativa solo en memoria para datos sintéticos.
- [x] Modo privado conserva cookie HttpOnly/Secure/SameSite=Strict y rechaza la credencial de demo por encabezado. Portal RIVECT sin cambios.
- [x] Regresión en iframe con todas las cookies eliminadas: entrada, registro, exportación, logout y reingreso.
- [x] 39 pruebas de LANDUR aprobadas tras agregar aislamiento, revocación y rechazo de encabezados demo en modo privado.

Sin ampliación funcional ni cambios de fórmulas. No se infiere que esto valide todos los navegadores de los usuarios ni el hosting real.

## Pulido de interfaz — sistema tipográfico, contraste y copy operativo

- [x] Capa de diseño integrada al final de `public/styles.css`: tokens de color, escala legible, serif del sistema para titulares y cifras con `tabular-nums`. Se integró en ese archivo porque `server/app.mjs` sirve los recursos desde un mapa fijo de assets; un archivo nuevo no se servía. Sin cambios de backend.
- [x] Contraste medido sobre el render real en Chromium, no estimado: mínimo **5,32:1** en 17 pares de texto. `.stat-note` pasó de 9px y 3,3:1 a 12px y 6,0:1; `.concept-sub` de 9px y 2,9:1 a 12px y 6,0:1.
- [x] Escala mínima: 12px para texto funcional (notas, botones, avisos, tabla); 11px solo en micro-etiquetas en mayúsculas.
- [x] Copy operativo en las seis vistas, pantalla de acceso, estado vacío, aviso de instalación y barra lateral; se retiraron los eslóganes de landing.
- [x] Título de la aplicación y color de fondo del manifiesto alineados al papel nuevo.
- [x] Expectativas de prueba y selectores de QA actualizados en 9 puntos, al dejar de compartir acceso e inicio el mismo titular.
- [x] Pruebas ejecutadas: 39. Resultado: **35 aprobadas y 4 fallas previas de entorno Windows** (enlaces simbólicos, preflight y respaldo con `PORT`), reproducidas idénticamente sobre `HEAD` limpio y sin relación con este cambio.
- [x] QA de navegador con el Chrome del sistema: 18 verificaciones aprobadas (panel, doble envío, persistencia en servidor, reintento idempotente, pago parcial, vista previa/reimportación de CSV, marcado escapado, descarga, navegación móvil, alta de cuenta, sin desborde horizontal, caché solo de interfaz, bloqueo offline, logout y flujo privado). Capturas en `data/qa/`, ignoradas por Git.
- [ ] Revisión visual humana y ajuste de escala si hace falta.
- [ ] Validación en iPhone/Safari real y en modo instalado.

No se tocó el backend ni las reglas financieras. No se declara terminado el sprint 2: faltan la revisión visual del usuario, la prueba en iPhone físico y el pentesting del sprint 3.
## Endurecimiento del backend y dictado por voz

- [x] Límite de acceso por cliente: se indexaba por la IP del socket, que detrás de Passenger o Apache es el proxy, así que ocho intentos fallidos bloqueaban a todos. La clave ahora es por cliente, lee X-Forwarded-For solo con confianza explícita (LANDUR_TRUST_PROXY=1) y la ventana global ya no convierte una tabla llena en bloqueo general.
- [x] scrypt asíncrono: un intento de acceso ya no detiene el event loop ni las lecturas financieras de otros usuarios.
- [x] Validación de Host: sin LANDUR_PUBLIC_ORIGIN solo se acepta loopback o LANDUR_ALLOWED_HOSTS. Un Host inyectado ya no supera el chequeo de origen.
- [x] Purgado de espacios demo sin sesión viva, respetando el orden de claves foráneas y sin tocar el espacio privado.
- [x] Formato decimal de importes negativos en la exportación CSV y en el cliente.
- [x] Dictado por voz en concepto, categoría y nombre de cuenta; importes y fechas siguen a mano. Permissions-Policy habilita el micrófono solo para este origen y el diálogo lo detiene al cerrarse.
- [x] Pruebas: 45 en total y 41 aprobadas. Se agregaron 6: límite por cliente, anti-suplantación de X-Forwarded-For, Host falsificado mediante socket crudo, purgado demo, cabecera de permisos y decimal negativo. Las 4 restantes son las fallas de entorno Windows ya conocidas.
- [x] QA de navegador con el Chrome del sistema: 19 verificaciones en verde, incluida la dictación, que se verifica en reposo porque no se simula voz.
- [ ] El dictado se validó en el camino de error (permiso denegado), no con voz real.
- [x] El límite por IP real **ya no requiere configurar nada**: cuando el par del socket es del propio host se lee `X-Forwarded-For`. Resuelto en la sección siguiente.

Sin cambios de reglas financieras, importes, cálculos ni aislamiento por espacio. No se declara completado el pentesting del sprint 3.

## Proxy por defecto, ataque a la importación y factura dictada

- [x] El límite de acceso detrás de Passenger/Apache dejó de depender de una variable de entorno. Si el par del socket es del propio host (`127.0.0.1`, `::1`, `::ffff:127.0.0.1`) se lee `X-Forwarded-For` y se toma el último salto, que es el que agrega el proxy inmediato. Un cliente directo nunca llega desde loopback, así que no puede falsear su IP. `LANDUR_TRUST_PROXY=1` queda solo como excepción para un proxy que no sea local.
- [x] La derivación de la clave de cliente es una función pura exportada (`clientAddress`) y se prueba con 8 casos, incluidos un par público y uno de red privada, que no se confían.
- [x] Ataque autorizado a la importación CSV convertido en regresión permanente: 12 casos con payloads reales (comillas desbalanceadas, columnas de más y de menos, 201 filas, encabezado cambiado, importes `1e3`/`-5`/`0`/`12.345`/`1.234,56`, lote con una fila inválida, referencia repetida con otros datos, fórmula de hoja de cálculo, NUL, sin sesión, origen cruzado, sin encabezado propio y `kind=import` por `/api/commands`). **No se encontró escritura parcial ni evasión**: el lote es atómico, la vista previa no persiste y la exportación neutraliza la fórmula.
- [x] El único fallo del ataque fue del propio ataque: la fila marcada «columnas de más» tenía 10 columnas y `extra` caía en `category`, que es válida. Se corrigió el payload, no el servidor.
- [x] Aislamiento de las pruebas de hosting: el `PORT` del shell de desarrollo se filtraba al preflight y al respaldo, que fallaban por un puerto inválido. La fixture ahora fija `PORT` y esa falla salió de la línea base.
- [x] Dictado de la factura completa: una frase llena tipo, concepto, importe, moneda, fecha y vencimiento. El parser es una función pura (`public/voice.mjs`) que no toca el DOM; entiende cifras con palabras (`mil doscientos`), separador de miles es-UY, fechas relativas, largas y cortas, y monedas habladas.
- [x] Garantía explícita: **el dictado no completa ningún campo que no haya entendido y no guarda nada por sí solo**. Se muestra la transcripción literal, se aplica solo al confirmar y un importe no reconocido deja el campo como estaba, con aviso.
- [x] Los acentos se conservan: el texto se pliega sin cambiar la longitud, así el concepto se recorta del original. Regresión cubierta: `"Ñ"` se plegaba a `"N"`.
- [x] Regresión cubierta: `"12.500"` sin contexto se leía como `12` y guardaba 12,00.
- [x] Pruebas: 71 en total y 68 aprobadas. Se agregaron 26: 13 del parser de voz, 12 del ataque a la importación y la derivación de cliente. Las 3 restantes son las fallas de entorno Windows ya conocidas (enlace simbólico sin Developer Mode, ruta POSIX esperada y `chmod 0600` no aplicable).
- [x] QA de navegador con el Chrome del sistema: 22 verificaciones en verde. Se agregaron tres: factura completa dictada de punta a punta con un reconocedor simulado, negativa a pisar un importe no reconocido y ajuste del panel al ancho de iPhone.
- [ ] El reconocimiento de voz real no se probó: el QA simula la transcripción, no el servicio. Chrome delega el audio en su proveedor.
- [ ] El tope global de accesos (60/min) protege el costo de scrypt, pero un ataque sostenido puede demorar el acceso del titular. Es una denegación de servicio, no una fuga, y no se resuelve sin un bypass fuera de banda (lista de IPs o segundo factor).
- [ ] La importación no tiene límite propio: cada vista previa toma un bloqueo de escritura y hace hasta 200 inserciones que después revierte. Un cliente con sesión válida podría amplificarlo. Umbral sugerido antes de publicar: 30 llamadas por minuto por sesión.

Sin cambios de reglas financieras, importes ni aislamiento por espacio. No se declara completado el pentesting del sprint 3.

## Corrección auditada y esquema versionado

- [x] **Fallo propio que rompía producción, corregido y publicado primero.** El montaje del portal (`namecheap/server/landur.mjs`) mantiene su propia lista de recursos, separada de la del servidor autónomo. Al agregar `voice.mjs` solo a una de las dos, la importación de `app.js` respondía 404 en `/landur/` y la aplicación entera quedaba en pantalla en blanco: un módulo que no carga detiene todo el archivo. Se agregó a la lista del portal.
- [x] Regresión para que no vuelva a pasar: `tests/landur-assets.test.mjs` deriva los recursos necesarios de los propios artefactos (`index.html`, los `import` de `app.js` y la lista `SHELL` del service worker) y exige que **las dos** superficies los sirvan. Verificado quitando la línea a propósito: falla nombrando `/landur/voice.mjs`.
- [x] Esquema versionado con `PRAGMA user_version`: pasos ordenados, cada uno dentro de una transacción, aplicados una sola vez. La versión 1 es el esquema original, así que una base ya existente se migró en el lugar sin perder datos (probado con una base creada a mano con el esquema anterior).
- [x] Reversión auditada. No borra ni edita: registra un contra-asiento vinculado por `related_id`, invierte los movimientos de cuenta, marca el original con `reversed_by`/`reversed_at` y lo deja visible y consultable.
- [x] Dependencias respetadas, sin inventar reglas: una deuda o venta con cobros/pagos aplicados exige revertir esos cobros/pagos primero; una operación con dependientes vivos se rechaza; la comisión de un cobro se revierte junto con él, porque nació de esa misma operación; una reversión no se revierte.
- [x] Los totales distinguen lo revertido: el contra-asiento cancela el saldo, pero la operación revertida deja de contar como gasto, venta o deuda vigente, y su aplicación revertida deja de reducir el pendiente de destino. Sin esto, revertir habría duplicado importes.
- [x] La interfaz muestra el estado «Revertido», tacha el importe y ofrece revertir con una confirmación que explica que se registra un contra-asiento en lugar de borrar.
- [x] Pruebas: 79 en total y 76 aprobadas. Se agregaron 8: migración de una base anterior, revertir gasto, doble reversión, deuda con pagos aplicados, cobro con comisión, transferencia, venta sin cobros y la reversión por HTTP con reintento idempotente.
- [x] QA de navegador: 23 verificaciones, con la reversión de punta a punta incluida. QA del portal: 13 verificaciones en verde.
- [ ] El pentesting del sprint 3 sigue sin completarse y sin verificación por una persona distinta de quien implementó. Un escaneo propio no lo reemplaza.

Sin cambios de reglas financieras, importes ni aislamiento por espacio. No se declara completado el pentesting del sprint 3.

## Comprobantes, revisión de pendientes y límite de operaciones caras

- [x] **Comprobantes adjuntos privados.** Se adjuntan al registrar o desde el detalle de la operación. El archivo vive dentro de la misma base SQLite privada, así que el respaldo y la restauración ya probados lo incluyen sin crear un directorio nuevo ni pedir permisos adicionales en el hosting. El cliente reduce la foto en el teléfono (máximo 1600 px, JPEG) antes de subirla, porque una foto de iPhone pesa varios megabytes y el servidor acepta 1.536 KB.
- [x] **El tipo lo deciden los bytes, no la etiqueta.** JPEG, PNG, WebP y PDF se validan por firma **y por estructura**: cierre de imagen, chunk final o marcador de cierre. Un HTML con extensión de imagen no pasa, y un archivo firmado pero truncado tampoco — se descubrió porque el PNG de prueba, copiado de memoria y por eso truncado, era rechazado por el navegador al recortarlo.
- [x] **Se sirven con la sesión y sin caché:** `Content-Type` del archivo guardado, `inline` para imágenes y `attachment` para PDF, `Cache-Control: no-store`, y lectura solo desde el espacio dueño (404 para el resto). El nombre se guarda como etiqueta sin separadores de ruta.
- [x] **La reversión conserva los comprobantes:** son parte de la historia y no se borran con la operación.
- [x] **Límite de operaciones caras, 30 por minuto y por sesión**, compartido por la importación y los adjuntos. Antes la importación no tenía límite propio y un cliente con sesión válida podía amplificarlo; el tope es por sesión, así que un ataque sobre una no bloquea a las demás. Implementado en `server/limits.mjs` y usado por las dos superficies.
- [x] **«Duplicados dudosos» en Pendientes.** Señala registros manuales que coinciden en tipo, moneda, importe, fecha, cuenta **y concepto**. La primera versión se quedó con importe + fecha y marcó como duplicados dos gastos legítimos distintos de $1.250 de la propia demo; el caso falso quedó cubierto como regresión. La app lista los registros, permite abrir cada uno y **nunca fusiona**: la revisión es del usuario.
- [x] **«Información incompleta» en Pendientes:** obligaciones vencidas, cuentas con apertura sin verificar y registros sin comprobante. Lo ausente se informa como faltante y no se convierte en cero.
- [x] **Paridad de superficies.** La prueba que ya existía para los recursos estática ahora también compara las rutas de API: las rutas que llama `public/app.js` deben existir en el servidor autónomo y en el montaje del portal, con los mismos métodos. Existe porque una superficie atrasada ya dejó LANDUR en pantalla en blanco en producción.
- [x] **Pruebas:** 141 en verde (60 raíz + 81 LANDUR). Se agregaron 10: adjuntar y leer por espacio, rechazo por bytes y por archivo incompleto, nombre con ruta, comprobantes en la reversión, adjuntar/descargar por HTTP, límite de importación con otra sesión libre, la tabla nueva en la migración de esquema, la paridad de rutas y el caso falso del detector de duplicados. Las 3 restantes son las fallas de entorno Windows de la línea base.
- [x] **QA de navegador:** 28 verificaciones, con comprobantes desde el alta y desde el detalle (miniatura que carga desde la API privada, descarga con `no-store`, adjunto fuera de la caché del service worker) y revisión de duplicados e información incompleta. QA del portal: 13 en verde.

**Lo que sigue sin resolverse es lo mismo que antes, y ninguna de estas piezas lo reemplaza:** los comprobantes se validan como archivo, no como contenido; el detector de duplicados sugiere, no decide; y el pentesting del sprint 3, la prueba en iPhone real y el preflight de cPanel siguen sin completarse. El tope de accesos por sesión sigue siendo un riesgo de disponibilidad conocido.

## Baja de lo que se cargó mal

- [x] **Quitar comprobante** (`evidence.remove`): se elimina el archivo desde el detalle de la operación, sin tocar importes ni la operación. Queda auditado con autor y fecha; responde 404 si no existe o si es de otro espacio (también si ya se borró); reutilizar la misma clave idempotente devuelve la respuesta original. **La reversión no lo restaura.**
- [x] **Eliminar una cuenta** (`account.delete`): sin movimientos se borra y la auditoría conserva nombre, moneda y saldo inicial. Si tiene entradas, el usuario decide (29/10/2026): pasarlas a otra cuenta, crear una cuenta nueva con esa información, o eliminarlas junto con la cuenta. Sin esa elección el servidor responde 409 y nada cambia.
- [x] **La interfaz pregunta antes de pedir el clic.** Una cuenta con historial abre un diálogo con tres opciones explicadas —pasar todo a otra cuenta, crear una cuenta nueva con esta información, o eliminar también sus movimientos— y muestra cuántos movimientos y qué saldo están en juego. Todas las bajas pasan por un diálogo de confirmación con la misma clave idempotente que el resto de los comandos, y se reintentan sin duplicar.
- [x] **El botón de anulación se llama como el usuario la busca:** «Eliminar…» y «Eliminar registro» en lugar de «Revertir…» y «Registrar reversión». El diálogo dice sin rodeos que la operación original **no se borra**: queda marcada y consultable, y si se cargó mal se vuelve a registrar bien después.
- [x] **Una operación financiera no se borra suelta.** No hay ningún camino que elimine `operations`, `entries`, `applications` o `obligations` por sí mismos: solo desaparecen con su cuenta cuando el usuario elige `mode:'purge'`, y antes de eso la auditoría guarda una copia completa de lo eliminado. Todo lo demás sigue corrigiéndose con reversión.
- [x] **Pruebas:** 144 en verde (60 raíz + 84 LANDUR). Se agregaron 3: baja de cuenta vacía con auditoría y rechazo de la que tiene historial, baja de comprobante con idempotencia y aislamiento por espacio, y su equivalente por HTTP con rechazo de identificadores inventados y de rutas armadas por el cliente. Las 3 restantes son las fallas de entorno Windows de la línea base.
- [x] **QA de navegador:** 31 verificaciones, con la baja de un comprobante, la eliminación de una cuenta vacía y el rechazo explicado de una cuenta con movimientos. QA del portal: 13 en verde.

**Lo que no resuelve esta pieza:** el borrado con movimientos no se puede deshacer desde la interfaz (la copia queda en la auditoría, no en un botón de restaurar) y los archivos de los comprobantes eliminados no se conservan. El pentesting del sprint 3 y la prueba en iPhone real siguen pendientes.

## Logotipo de LANDUR y reparación del contrato de baja de cuentas — 28/10/2026

- [x] **Logotipo de LANDUR (pedido del usuario).** La imagen de referencia `../../docs/landur/images.jfif` (fondo morado `#222244`, logotipo «landur®» en crema `#F4F0E6`) quedó convertida en SVG vectorial y colocada en `public/icon.svg`, que es a la vez favicon, recurso del manifiesto y parte de la caché del service worker (`SHELL`). En el selector del portal, la ficha de LANDUR muestra el logotipo (`namecheap/public/landur-brand.svg`, clase `landur-logo`) en lugar de la letra «L». Se agregó la ruta al servidor (`namecheap/server/main.mjs`) y a `managedPaths` de `scripts/cpanel-deploy.mjs`, porque un asset nuevo que no entra en esas dos listas no llega a producción. El logotipo de RIVECT (`projects-brand.svg`) se dejó como estaba: no era parte del pedido.
- [x] **`account.delete` vuelto al contrato documentado y autorizado.** El commit anterior eliminaba las operaciones de la cuenta con `deleteOperations`, devolvía `removedOperations`/`removedEvidence` y el cliente mostraba un `confirm` que prometía borrar movimientos, contra-asientos y comisiones: eso contradice `DECISIONES.md` (27/10: solo `evidence.remove` y `account.delete` de cuenta vacía, «no se autoriza borrar operaciones»), `docs/API.md`, `README.md` y las dos pruebas que esperaban 409. Se restauró la guarda: cuenta con entradas → 409 sin cambios; cuenta vacía → auditoría `account.deleted` y `{id}`. Se quitó el manejador duplicado y obsoleto de `public/app.js`; queda `accountDeleteDialog`, que explica por qué no puede eliminarla.
- [x] **Pruebas ejecutadas:** raíz `npm test` → 60/60; `projects/landur` `npm test` → 87/87 (antes 85/87, con las dos de baja de cuentas en rojo).
- [ ] No se ejecutó el QA de navegador (`npm run test:browser`, `test:portal`) ni se verificó el logotipo renderizado en un navegador real.
- [ ] Siguen sin resolverse los bloqueos de negocio: política del disponible, reinversión 25 % vs 30 %, muestras reales, despliegue en Namecheap, iPhone real y pentesting. El modo privado sigue requiriendo `LANDUR_PASSWORD` y no siembra datos de demostración.

## Rediseño visual móvil — Etapa A (30/10/2026)

- Hecho: `public/styles.css` reescrito como una sola hoja con tokens (claro y oscuro según el iPhone), piezas comunes y bloque de pantallas heredadas. Pasó de 69 KB a 33 KB. Se corrigió un desborde horizontal en Actividad y el filtro de tipo que se veía en blanco.
- Evidencia: sin desborde horizontal a 375 px en Inicio, Actividad, Cuentas, Egresos, Ventas, Pendientes y Configuración (medido en navegador); capturas revisadas en móvil oscuro, Inicio y Actividad en claro y Inicio a 1280 px. `npm test` en `projects/landur/`: solo fallan las 3 pruebas ya documentadas de Windows (enlace simbólico, ruta POSIX y `chmod`).
- No probado: iPhone real, instalación como PWA, dictado real, claro en Cuentas/Configuración/detalle. Etapas B–F (Actividad, Pendientes, Cuentas y detalle, Configuración y acceso, revisión final) pendientes. Sin cambios de lógica financiera ni de backend.

## Rediseño visual móvil — Etapa B: Actividad (30/10/2026)

- Hecho: Movimientos, Egresos y Ventas son una sola pantalla, «Actividad», con filtros Todo / Gastos / Ventas / Otros; lista agrupada por día con signo, categoría y cuenta; estado solo si no está resuelto; búsqueda en un icono; importar y exportar CSV en un menú. Los accesos de «Más» a Egresos y Ventas abren el mismo filtro. Sin cambios de lógica financiera ni de backend.
- Evidencia (navegador): filtros devuelven 11 gastos, 4 ventas/cobros y 3 de otros tipos sobre 18; la búsqueda filtra; el menú abre la importación; sin desborde horizontal a 375 px; capturas en móvil oscuro y claro y en 1280 px.
- No probado: iPhone real, exportación de archivo, importación completa, detalle de operación (sigue como diálogo; pasa a hoja en la etapa D).

## Rediseño visual móvil — Etapa C: Pendientes (30/10/2026)

- Hecho: Pendientes es una sola lista agrupada: dos totales (por pagar, por cobrar) y los grupos Vencidas, Próximas, Por cobrar y Para revisar (duplicados, cuentas sin verificar, registros sin comprobante). Los grupos vacíos no aparecen; cada fila trae su acción (Pagar o Cobrar) y abre el flujo en pasos. Las decisiones abiertas y los duplicados se leen en hojas, con el mismo texto de antes. Sin cambios de lógica financiera ni de backend.
- Evidencia (navegador, datos sintéticos): con una obligación vencida, una próxima, una venta por cobrar y un par duplicado aparecen los cuatro grupos; «Pagar» abre el registro de pago con la obligación y pregunta la cuenta; la fila abre el detalle; las hojas de reglas y de duplicados abren; sin desborde horizontal a 375 px; revisado en móvil claro y oscuro.
- No probado: iPhone real, escritorio ancho de esta pantalla, estado sin ningún pendiente.

## Rediseño visual móvil — Etapa D: Cuentas y detalle (30/10/2026)

- Hecho: Cuentas muestra el total registrado y una fila por cuenta; tocarla abre una hoja con saldo, apertura (verificada o no), fondos, «Datos técnicos» plegados y, dentro, «Ver movimientos» y «Eliminar cuenta». «+ Agregar» abre la creación de cuenta en pasos. El detalle de una operación pasó a la misma estructura: importe grande, estado, solo los datos que existen, movimientos de cuenta, operaciones vinculadas, comprobantes y acciones al pie; origen, referencia externa e identificador quedan en «Datos técnicos». «Ver movimientos» usa la lista agrupada de Actividad. Sin cambios de lógica financiera ni de backend.
- Evidencia (navegador, datos sintéticos): recorrido de las siete pantallas y de todas las hojas sin errores de JavaScript; la hoja de cuenta lista 13 movimientos de Santander; «Eliminar cuenta» abre su diálogo con opciones; el detalle de una obligación ofrece registrar pago, eliminar y adjuntar; sin desborde horizontal a 375 px. Durante la etapa se perdieron por error cuatro definiciones de Actividad; se detectó con la consola del navegador y se restauraron.
- No probado: iPhone real, claro en estas pantallas, escritorio ancho, eliminar una cuenta hasta el final, adjuntar un comprobante desde el detalle.

## Rediseño visual móvil — Etapa E: Configuración y acceso (30/10/2026)

- Hecho: Configuración es una lista de ajustes en tres grupos (Datos: importar y exportar CSV; App: instalar en el iPhone y cerrar sesión; Información: alcance del servicio y registro de actividad). Los textos largos pasaron a hojas con el mismo contenido de antes. El acceso comparte tipografía y colores con la app y su cabecera de marca es compacta en móvil. Sin cambios de lógica financiera ni de backend.
- Corregidos dos manejadores duplicados del cliente que fallaban en silencio: el botón Importar llamaba a `opendialog` (con minúscula) y «Cerrar sesión» hacía un GET a una ruta que solo acepta POST. El comportamiento visible no cambia: el diálogo y el cierre de sesión funcionan por el otro manejador.
- Evidencia (navegador, datos sintéticos): las seis filas de Configuración abren su hoja o diálogo; entrar a la demo, cerrar sesión desde Configuración y volver al acceso sin errores de JavaScript; sin desborde horizontal a 375 px; acceso revisado en móvil oscuro y claro.
- Hallazgo de backend, SIN corregir (pendiente de aprobación): `Ledger.purgeDemoWorkspaces()` borra `operations` antes que `evidence`, y SQLite rechaza el borrado por clave foránea cuando un espacio demo vencido tiene comprobantes adjuntos. Efecto: `/api/demo` responde 500 hasta vaciar la base de demostración. Solo afecta al modo demo; el espacio privado no usa esa función. Arreglo propuesto: borrar `evidence` antes que `operations` en esa función, con una prueba que lo cubra.
- No probado: iPhone real, claro y escritorio ancho de Configuración, importación y exportación de punta a punta.

## Corrección de backend: limpieza de espacios demo (30/10/2026)

- Aprobada por el usuario. `Ledger.purgeDemoWorkspaces()` ahora borra `evidence` antes que `operations`; antes SQLite rechazaba el borrado por clave foránea si un espacio demo vencido tenía comprobantes adjuntos y `/api/demo` respondía 500. Un solo cambio de orden, sin tocar reglas financieras ni el espacio privado.
- Evidencia: prueba nueva en `tests/ledger.test.mjs` («limpieza de demos…»): falla sin el arreglo con `FOREIGN KEY constraint failed` y pasa con él; también cubre una reversión y que el espacio no demo sobrevive. Suite completa de `projects/landur/`: solo fallan las 3 pruebas ya documentadas de Windows. De punta a punta contra el servidor local: entrar a la demo, adjuntar un comprobante, cerrar sesión y volver a entrar a la demo responde 200.

## Rediseño visual móvil — Etapa F: revisión final (30/10/2026)

- Hecho: revisión de las siete pantallas y del registro en móvil (375 px) en claro y oscuro, y de Inicio, Actividad, Pendientes, Cuentas y Configuración en escritorio (1280 px). Se agrandaron a 44 px el botón «ⓘ» del saldo y las acciones Pagar/Cobrar de Pendientes. En claro se oscurecieron el gris secundario, el verde, el ámbar, el rojo y el azul de texto para llegar a contraste AA (≥ 4,5:1; antes 3,7–4,4).
- Evidencia (medida en navegador sobre cada pantalla, claro y oscuro): sin desborde horizontal, sin controles táctiles bajo 40 px, sin texto bajo AA y sin errores de JavaScript. `npm test` en la raíz: 78/78. `node --test` en `projects/landur/`: 89/92; fallan solo las 3 pruebas de Windows ya documentadas.
- No probado: iPhone real (Safari y PWA instalada), dictado de voz real, teclado real con las hojas abiertas, importar y exportar de punta a punta, claro en el escritorio ancho.
- Quitado antes del commit el botón «Entrar a la demo» de `public/app.js` (era solo para ver la demo en local). Pendiente: decidir si se elimina el código del formulario antiguo, que ya no se alcanza desde la interfaz.

## Integraciones, interfaz — Etapa 1: que se vea lo que pasó (02/11/2026)

- Hecho: la hoja «Conexiones» conserva y muestra el resultado de la última sincronía de cada servicio: cifra grande de registros nuevos, desglose (ventas y cobros, o gastos), lo omitido en español claro («ya estaban», «de prueba», «sin cobro todavía»…), el período y la hora, y los avisos con el pedido y el motivo. Antes el texto se borraba al volver a pintar el bloque. Además el aviso breve («Sincronía terminada») queda sobre cualquier hoja abierta —antes la propia hoja lo tapaba— usando el popover del navegador. Solo interfaz: sin cambios de backend ni de reglas.
- Evidencia (navegador, con respuestas de sincronía simuladas; no se llamó a Shopify ni a Meta): éxito parcial con dos avisos, «Nada nuevo» con cuatro ya existentes, y error de token con el botón reactivado y el resultado anterior intacto; singular y plural correctos; sin errores de JavaScript. `npm test` en la raíz: 90/90. `projects/landur/`: 96/99, con las 3 de Windows ya documentadas.
- No probado: sincronía real con tokens de Shopify o Meta, iPhone real, claro y escritorio de esta hoja. En iOS anteriores a 17 el popover no existe y el aviso queda como antes.
- Siguiente: etapa 2 (sincronizar como acción principal y configuración plegada).

## Demo local y limpieza de espacios demo con conexiones (03/11/2026)

- La pantalla de acceso de la demo local volvió a mostrar «Entrar a la demo (datos sintéticos)», solo si el servidor corre en modo demo (`/api/session` devuelve `demo: true`). En modo privado devuelve `demo: false` y el botón no existe; el servidor ya rechaza el modo demo en producción.
- Defecto de backend, mismo origen que el anterior: `Ledger.purgeDemoWorkspaces()` no borraba `connections` (tabla añadida con las integraciones de Shopify y Meta), y SQLite rechazaba borrar el espacio demo por clave foránea cuando se había guardado una conexión: `/api/demo` respondía 500. Se borra `connections` antes que el espacio. La prueba «limpieza de demos…» ahora también inserta una conexión: falla sin el arreglo y pasa con él. `projects/landur/`: 96/99 (las 3 de Windows de siempre).
- Evidencia: entrar a la demo, cerrar sesión y volver a entrar funciona con una conexión guardada.

## Barra de navegación inferior: píldora y animación (03/11/2026)

- Hecho: el icono de la pestaña activa lleva un fondo suave en forma de píldora (azul marino translúcido en claro, menta translúcido en oscuro) y al cambiar de pestaña la píldora aparece con una animación breve (0,32 s, escala con ligero rebote). Todos los iconos ocupan la misma caja de 56×30 px, de modo que la barra no cambia de alto (65 px) al activarse una pestaña. Con «reducir movimiento» activado la animación queda anulada por la regla general. Solo CSS; caché del service worker v9. El botón central de micrófono no cambia.
- Evidencia (navegador, móvil): píldora presente y con la animación terminando en su estado final en oscuro y claro; barra de 65 px en Inicio, Actividad y Pendientes. `npm test` en la raíz y `projects/landur/`: sin cambios respecto a antes.
- Nota: la animación se repite cada vez que la app vuelve a pintar la barra (por ejemplo al actualizar datos), no solo al cambiar de pestaña. Si molesta, se limita con una clase que solo se ponga al navegar.

## Integraciones, interfaz — Etapas 2 a 5: maqueta aprobada llevada a la app (03/11/2026)

- Hecho (solo interfaz; mismos endpoints y mismos cuerpos de envío): la hoja «Conexiones» ahora es una lista con una fila por servicio y su etiqueta de estado; tocar una fila abre la hoja del servicio con una tarjeta de estado (al día, sincronizando, resultado, nada nuevo, token vencido, sin sincronizar hace N días), «Sincronizar ahora» como acción principal y la configuración plegada en «Editar conexión». La conexión nueva se da de alta por pasos (origen, dónde se registra, token) con «Cómo conseguirlo» y botón Pegar. La fila de Configuración resume el estado real («Shopify conectado · Meta Ads sin conectar» y la última sincronía). En Actividad, las filas llegadas por sincronía llevan la etiqueta «Shopify» o «Meta». En Inicio, «Requiere atención» suma una línea por cada conexión con 3 días o más sin sincronizar.
- Evidencia: `scripts/qa-conexiones.mjs` (`npm run test:conexiones`, Chrome real, 390 px, demo local con token ficticio y sincronía simulada en la red) cubre lista, resultado parcial con aviso, «Nada nuevo», error de token con «Actualizar token», alta por pasos con vuelta atrás y ausencia de desborde: pasa. Revisión manual en 390 px en oscuro y claro de lista, hoja, sincronizando, resultado, error, edición, pasos del alta, Actividad con etiquetas e Inicio con la línea de atención. `node --test tests/*.test.mjs`: 96/99 (los 3 fallos son los conocidos de Windows: enlace simbólico, ruta POSIX y permisos). `npm test` en la raíz: 90/90.
- No probado: sincronía real con Shopify o Meta, iPhone real y PWA instalada, escritorio ancho de esta hoja. `scripts/qa-browser.mjs` sigue sin poder correr en este equipo porque busca encabezados y botones de la interfaz anterior al rediseño (falla en su primera aserción, antes de tocar Conexiones); no se modificó.
- Para backend (Mather): (1) guardar el último error de sincronía por conexión: hoy «El token no es válido» solo se ve en el momento del fallo y no aparece en Inicio después; (2) un «Desconectar»; (3) **Shopify**: según la documentación y el Centro de ayuda, desde el 1/1/2026 no se pueden crear apps personalizadas nuevas desde el admin; las nuevas salen del Dev Dashboard con credenciales de cliente y un token que vence (≈24 h). La integración actual espera un token `shpat_` fijo, que solo sirve para apps creadas antes de esa fecha. El texto de «Cómo conseguirlo» lo dice sin inventar pasos; conviene revisarlo.

## Corrección: importes grandes, voz y cuentas de banco (05/11/2026)

- Pedido del usuario: al agregar una cuenta aparecía un error, el dictado no reconocía cifras muy grandes y el saldo de una cuenta de banco quedaba mal.
- Voz: `wordsToNumber` sumaba las escalas en vez de combinarlas, así que «mil millones» daba 1.001.000 y «mil quinientos millones» 500.001.000; «billón» no existía y la «y» de «noventa y nueve mil» cortaba la cifra en 9.000. Ahora cada escala absorbe los grupos de orden menor: mil millones = 1.000.000.000, dos mil millones = 2.000.000.000, un billón = 1.000.000.000.000, noventa y nueve mil = 99.000. Una cifra por encima del tope no se recorta: no se reconoce y se avisa.
- Importes: el servidor cortaba en 10 dígitos sin decir el máximo; al crear una cuenta con un saldo grande (20.000.000.000) devolvía «Ingresá un importe válido…», que era el error reportado. El tope pasa a 9.999.999.999.999,99, dentro de un entero seguro en unidades menores, y el rechazo nombra ese máximo. En el cliente, un importe fuera de rango muestra el motivo en «Revisá» y no envía nada.
- Cuenta de banco: `normAmount` leía «60,000» como 60,000 y guardaba $60,00 donde se quiso escribir $60.000. Un grupo final de tres dígitos con coma o punto ahora se interpreta como miles; el valor se arma desde centavos enteros.
- Evidencia: `projects/landur/` `npm test` 101/101 (incluye 2 pruebas nuevas: escalas de voz y saldo inicial grande); `npm test` en la raíz 90/90. Navegador con datos sintéticos: alta de «Banco Grande» con 20.000.000.000 creada con $20.000.000.000,00; «Banco Coma» con 60,000 creada con $60.000,00; con 10.000.000.000.000 la revisión muestra el máximo y «Continuar» queda deshabilitado; sin errores de JavaScript. El dictado real con micrófono no se probó: la voz se verificó sobre la función pura.
- Sin cambios de reglas financieras, comandos ni endpoints. Caché del service worker a v11 para que el iPhone tome el JS nuevo.

## Varias facturas por voz seguidas (05/11/2026)

- Pedido del usuario: después de grabar una factura, el micrófono «permite grabar pero no graba» y hay que volver a entrar a la app.
- Causa (solo interfaz): la pantalla esperaba el evento `end` del reconocimiento para avanzar, y en iOS/WebKit ese evento puede no llegar o la segunda sesión queda muda. Además, con `listening` todavía en true, tocar de nuevo el micrófono solo llamaba a `stop()` y salía: no se reiniciaba nada. El dictado de factura se cortaba con `stop()`, que en Safari a veces deja el micrófono tomado.
- Ahora el resultado se aplica al llegar y la pantalla avanza sin esperar `end`; al terminar se corta con `abort()` (libera la sesión de audio) y se descartan los manejadores viejos. Al tocar para detener se pide el final y, si no responde en 1,5 s, se corta y se avisa. Un vigía de 15 s informa si la sesión quedó muda; si el arranque no se confirma en 4 s se reintenta una vez con una instancia nueva y, si vuelve a fallar, se avisa. Los mensajes ofrecen reintentar o escribir a mano. Caché del service worker a v12.
- Evidencia: navegador cloud con `SpeechRecognition` simulado sobre la demo sintética: dos facturas seguidas sin recargar ($1.250,00 «Filamento», guardada, y $3.000,00 «Servicios de contabilidad»); caso sin `end` (llega igual a «Revisá»); `start()` que falla (aviso «No se pudo iniciar el micrófono. Reintentá.» y el toque siguiente graba $700,00); sesión muda (aviso a los 15 s y reintento con $500,00). `projects/landur/` `npm test` 101/101; `npm test` en la raíz 90/90.
- No probado: dictado real en iPhone/Safari ni en PWA instalada. El simulador cubre el ciclo de vida de la interfaz, no el reconocimiento del sistema.

## Corrección: la app se congelaba tras varios cambios de pestaña, y «80 mil» se leía mal (06/11/2026)

- **Congelamiento al cambiar de pestaña.** Causa raíz: `render()` registraba cuatro escuchas de clic sobre `#app` en cada pintado, y `#app` no se recrea. Cada pulsación de pestaña ejecutaba todas las copias del manejador de `data-view`, y cada copia volvía a pintar y agregaba otra: las escuchas se duplicaban en cada clic (8, 16, 32… 16.384) y el clic 12 tardaba 5,6 s en el navegador; el siguiente congelaba la página. El mismo defecto hacía que un toque sobre un movimiento llamara varias veces a `detail()`, y que las confirmaciones de borrado se repitieran. Existía desde el código original; el rediseño no lo introdujo, pero tampoco lo detectó. Corrección: las escuchas se registran una sola vez (`appWired`).
- **«80 mil» → 80 o 1.000.** `parseSpokenInvoice` no entendía cifras mezcladas con escala: «por 80 mil» tomaba el 80, y «80 mil pesos» tomaba solo el «mil» (1.000). También «2 mil 500» daba 1.000 y «1,5 millones» daba 1.000.000. Corrección: antes de buscar el importe se reemplazan «80 mil», «2 mil 500», «1 millón 200 mil» y «1,5 millones» por la cifra completa, sin cambiar la longitud del texto. Solo se suman grupos de tres dígitos tras la escala, así que «80 mil por 2 rollos» no toma el 2.
- **Segundo dictado que nunca dejaba de grabar.** No se tocó: Mather lo corrigió el 05/11 (commit 9954f6b: el resultado se aplica al llegar, `abort()` y vigías con tiempo). Se verificó con un reconocedor simulado que nunca emite «end», como iOS: dos dictados seguidos se interpretan y se guardan, y sin respuesta la pantalla sale sola de «Escuchando…».
- **Evidencia.** Pruebas nuevas: `tests/voice.test.mjs` (3 casos, fallaban antes y pasan), `scripts/qa-navegacion.mjs` (`npm run test:navegacion`: las escuchas de `#app` fallaban 4 → 12 tras un solo clic antes de la corrección y ahora quedan en 4 tras 40 cambios, clic más lento 17 ms; abrir y cerrar el registro 8 veces no acumula escuchas) y `scripts/qa-voz.mjs` (`npm run test:voz`, dos dictados guardados con 80.000 y 2.500 y salida de «Escuchando…»). `npm test` en la raíz: 91/91. `node --test tests/*.test.mjs`: 101/104 (los 3 fallos conocidos de Windows). QA de conexiones: sigue pasando. Service worker: caché `v13`.
- **No probado:** micrófono real en iPhone y Android (el reconocedor es simulado; la transcripción real puede variar), PWA instalada con el caché nuevo, escritorio. Pendiente conocido sin tocar: una frase que contiene «vence …» antes del importe pierde el importe (el vencimiento consume el resto de la frase).

## Corrección: errores de uso cotidiano en el celular (06/11/2026)

- Pedido del usuario: revisar qué otros errores de uso diario puede encontrar Rafa. Se exploró la app en un navegador con tamaño de iPhone (demo sintética) y se corrigieron los hallados.
- **Micrófono encendido al pasar a escribir.** Quien abría «Registrar», tocaba «Escribir» y tipeaba un importe seguía con el micrófono tomado: una voz ajena (otra persona, la tele) pisaba el importe escrito (250 → 999). Ahora «Escribir» apaga el micrófono y descarta sus manejadores.
- **Un corte de red o un fallo pasajero cerraba el formulario.** El evento `offline` y un error al volver a la app bloqueaban la aplicación y mandaban al ingreso aunque la sesión siguiera vigente; se perdía lo escrito. Ahora solo un 401 del servidor bloquea; un corte muestra un aviso y, al volver la red, se actualizan los datos sin cerrar nada. Guardar sin red sigue fallando con su propio mensaje y sin duplicar (no cambió el manejo de escrituras).
- **Menores.** El contador de Pendientes de escritorio sumaba 2 fijos (mostraba 5 donde había 3); un concepto largo sin espacios ensanchaba Inicio (la grilla no tenía `minmax(0,1fr)`); a 320 px el buscador de Actividad se salía de la pantalla.
- Evidencia: `scripts/qa-uso-diario.mjs` (`npm run test:uso`, Chrome real, reconocedor simulado, demo local): las pruebas del micrófono, del contador y del concepto largo fallaban antes y pasan; la del corte de red cubre `offline` y un 503 (no bloquea) frente a un 401 (sí bloquea). Caché del service worker a v14.
- No probado: micrófono real en iPhone y Android, PWA instalada, que el portal de producción redirija bien tras un 401 real. Sin explorar aún: cámara y comprobantes, importar/exportar CSV, cobros con comisión, transferencias, retiros, reversiones y varias monedas.
