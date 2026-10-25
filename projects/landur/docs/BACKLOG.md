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
