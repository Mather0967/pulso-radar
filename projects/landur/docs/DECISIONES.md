# Registro de decisiones — LANDUR

Estado inicial: 24 de octubre de 2026. No se recibieron muestras originales ni permisos de integración durante esta preparación.

## Directrices del usuario

- Trabajar dentro de Pulso, aislando LANDUR. Se usa la rama activa de la sesión.
- Seguir el brief y el roadmap sin cambios de alcance no aprobados.
- PWA para iPhone.
- Tres semanas: base funcional, pulido y pentesting con correcciones.

## Pendientes

| ID | Decisión | Responsable de validación | Qué bloquea | Tratamiento mientras tanto |
|---|---|---|---|---|
| D01 | Moneda operativa y cuentas incluidas | Rafa | Saldos reales/importación definitiva | Prototipos sintéticos identificados; no consolidar monedas |
| D02 | Saldos iniciales, fecha de corte e historia a migrar | Rafa + RIVECT | Validación de caja | No mostrar disponible completo con cobertura insuficiente |
| D03 | Obligaciones/reservas aplicables y horizonte de disponible | Rafa; contador si corresponde | Disponible validado | Mostrar componentes, cálculo pendiente |
| D04 | Reinversión mayorista: 25 % vs. 30 % y excepciones | Rafa | Reparto automático | Fuera del piloto por defecto |
| D05 | Vendedores, reparto 60/40, ahorro 15 % y excepciones minoristas | Rafa | Reparto automático | No inferir transferencias ejecutadas |
| D06 | Muestras autorizadas, plantilla CSV y formato de exportación | Rafa + RIVECT; contador si corresponde | Importación real y aceptación de exportación | Una plantilla propuesta; no prometer soporte universal |
| D07 | Stack, hosting, base, archivos privados y backups | RIVECT + responsable del proyecto | Implementación/despliegue | Ninguna elección aprobada todavía |
| D08 | Usuarios, permisos, autenticación y recuperación | Rafa + RIVECT | Acceso real | No reutilizar identidades/sesiones de Pulso por defecto |
| D09 | Equipo, disponibilidad y fecha de inicio | Responsable del proyecto | Calendario comprometido | Tres sprints relativos de cinco días hábiles |
| D10 | Alcance, entorno y autorización de pentesting | Titular de infraestructura + RIVECT | Ejecución de pruebas de seguridad | Solo preparación, no pruebas externas |
| D11 | iPhone/versión iOS y dispositivo para aceptación | Rafa + RIVECT | Validación móvil real | Emulación no acredita prueba en dispositivo |
| D12 | Devoluciones y correcciones: criterios financieros | Rafa + RIVECT | Casos reales de reversión | Proponer vínculos auditables, no inferir reembolsos |

## Cambios aprobados

Sin cambios adicionales registrados. Para registrar uno: fecha, solicitud, aprobador, decisión, motivo, efecto sobre alcance/plazo/pruebas y documentos actualizados. Resolver una duda técnica no autoriza cambiar una regla financiera.
