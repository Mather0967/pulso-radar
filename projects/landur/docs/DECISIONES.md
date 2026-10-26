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
| D07 | Compatibilidad de Namecheap: runtime, SQLite, disco, archivos privados y backups | RIVECT + responsable del proyecto | Despliegue | Usuario indicó Namecheap. Base de desarrollo Node >=22.13/SQLite, usuario informa Node actualizado; pendiente preflight en cPanel; no desplegar si falla |
| D08 | Usuarios autorizados y recuperación del portal | Rafa + RIVECT | Acceso real | Usuario solicita login RIVECT compartido; implementados permisos independientes por proyecto. Lista de usuarios y validación operativa pendientes |
| D09 | Equipo, disponibilidad y fecha de inicio | Responsable del proyecto | Calendario comprometido | Tres sprints relativos de cinco días hábiles |
| D10 | Alcance, entorno y autorización de pentesting | Titular de infraestructura + RIVECT | Ejecución de pruebas de seguridad | Solo preparación, no pruebas externas |
| D11 | iPhone/versión iOS y dispositivo para aceptación | Rafa + RIVECT | Validación móvil real | Emulación no acredita prueba en dispositivo |
| D12 | Devoluciones y correcciones: criterios financieros | Rafa + RIVECT | Casos reales de reversión | Proponer vínculos auditables, no inferir reembolsos |

## Cambios aprobados

- **24/10/2026 — Usuario:** autoriza comenzar a codificar y aclara que el destino es Namecheap. Se prepara entrada cPanel/Passenger separada de Pulso y documentación del hosting. No amplía alcance financiero.
- **24/10/2026 — Decisión técnica provisional de implementación:** Node >=22.13 con SQLite integrado, sin dependencias de ejecución. Validado localmente, no en el hosting. No implica aprobar autenticación definitiva ni uso de datos reales. Si el preflight del host falla, se registra el bloqueo antes de cambiar persistencia.

- **24/10/2026 — Usuario:** confirma disponibilidad de Node actualizado y solicita continuar la PWA y entregar una lista de despliegue a cPanel. No autoriza cambios de fórmulas ni elimina las puertas de aceptación/pentesting.

- **24/10/2026 — Usuario:** solicita que LANDUR aparezca como proyecto junto a Pulso al iniciar sesión. Se autoriza integrar el selector y el acceso del portal. Se implementa `/landur/` con la sesión existente, permisos independientes y base separada. Sustituye la preferencia anterior por otra aplicación/subdominio; no cambia cálculos, alcance financiero ni criterios de salida.

- **26/10/2026 — Usuario:** solicita dictado por voz para registrar operaciones y pedir que continúen el backend y la seguridad. La voz entra como complemento del teclado en los campos de texto libre (concepto, categoría y nombre de cuenta); los importes y las fechas se siguen tipeando porque el reconocimiento de números no es fiable en un registro financiero. Requiere Permissions-Policy con microphone igual a self. El dictado solo llena un campo de texto: no transforma datos ni calcula importes, y la validación sigue siendo del lado del servidor. No cambia reglas financieras, alcance ni puertas de aceptación.
- **26/10/2026 — Usuario:** pide endurecer backend y seguridad. Se corrigen cinco hallazgos de la auditoría estática sin tocar reglas de negocio: límite de acceso por cliente (antes global por la IP del socket), scrypt asíncrono, validación del header Host, purgado de espacios demo sin sesión viva y formato decimal de importes negativos. Cada corrección queda cubierta por pruebas nuevas. No modifica importes, cálculos, auditoría ni aislamiento por espacio.


Para registrar otro cambio: fecha, solicitud, aprobador, decisión, motivo, efecto sobre alcance/plazo/pruebas y documentos actualizados. Resolver una duda técnica no autoriza cambiar una regla financiera.
