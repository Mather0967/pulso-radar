# Backlog de ejecución — LANDUR

Las casillas indican evidencia real, no intención. Prioridades: P0 seguridad/integridad; P1 operación diaria; P2 mejoras prescindibles. No hay tareas de implementación completadas.

## Preparación realizada

- [x] Ubicación aislada en `projects/landur/`, sin reemplazar Pulso.
- [x] Brief y plan disponibles en `docs/landur/`.
- [x] Instrucciones para agentes y registro de decisiones pendientes.
- [x] Modelo inicial propuesto, aún no validado ni implementado.

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
