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
