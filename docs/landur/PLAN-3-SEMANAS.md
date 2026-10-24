# RIVECT × LANDUR — Plan de proyecto de 3 semanas

Versión de trabajo 1.0 · 24 de octubre de 2026

**Formato:** 3 sprints de 5 días hábiles. Sin fecha de inicio fijada.

**Producto:** PWA financiera privada, orientada al iPhone e instalable desde Safari en la pantalla de inicio. No es una app nativa ni requiere publicación en App Store.

**Objetivo de entrega:** piloto utilizable de control financiero, no la totalidad del roadmap de producto. Este plan define un recorte del [roadmap general](ROADMAP.md) para el horizonte de tres semanas. Es planificación propuesta, no evidencia de implementación ni garantía de aprobación de seguridad.

## 1. Qué se entrega al terminar

Rafa podrá entrar desde su iPhone y:

- Ver cuentas bancarias, Mercado Pago y efectivo, con moneda y fecha de verificación de saldo.
- Registrar gastos pagados o pendientes, incluso sin comprobante.
- Registrar ventas y vincular sus cobros sin contarlos dos veces.
- Registrar obligaciones y sus pagos, incluidos pagos parciales.
- Distinguir transferencias internas de retiros personales y gastos operativos.
- Ver saldos, obligaciones, reservas registradas y disponible estimado con sus limitaciones.
- Revisar operaciones sin conciliar y datos incompletos.
- Importar un formato CSV acordado y exportar registros para revisión.
- Conservar evidencia opcional y consultar cambios relevantes.

**Seis vistas prioritarias:** Inicio, Movimientos, Cuentas, Egresos, Ventas básicas y Pendientes. Configuración mínima para cuentas, categorías y acceso; no se desarrolla un módulo avanzado de administración.

### Recorte para sostener el plazo

- Un espacio privado de LANDUR, con usuarios autorizados y permisos simples; sin plataforma multiempresa ni roles complejos.
- Moneda operativa inicial a confirmar con Rafa. No consolidar varias monedas sin conversión validada; registros de otras monedas se separan o se rechazan con explicación.
- Un importador CSV de plantilla fija, con mapeo documentado de las muestras disponibles. No se promete leer cualquier Excel o extracto automáticamente.
- Conciliación manual asistida por referencias y filtros; coincidencias ambiguas requieren confirmación.
- Reservas registradas explícitamente; repartos automáticos solo si las reglas están validadas y caben sin afectar las pruebas. Por defecto quedan fuera de este recorte.
- Disponible estimado: saldos accesibles verificados menos compromisos aplicables pendientes, sin descontar dos veces obligaciones o reservas relacionadas. Si falta una política validada, se muestran los componentes y se indica que el cálculo está pendiente.
- Sin resultado económico definitivo cuando falten costos o criterios de reconocimiento.

### Fuera de estas tres semanas

Integraciones automáticas con Shopify, Mercado Pago, bancos, Meta Ads y correo; OCR; recetas de materiales; recálculo de márgenes; repartos automáticos no validados; informes avanzados; XLSX; notificaciones push; escritura financiera offline y sincronización con resolución de conflictos.

La estructura conserva campos de origen e identificador externo para incorporar conectores después. Un registro manual identificado como Mercado Pago no se presenta como una conexión activa.

## 2. Condiciones de arranque

Resolver antes del inicio o durante el día 1:

1. **Datos:** muestras autorizadas de las hojas, un extracto y comprobantes; no se asume que ya se dispone de ellos.
2. **Reglas mínimas:** moneda, saldos iniciales y fecha de corte, tratamiento de obligaciones/reservas y clasificación de retiros. El 25 % vs. 30 % mayorista no bloquea caja: bloquea el reparto automático.
3. **Infraestructura:** entorno de pruebas separado, despliegue HTTPS, base persistente, almacenamiento privado y respaldo.
4. **Acceso:** listado de usuarios, mecanismo de autenticación y recuperación. Credenciales y secretos fuera del navegador y del repositorio.
5. **Validación:** disponibilidad de Rafa para revisar al cierre de las semanas 1 y 2 y aceptar el piloto al final.
6. **Capacidad:** responsables efectivos de backend/datos, interfaz PWA y QA/seguridad. Pueden compartir funciones, pero hay que confirmar disponibilidad; tres semanas no equivalen a cualquier carga horaria.
7. **Pentesting:** autorización explícita, entorno, endpoints/cuentas incluidos, límites y responsable de ejecución.

Si faltan datos reales, se desarrolla con ejemplos sintéticos identificados; no se da por validada la migración ni la exactitud contra las hojas. Si falta capacidad, se recorta alcance o se revisa la fecha, no se omiten controles de seguridad.

## 3. Sprint 1 — Base funcional de punta a punta

**Meta:** terminar la semana con una versión básica que ya guarda operaciones y calcula correctamente el flujo principal.

| Día | Trabajo principal | Evidencia esperada |
|---|---|---|
| 1 | Cerrar alcance, muestras y reglas mínimas. Definir entidades/estados, autenticación, permisos, estructura de datos y pantallas | Backlog acotado, esquema financiero y casos de prueba con resultados esperados |
| 2 | Implementar cuentas, saldos iniciales, movimientos y persistencia. Montar navegación móvil y sesión privada | Datos conservados tras recarga; rutas privadas protegidas |
| 3 | Captura de gastos y efectivo; obligaciones, pagos parciales, transferencias y retiros | Gasto sin factura y transferencia entre cuentas funcionando |
| 4 | Ventas/cobros básicos, vínculos de conciliación, Inicio y disponible estimado. Importación CSV con vista previa | Venta, cobro y traslado relacionados sin duplicación; errores de importación visibles |
| 5 | Integrar el recorrido completo, ejecutar pruebas financieras y revisar con Rafa. PWA instalable en entorno de pruebas | Demo funcional en iPhone y lista priorizada de ajustes |

**Recorrido de demo:** registrar venta → asociar cobro → trasladar dinero entre cuentas → registrar envío pendiente → ver disponible estimado → pagar envío sin duplicar gasto.

**Definición de terminado:**

- Flujo principal funcionando con persistencia real y acceso privado.
- Venta/cobro, factura/pago y transferencia/ingreso separados en datos y cálculos.
- Importación repetida y doble envío del formulario no duplican operaciones.
- Importes calculados con precisión monetaria y validación en servidor.
- Auditoría mínima y respaldo configurados; pruebas básicas de autorización desde esta semana.
- Sin botones que aparenten guardar o conectar fuentes cuando no lo hacen.

**Entrega:** alfa privada para validación, no lanzamiento general.

## 4. Sprint 2 — Pulido, completitud y validación móvil

**Meta:** convertir la base en una herramienta cómoda, clara y consistente para el uso cotidiano.

| Día | Trabajo principal | Evidencia esperada |
|---|---|---|
| 6 | Resolver observaciones de Rafa; mejorar Inicio, desglose de disponible y estados confirmado/estimado/pendiente | Cifras explicables y datos incompletos señalados |
| 7 | Optimizar captura: teclado decimal, fechas, campos mínimos, errores y comprobantes opcionales privados | Registro de gasto completado desde iPhone, con y sin foto/PDF |
| 8 | Pulir conciliación, pagos parciales, búsqueda/filtros y correcciones auditadas. Exportación CSV | Obligaciones y movimientos trazables; exportación revisable y protegida contra fórmulas de planilla |
| 9 | Pruebas de Safari y modo instalado: teclado, cámara/archivos, pantalla pequeña, suspensión, recarga, pérdida de red y actualización | Checklist PWA en iPhone real y fallos reproducibles registrados |
| 10 | Validar casos reales disponibles con Rafa, restaurar un respaldo de prueba y congelar alcance | Versión candidata, inventario de endpoints y plan de pentesting aprobado |

**Definición de terminado:**

- Rafa puede registrar un gasto y encontrar una deuda sin acompañamiento del equipo.
- Cada cifra del Inicio permite entender su composición y fecha de actualización.
- Comprobantes solo accesibles para usuarios autorizados.
- No hay pérdida silenciosa ni confirmación falsa al fallar la red.
- Reimportación, doble toque, devolución registrada y corrección de conciliación tienen tratamiento probado dentro del alcance.
- No quedan bloqueos funcionales del flujo principal. Después del día 10 no se agregan funciones: se corrigen defectos.

**Entrega:** candidata al piloto, lista para evaluación de seguridad.

## 5. Sprint 3 — Pentesting, correcciones y decisión de lanzamiento

**Meta:** evaluar la seguridad del alcance acordado, corregir hallazgos y decidir si es seguro habilitar el piloto.

El pentesting se realiza solo sobre infraestructura propia/autorizada, preferentemente en staging con datos sintéticos o anonimizados y respaldo previo. No se prueban sistemas de Santander, Mercado Pago, Shopify ni otros terceros. Se acuerdan intensidad y límites; no se realizan pruebas destructivas o de denegación de servicio sin autorización específica.

| Día | Trabajo principal | Evidencia esperada |
|---|---|---|
| 11 | Revisar superficie, amenazas, configuración, dependencias y alcance. Preparar cuentas de prueba autorizadas/no autorizadas | Inventario y checklist de pruebas con versión del sistema |
| 12 | Probar autenticación, sesiones, autorización por objeto, API, importaciones, cargas y exportaciones | Hallazgos reproducibles, impacto y severidad |
| 13 | Probar caché PWA, logout, manipulación de importes/IDs, doble envío, concurrencia e integridad financiera. Corregir en paralelo | Hallazgos priorizados y primeras correcciones verificables |
| 14 | Completar correcciones; repetir cada prueba afectada y ejecutar regresión financiera/móvil | Evidencia de cierre o estado pendiente por hallazgo |
| 15 | Revisión final, restauración/rollback, aceptación con Rafa y decisión de salida | Informe de seguridad, límites conocidos y acta de habilitación o bloqueo |

### Cobertura mínima de seguridad

- **Autenticación y sesión:** inicio/cierre, caducidad, recuperación, resistencia a intentos repetidos y cookies seguras cuando se utilicen.
- **Autorización:** endpoints y archivos rechazan usuarios no autorizados; cambiar IDs en peticiones no permite acceder ni modificar recursos sin permiso.
- **Entradas y API:** validación en servidor, inyección, XSS, asignación de campos no autorizados y CSRF cuando el mecanismo de sesión lo requiera; CORS y límites de carga configurados.
- **Comprobantes/importaciones:** tipo y tamaño permitidos, acceso privado, nombres/rutas seguros, CSV malicioso y ausencia de ejecución de contenido subido.
- **Integridad financiera:** importes manipulados, estados inválidos, doble registro, importaciones repetidas, pagos concurrentes y operaciones parciales por fallos.
- **PWA y privacidad:** caché limitada a recursos públicos de interfaz; sin persistir respuestas financieras, comprobantes o credenciales en Cache Storage. El logout limpia el estado visible y evita recuperar información privada desde la caché de la app.
- **Infraestructura:** HTTPS, secretos, dependencias, mensajes de error y logs sin datos sensibles, auditoría y restauración de respaldos.

### Criterio de salida

- Cero hallazgos críticos o altos abiertos; severidad evaluada por impacto y posibilidad de explotación.
- Hallazgos menores documentados con responsable, fecha objetivo y aceptación explícita del riesgo.
- Sin defectos que dupliquen dinero, pierdan registros o permitan acceso indebido.
- Pruebas financieras y de iPhone aprobadas sobre la versión corregida.
- Respaldo/restauración y procedimiento de reversión de despliegue comprobados.

**Entrega:** piloto habilitado si pasa los criterios. Si hay hallazgos bloqueantes, no se publica con datos reales hasta corregir y repetir las pruebas. Tres semanas de calendario no justifican aprobar una versión insegura.

Un escaneo automático no equivale a pentesting completo. La revisión debe incluir pruebas manuales y retesting; cuando sea posible, una persona distinta de quien implementó verifica los controles. Si no hay capacidad especializada, se debe declarar el alcance limitado de la revisión y no presentarla como una certificación de seguridad.

## 6. Requisitos concretos de la PWA para iPhone

- Diseño mobile-first, controles táctiles cómodos, contraste/etiquetas accesibles y respeto a las zonas seguras de pantalla.
- HTTPS y manifiesto con nombre, iconos, URL de inicio y modo standalone; icono para pantalla de inicio de iOS.
- Instrucción breve para instalar desde Safari mediante «Agregar a pantalla de inicio».
- Pruebas tanto en Safari como instalada: el comportamiento no se presume idéntico.
- Service worker con estrategia explícita de actualización y caché solo de recursos no sensibles de interfaz; no cachear respuestas autenticadas.
- En este piloto se necesita conexión para consultar/guardar información financiera. Sin conexión se muestra el estado y nunca se afirma que un movimiento quedó guardado.
- Captura de foto/selección de archivo mediante controles compatibles; validar permisos, tamaño y formato admitido en el iPhone de Rafa.
- Sesión segura con recuperación de acceso; Face ID propio, biometría nativa y publicación en App Store no forman parte del alcance.
- Sin dependencia de ejecución en segundo plano ni push. Si se incorporan notificaciones posteriormente, validar versión de iOS, instalación y permisos.
- Datos persistidos en servidor. Instalar la PWA no es un respaldo ni convierte el dispositivo en la base financiera principal.

## 7. Organización y control del proyecto

- Backlog único y prioridades: **P0** integridad/seguridad, **P1** uso cotidiano, **P2** mejoras prescindibles del piloto.
- Revisión breve diaria de avance y bloqueos; demo al cierre de cada sprint.
- Cada tarea termina con código, prueba y criterio de aceptación, no solo una pantalla.
- Incidentes de seguridad e integridad desplazan mejoras visuales.
- Si el alcance no entra: retirar primero mejoras cosméticas, filtros avanzados y cualquier automatización adicional. No recortar autorización, respaldo, trazabilidad ni pruebas de duplicación.
- Sin fechas absolutas hasta acordar inicio y disponibilidad; sin comprometer APIs externas dentro del plazo.

## Resumen para los socios

| Semana | Enfoque | Entrega |
|---|---|---|
| 1 | Construir lo básico correctamente | Alfa privada con recorrido financiero completo e instalación PWA |
| 2 | Pulir y validar con Rafa | Candidata al piloto cómoda en iPhone y con alcance congelado |
| 3 | Pentesting, correcciones y retesting | Informe y piloto habilitado únicamente si supera los criterios de salida |

**La promesa de estas tres semanas es un piloto financiero confiable y usable en iPhone; no todas las integraciones ni todo el roadmap futuro.**
