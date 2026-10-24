# Instrucciones para agentes — LANDUR

Estas instrucciones aplican a `projects/landur/` y complementan las instrucciones superiores del entorno. No conceden acceso ni autorización para probar infraestructura externa.

## Referencia obligatoria

Antes de trabajar, leer:

- `../../docs/landur/LANDUR-BRIEF-Y-SPRINTS-3-SEMANAS-IA.md`: contexto autónomo, restricciones y plan del piloto.
- `../../docs/landur/PLAN-3-SEMANAS.md`: detalle operativo de los sprints.
- `../../docs/landur/ROADMAP.md`: visión futura; no incorporar sus etapas posteriores al piloto por iniciativa propia.
- `docs/DECISIONES.md` y `docs/BACKLOG.md`: decisiones pendientes y progreso verificable.

El brief aporta los hechos del negocio; el plan de tres semanas limita la entrega. Si hay contradicciones, señalar el conflicto y pedir validación. Nunca escoger silenciosamente la versión más conveniente.

## Disciplina de alcance

1. Semana 1: base funcional. Semana 2: pulido y validación. Semana 3: pentesting, correcciones y retesting.
2. No agregar funciones ni modificar reglas de negocio sin aprobación explícita del usuario. Registrar el cambio aprobado, motivo e impacto antes de implementarlo.
3. Un bloqueo se informa; no se resuelve inventando datos, permisos, porcentajes o equivalencias.
4. No presentar prototipos, mocks o datos sintéticos como funcionalidad o datos reales.
5. No afirmar que una tarea está terminada sin evidencia y prueba. No marcar el pentesting completado por ejecutar un escáner.
6. No debilitar seguridad o integridad para cumplir una fecha. Hallazgos críticos/altos o errores financieros bloquean la salida.

## Invariantes financieros

- Venta no es cobro; factura no es pago; devengamiento no es salida de caja.
- Transferencias internas no son ingresos/gastos; retiros personales no son gastos operativos.
- Shopify + Mercado Pago + banco son fuentes relacionadas, no tres ingresos.
- Importaciones y reintentos no deben duplicar operaciones. Coincidencias ambiguas requieren revisión.
- Usar precisión monetaria exacta, escrituras atómicas y validación del lado del servidor.
- Datos desconocidos no equivalen a cero. No sumar monedas distintas sin conversión validada.
- Preservar origen, evidencia, estados y auditoría. No modificar historia silenciosamente.
- Separar saldos, obligaciones, reservas, disponible estimado y resultado económico.
- Reinversión mayorista 25 % vs. 30 % sigue pendiente. No introducir ninguno como valor automático.

## PWA y seguridad

- iPhone primero, HTTPS, manifest e instalación desde Safari; validar también en modo instalado.
- Persistencia en servidor y autorización en cada endpoint/archivo privado.
- Cachear solo recursos no sensibles de interfaz, nunca respuestas financieras autenticadas ni comprobantes.
- Sin escritura financiera offline en el piloto. No confirmar guardados que no llegaron al servidor.
- Secretos fuera del cliente, Git y logs. Comprobantes privados, validación de carga y exportación segura.
- Pentesting solo en alcance autorizado; sin probar bancos ni proveedores externos.

## Aislamiento y cierre de cada tarea

Trabajar en este proyecto sin alterar Pulso ni su despliegue. No agregar dependencias a la raíz por conveniencia. Validar el stack antes de iniciar la implementación.

Al terminar una tarea: identificar requisito, archivos cambiados, pruebas realmente ejecutadas, resultado y pendientes; actualizar el backlog con evidencia. Si no pudo probarse algo, declararlo expresamente.
