# LANDUR · PWA financiera privada

Proyecto de RIVECT para Rafael «Rafa» Sánchez, separado de la aplicación Pulso aunque comparte este repositorio.

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

**Preparación del proyecto / sprint 1, día 1.** Hay documentación, backlog y propuesta de modelo. Todavía no hay una app LANDUR implementada, stack aprobado, base de datos, autenticación, conectores, despliegue ni pentesting ejecutado. No hay fecha de inicio comprometida.

Los comandos de desarrollo de la raíz pertenecen a Pulso, no a LANDUR. No ejecutarlos como si levantaran esta aplicación.

## Aislamiento

- El código futuro de LANDUR se ubicará en `projects/landur/`.
- El contexto y los planes se conservan en `docs/landur/`, sin duplicarlos aquí.
- No reutilizar datos, sesiones, secretos ni almacenamiento de Pulso sin una decisión explícita.
- No modificar la aplicación, dependencias ni despliegue de Pulso para implementar LANDUR sin autorización.
- No versionar datos financieros reales, credenciales, extractos, comprobantes privados ni respaldos.

La rama de esta sesión es `arena/eab1cd0e-pulso-radar`. No se creó un repositorio adicional.
