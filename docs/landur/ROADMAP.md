# RIVECT × LANDUR — Roadmap de producto y desarrollo

Versión de trabajo 1.0 · 24 de octubre de 2026

**Estado:** propuesta interna derivada del brief funcional. No constituye aprobación comercial, calendario comprometido ni funcionalidades ya implementadas.

**Plan de ejecución acotado:** ver [Plan de 3 semanas — PWA para iPhone](PLAN-3-SEMANAS.md). Ese documento organiza el piloto en base funcional, pulido y pentesting con correcciones; define qué parte de este roadmap entra en las tres semanas y qué queda para después.

**Base consultada:** brief compartido por el usuario. No se revisaron directamente la transcripción, las hojas ni los anexos A/B/C mencionados; sus cifras y reglas deben contrastarse con los originales.

Este roadmap corresponde a la aplicación financiera privada de LANDUR. No reemplaza el roadmap del producto Pulso existente en este repositorio ni presupone reutilizar su arquitectura.

## 1. Qué debería ser la app

Una aplicación financiera privada, orientada al iPhone, que responda cinco preguntas:

1. ¿Cuánto dinero tengo y dónde está?
2. ¿Cuánto de ese dinero está comprometido?
3. ¿Qué puedo usar, con qué nivel de certeza?
4. ¿Qué vendí, qué cobré, qué debo y qué me deben?
5. ¿Qué tengo que revisar o decidir hoy?

**No es un dashboard de marketing ni una planilla con otra apariencia.** Su núcleo es una base financiera trazable: cada hecho se registra una vez, conserva sus fuentes y se relaciona con sus cobros, pagos y movimientos.

Flujo rector: **captar → normalizar → conciliar → clasificar y registrar → aplicar reglas → calcular → mostrar y alertar**.

La IA, si se incorpora, ayuda a extraer y proponer clasificaciones. No decide pagos, inventa importes ni sustituye al motor de cálculo determinista.

## 2. Alcance de la primera versión útil — MVP

El primer producto debe servir aunque todavía no haya una sola API conectada.

### Incluido

- Acceso privado, persistencia en servidor, respaldo y registro de cambios.
- Cuentas bancarias, Mercado Pago y caja física, con moneda, saldo y fecha de verificación.
- Importación inicial controlada de las hojas Mayorista/Minorista y de un formato de extracto acordado.
- Movimientos con fuente, evidencia opcional, estado y relaciones financieras.
- Captura rápida de gastos y efectivo desde iPhone, incluso sin comprobante.
- Facturas/obligaciones con vencimiento, importe pendiente y pagos asociados.
- Transferencias internas y retiros personales diferenciados de ingresos/gastos operativos.
- Ventas y cobros básicos, sin exigir todavía recetas completas de productos.
- Conciliación asistida: sugerencias explicables y confirmación humana para casos ambiguos.
- Inicio con saldos, obligaciones, reservas y disponible estimado, indicando datos faltantes.
- Bandeja de pendientes y exportación estructurada inicial, con formato a validar.

### No bloquea el MVP

Conexiones automáticas, lectura de correo, OCR, recetas completas, alertas push, informes avanzados y recálculo de márgenes por insumo. Son evoluciones sobre una base ya utilizable.

### Condición para uso real

Sin saldos iniciales verificados o sin una política validada para descontar compromisos, se podrá mostrar información parcial, pero no un disponible aparentemente completo. Sin costos suficientes, el resultado económico seguirá incompleto o estimado.

## 3. Roadmap por etapas

Las etapas son puertas de validación, no semanas prometidas. Seguridad, trazabilidad y pruebas empiezan en la primera etapa; no se dejan para el cierre.

### Etapa 0 — Validar reglas y accesos

**Objetivo:** convertir las ambigüedades del brief en decisiones registradas, sin bloquear lo que puede avanzar.

**Trabajo:**

- Relevar cuentas, monedas, responsables, medios de pago y ubicación del efectivo.
- Obtener copias autorizadas de las hojas y muestras de extractos/comprobantes.
- Seleccionar casos reales: venta web, venta sin checkout, comisión MP, envío UES pendiente, gasto sin factura, devolución, transferencia interna y retiro personal.
- Confirmar reinversión mayorista del 25 % o 30 %, excepciones, reparto sin vendedor y ahorro personal diferido.
- Acordar corte de migración, saldos iniciales y alcance de historia a importar.
- Acordar qué reservas/obligaciones reducen el disponible y evitar descontar dos veces el mismo compromiso.
- Inventariar accesos: titular, permiso requerido, método autorizado, muestra disponible y alternativa manual.
- Validar exportación con Rafa/contador; CSV es una propuesta inicial, no un formato aprobado.

**Entregables:** matriz de reglas, inventario de fuentes, ejemplos de aceptación con resultados esperados y lista de decisiones pendientes con responsable.

**Puerta de salida:** hay datos y casos suficientes para probar el núcleo. Una integración inviable no frena el producto si existe una importación viable; una regla no validada permanece desactivada o pendiente.

### Etapa 1 — Construir el núcleo financiero y la conciliación

**Objetivo:** que las operaciones representen correctamente el negocio antes de automatizarlas.

**Trabajo:**

- Definir entidades, estados y relaciones; permitir varios registros de origen por operación.
- Distinguir venta/cobro, factura/pago, devengamiento/caja, transferencia/ingreso y retiro/gasto.
- Implementar importación con vista previa, validación, reporte de errores y trazabilidad por fila/lote.
- Evitar duplicados por fuente e identificador externo. Si no existe identificador, detectar candidatos y enviarlos a revisión, sin descartar movimientos legítimos por compartir importe y fecha.
- Conciliar una operación con varios cobros/pagos y liquidaciones que agrupan varias operaciones.
- Soportar pagos parciales, comisiones, devoluciones y diferencias sin inventar equivalencias.
- Registrar correcciones y deshacer conciliaciones de forma auditable, sin borrar silenciosamente la historia.
- Usar importes decimales exactos o unidades monetarias menores; no sumar monedas diferentes sin conversión explícita y trazable.
- Versionar reglas por vigencia: un cambio de porcentaje o costo no debe modificar silenciosamente operaciones cerradas.

**Entregables:** modelo financiero, motor de cálculos básicos, importador y conjunto de pruebas con casos aprobados.

**Puerta de salida:** los casos de venta/cobro/transferencia, factura/pago, publicidad/cargo bancario y retiro de efectivo no duplican ingresos ni gastos. Reimportar un lote no cambia los totales.

### Etapa 2 — Entregar el MVP móvil para uso diario

**Objetivo:** que Rafa deje de depender de recordar gastos y pueda ver caja y pendientes desde el teléfono.

**Trabajo:**

- Implementar Inicio, Movimientos, Cuentas, Egresos, Ventas básicas y Pendientes.
- Incorporar un botón persistente de «Registrar» con gasto, entrada de efectivo, transferencia y retiro personal.
- Capturar monto, moneda, fecha, concepto/categoría, cuenta o medio de pago y comprobante opcional.
- Distinguir «pagado» de «pendiente»: cargar una factura no descuenta caja por sí solo; registrar un gasto ya pagado crea las relaciones correspondientes una sola vez.
- Mostrar envío, reserva o reparto calculado como pendiente cuando todavía no se haya pagado/transferido.
- Presentar saldos con su actualización; separar saldo reportado por una fuente de saldo reconstruido por movimientos cuando difieran.
- Mostrar disponible estimado con desglose de descuentos, cobertura de datos y limitaciones.
- Habilitar revisión de conciliaciones, obligaciones vencidas, importes faltantes y reglas bloqueadas.
- Incorporar exportación básica validada, instalación PWA y pruebas en un iPhone real.
- Definir comportamiento sin conexión: como mínimo indicar que no se guardó; si se habilitan borradores locales, distinguirlos de registros confirmados y sincronizarlos sin duplicación.

**Entregable:** piloto privado operativo con importación y captura manual.

**Puerta de salida:** Rafa completa los flujos diarios, recarga la app sin perder registros y verifica cifras contra las fuentes. La restauración de un respaldo está probada y el acceso no autorizado se rechaza.

### Etapa 3 — Automatizar captación sin perder control

**Objetivo:** reducir tareas manuales sobre un modelo financiero ya validado.

**Orden propuesto, condicionado a permisos y valor comprobado:**

1. **Shopify + Mercado Pago:** pedidos, cobros, comisiones reales, devoluciones y liquidaciones. Relacionar fuentes; no convertir automáticamente cada registro en ingreso.
2. **Bancos/Santander:** sincronización únicamente si hay acceso autorizado viable; en caso contrario, importador de extractos con conciliación asistida.
3. **Correo y comprobantes:** ingesta autorizada, adjuntos y extracción propuesta; importes/fechas ambiguos van a revisión. Resolver la fuente de facturas y pendientes de UES.
4. **Meta Ads:** únicamente gasto publicitario, cargos y comprobantes; relacionarlos con pagos bancarios o de tarjeta.

Cada conector debe tener estado visible, fecha de última sincronización correcta, reintentos seguros, paginación, deduplicación, tratamiento de cambios/devoluciones y aviso de fallos. Una falla no borra información previa ni permite mostrar datos viejos como actualizados.

Los secretos viven en servidor; se usan permisos mínimos y se permite revocar el acceso. No se supone que exista una API bancaria disponible ni se promete un acceso antes de probarlo.

**Entregable:** conectores habilitados individualmente y cola de excepciones común.

**Puerta de salida por conector:** permisos verificados, importes contrastados con la fuente, reejecución sin duplicados, recuperación ante fallos y alternativa manual documentada. Una prueba simulada no acredita conexión real.

### Etapa 4 — Costos, repartos y decisiones

**Objetivo:** pasar de controlar caja a comprender márgenes y distribuir resultados con reglas confiables.

**Trabajo:**

- Crear catálogo de productos, recetas/componentes y precios de insumos con vigencia.
- Separar compra de material (caja), existencia/consumo estimado y costo reconocido; no implementar inventario físico exacto.
- Recalcular costos y márgenes estimados futuros cuando cambia un insumo, sin reescribir ventas históricas cerradas.
- Reproducir fórmulas de las hojas aprobadas; no clasificar mayorista/minorista solo por unidades.
- Incorporar reparto, reinversión y ahorro con porcentaje, beneficiario, regla aplicada y estado de transferencia.
- Registrar costo de envío, responsable, vencimiento y pago: retiro, DAC y UES no se tratan igual.
- Mantener publicidad, impuestos y gastos generales separados del producto salvo criterio explícito de asignación.
- Alertar sobre deterioro de margen y proponer revisión, sin cambiar precios ni ejecutar transferencias.

**Entregable:** costos y repartos explicables por venta, con estimaciones señaladas y obligaciones/reservas relacionadas.

**Puerta de salida:** ejemplos mayoristas y minoristas coinciden con las hojas tras resolver discrepancias; una compra de insumos no se cuenta dos veces y una reserva ejecutada deja de descontarse como pendiente.

### Etapa 5 — Informes y consolidación de la operación

**Objetivo:** operar con confianza y facilitar revisión contable y seguimiento del negocio.

**Trabajo:**

- Informes por período de caja, cobros, pagos, cuentas por cobrar/pagar y resultado económico según reglas aprobadas.
- Desglose de cifras hasta la operación y su evidencia; filtros por cuenta, moneda, canal, categoría y estado.
- Exportaciones acordadas con el contador; XLSX solo si aporta valor y se valida.
- Alertas accionables y, si iOS y los permisos lo permiten, notificaciones PWA; la bandeja interna funciona sin push.
- Mejorar recuperación, monitoreo de conectores, permisos y auditoría a partir del uso real.
- Documentar soporte, responsables de revisar excepciones y procedimiento de corrección/cierre.

**Entregable:** versión consolidada y guía de operación.

**Puerta de salida:** revisión de un período completo con Rafa, diferencias explicadas, exportación útil para el contador y recuperación probada. El cierre y sus reglas deben acordarse; no se presenta como contabilidad fiscal completa.

## 4. Mapa de pantallas

| Pantalla | Pregunta que responde | Contenido prioritario | Momento |
|---|---|---|---|
| Inicio financiero | ¿Cómo estoy hoy? | Saldos, obligaciones, reservas, disponible estimado, alertas y actualización | MVP |
| Movimientos | ¿Qué pasó con el dinero? | Entradas/salidas, transferencias, retiros, fuentes y conciliación | MVP |
| Cuentas | ¿Dónde está? | Santander/otras cuentas, MP, efectivo, moneda y verificación | MVP |
| Egresos y comprobantes | ¿Qué gasté y qué falta pagar? | Gastos, facturas, evidencia, vencimientos y pagos parciales | MVP |
| Ventas y costos | ¿Qué vendí, cobré y gané? | Venta/cobro básico primero; recetas, margen y reparto después | MVP → etapa 4 |
| Pendientes y decisiones | ¿Qué necesita mi intervención? | Duplicados dudosos, pagos vencidos, información incompleta y reglas pendientes | MVP |
| Informes | ¿Cómo evolucionó el negocio? | Flujo de caja separado de resultado, exportaciones y trazabilidad | Exportación MVP → etapa 5 |
| Configuración | ¿Con qué reglas opera? | Cuentas, categorías, usuarios, reglas versionadas y conexiones | Base MVP → evolución |

En móvil, priorizar Inicio, Movimientos, Registrar y Pendientes; las demás pantallas pueden estar en navegación secundaria. Es una propuesta de experiencia a probar, no una obligación de diseño.

## 5. Modelo de datos mínimo propuesto

- **Cuentas y movimientos:** cuenta/medio de pago, saldo verificado y fecha de corte, movimiento, transferencia interna, retiro personal.
- **Operación comercial:** venta/pedido, línea de venta, cliente si corresponde, cobro, devolución y comisión.
- **Compromisos y gastos:** comprobante, gasto/devengamiento, obligación, pago y sus aplicaciones parciales.
- **Costos y distribución:** producto, receta, costo de insumo, consumo estimado, regla versionada, reparto y reserva.
- **Trazabilidad:** registro de origen, lote de importación, evidencia, vínculo de conciliación, usuario y evento de auditoría.

Campos comunes cuando correspondan: identificador interno, fuente e identificador externo, fechas relevantes, moneda, importe, concepto, estado, evidencia, autor y fechas de creación/modificación. Un dato ausente no se convierte en cero.

Mantener separados los estados de cada dimensión: confirmación del dato, conciliación, cobro/pago y producción/entrega. Una venta entregada no implica una venta cobrada; una casilla de reparto pendiente no significa necesariamente deuda del cliente.

**Arquitectura propuesta:** PWA → backend privado → base relacional y almacenamiento privado de comprobantes; importadores/conectores alimentan el mismo flujo de normalización y conciliación. Validar tecnología y despliegue antes de implementar; no adoptar almacenamiento local del navegador como única fuente financiera.

## 6. Reglas: confirmado en el brief versus pendiente de validación

| Tema | Tratamiento previsto |
|---|---|
| Material mayorista +10 % | Reproducir como regla observada y contrastar con ejemplos reales; no asumir que aplica a todos los productos/canales |
| Reinversión mayorista | Bloqueada como regla única: resolver 25 % vs. 30 % y excepciones |
| Reparto 60/40 | Configurable según venta/vendedor; validar ventas sin vendedor remunerado |
| Ahorro personal 15 % | Cálculo separado de la transferencia efectiva; validar su efecto sobre disponible |
| Comisión MP 10,35 % | Solo referencia estimada identificada; preferir comisión real por operación |
| Reinversión minorista 50 % | Regla habitual a contrastar, no porcentaje universal inmutable |
| Envío gratis sobre $2.500 | Validar condiciones, vigencia, moneda y tratamiento del límite exacto; gratis para cliente no implica costo cero para LANDUR |
| Monotributo sin IVA | Situación declarada; no crear IVA ni obligaciones futuras por supuesto |
| Reserva/reinversión/reparto | Acordar reconocimiento y efecto en disponible; no equivalen automáticamente a gastos operativos |

## 7. Cálculos que deben explicarse en la interfaz

**Disponible estimado por moneda** = saldos accesibles y verificados incluidos − obligaciones/reservas pertinentes pendientes, sin solapamientos.

La política de qué compromisos entran y con qué horizonte debe acordarse. Una obligación ya pagada y reflejada en saldo no se vuelve a descontar. Un cobro esperado no se presenta como dinero accesible.

Ejemplo ilustrativo del brief: $60.000 de saldo verificado menos $1.490 de envío pendiente = **$58.510 disponibles estimados**, únicamente si no hay otros compromisos/reservas aplicables y ambos importes están en la misma moneda. La app debe mostrar esos supuestos.

**Flujo de caja** observa entradas y salidas monetarias. **Resultado económico** considera ingresos y costos reconocidos del período. Las transferencias internas no generan resultado; los retiros personales se muestran separados de los costos operativos. Si faltan costos o criterios de reconocimiento, no se muestra una ganancia definitiva.

## 8. Casos mínimos de aceptación

| Caso | Resultado esperado |
|---|---|
| Pedido Shopify + cobro MP + transferencia Santander | Una venta y su ingreso reconocido según la regla aprobada; cobro y traslado asociados, sin tres ingresos ni triple caja |
| Liquidación MP de varias ventas con comisión | Importe neto explicado por operaciones, comisión y ajustes; diferencias sin explicar pendientes |
| Factura UES + pago posterior | Una obligación/gasto según devengamiento acordado; pago reduce deuda y caja sin duplicar gasto |
| Pago parcial de factura | Solo se reduce el saldo pendiente por el importe aplicado |
| Registro Meta + cargo bancario | Un gasto publicitario asociado al pago, sin métricas de campañas |
| Santander → efectivo | Baja una cuenta, sube la otra; total de fondos no aumenta y no aparece gasto |
| Retiro personal | Se identifica como retiro, no como gasto operativo |
| Gasto sin factura desde iPhone | Se guarda con cuenta, importe y concepto; comprobante opcional y trazabilidad de autor |
| Reimportación o webhook repetido | No se crean operaciones adicionales |
| Misma fecha/importe en dos movimientos legítimos | No se fusionan automáticamente por una coincidencia débil |
| Cambio de precio de insumo | Cambian estimaciones futuras; historia cerrada permanece trazable |
| Regla mayorista no validada | Reparto pendiente, sin inventar un porcentaje |
| Saldo desactualizado o cuenta sin verificar | Disponible parcial/limitado claramente señalado |
| Compra de materiales y posterior fabricación | Caja y costo reconocido separados, sin doble gasto |
| Devolución posterior al cobro | Venta, reversión y devolución de dinero vinculadas; diferencia temporal visible |
| Acceso no autorizado y restauración | Datos privados inaccesibles; respaldo recuperable y contrastable |

## 9. Cómo medir si aporta valor

Tomar una línea base durante la validación y acordar metas después, sin inventar porcentajes de ahorro:

- Tiempo real para registrar un gasto desde el iPhone.
- Tiempo semanal dedicado a copiar y conciliar operaciones.
- Cantidad y antigüedad de movimientos pendientes de revisión.
- Diferencias no explicadas entre saldos y fuentes.
- Cobertura y antigüedad de los datos usados para calcular disponible.
- Duplicados confirmados y errores en repartos.
- Uso cotidiano por Rafa y utilidad de las exportaciones para el contador.

La cantidad de integraciones conectadas no es por sí sola una medida de éxito.

## 10. Fuera de alcance

Gestión u optimización de campañas, ROAS/conversiones, cambios autónomos de anuncios o precios, ejecución automática de pagos/transferencias, facturación fiscal completa, inventario físico exacto, widgets nativos de iPhone y reglas tributarias futuras no confirmadas.

## 11. Próximo bloque de trabajo recomendado

1. **RIVECT + Rafa:** revisar las decisiones pendientes y autorizar muestras reales de datos.
2. **RIVECT:** preparar diccionario de entidades, estados, relaciones y reglas versionadas.
3. **RIVECT + Rafa/contador cuando corresponda:** fijar resultados esperados de los casos de aceptación y criterios de disponible/costos.
4. **RIVECT:** construir importación y pruebas del núcleo financiero; en paralelo, diseñar Inicio y captura rápida móvil.
5. **RIVECT + Rafa:** probar un recorrido completo: importar venta → asociar cobro → registrar traslado → cargar envío pendiente → ver disponible → pagar envío sin duplicar gasto.
6. Estimar esfuerzo, costos de operación y calendario por etapa cuando se conozcan muestras, accesos y capacidad del equipo.

**Recomendación de prioridad:** primero números confiables; después utilidad diaria en iPhone; después automatización; finalmente profundidad de costos e informes. No esperar a todas las integraciones para aportar valor, ni publicar un panel convincente que todavía cuente mal.
