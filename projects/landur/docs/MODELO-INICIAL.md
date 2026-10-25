# Modelo inicial propuesto — pendiente de validación

Diseño inicial del día 1. Existe una implementación parcial en `server/ledger.mjs`; no todas las entidades o transiciones de esta propuesta están implementadas. No fija stack ni resuelve las decisiones financieras abiertas. Todas las entidades se restringen al espacio autorizado de LANDUR.

## Entidades del piloto

| Entidad | Responsabilidad | Relaciones/invariantes |
|---|---|---|
| Cuenta | Banco, MP o efectivo; moneda y accesibilidad | Una moneda explícita; no equivale a ingreso |
| Saldo verificado | Importe, fecha de corte, fuente y evidencia | No sumar saldo inicial y movimientos anteriores al mismo corte |
| Movimiento | Entrada/salida efectiva de una cuenta | Vincular al hecho económico correspondiente; fecha, moneda, importe y origen |
| Venta | Pedido/venta con importe y estado comercial | Puede tener varios cobros; no implica dinero recibido |
| Cobro y aplicación | Dinero recibido aplicado a una o varias ventas | Separar bruto, comisión y neto cuando se conozcan; diferencias pendientes |
| Gasto | Hecho económico con categoría y fecha relevante | Puede existir sin comprobante; no demuestra pago |
| Comprobante | Evidencia privada opcional | Archivo autorizado, no una segunda contabilización del gasto |
| Obligación | Importe adeudado, beneficiario y vencimiento | Pagos parciales reducen el pendiente, no crean un segundo gasto |
| Pago y aplicación | Salida efectiva y su aplicación a obligaciones | Evitar doble aplicación/sobreaplicación concurrente |
| Transferencia interna | Relación entre salida y entrada propias | Efectos atómicos; no genera resultado; no inferir conversión de monedas |
| Retiro personal | Salida del negocio a titular | No clasificar como costo operativo |
| Reserva | Compromiso explícito con estado y motivo | Política de disponible pendiente; evitar solapamiento con obligación |
| Reversión/devolución | Ajuste vinculado al registro original | No borrar historia ni asumir devolución de dinero por cancelar una venta |
| Registro de origen/lote | Fuente, ID externo, fila y resultado de importación | Idempotencia por identificador fiable; similitud sola no autoriza fusionar |
| Conciliación | Relaciones, evidencia, decisión y autor | Confirmada o pendiente; deshacer de forma auditable |
| Usuario/evento de auditoría | Acceso y cambios relevantes | Autor, fecha, acción y referencia; no registrar secretos |

## Estados separados

- Confirmación del dato: pendiente de revisión / confirmado / estimado, según corresponda.
- Conciliación: pendiente / conciliado / diferencia por revisar.
- Cobro/pago: pendiente / parcial / completo; derivado de aplicaciones válidas.
- Producción/entrega: independiente de los estados financieros.

Validar las transiciones y anulaciones antes de implementarlas; no usar un único estado genérico que confunda entrega con cobro.

## Campos y precisión

Identificador interno; fuente e identificador externo cuando existan; fechas de operación/registro/vencimiento según entidad; moneda; importe; concepto; estado; evidencia opcional; autor y marcas de creación/modificación. Importes exactos, nunca cálculos financieros basados en coma flotante binaria sin control de precisión. Un desconocido permanece desconocido, no se transforma en cero.

## Casos de contrato del núcleo

1. Venta + cobro MP + traslado al banco: una venta y movimientos asociados, no tres ingresos.
2. Factura + pago parcial + saldo restante: gasto sin duplicación, pendiente consistente.
3. Banco a efectivo: total propio sin cambios, ninguna ganancia nueva.
4. Reimportación/doble envío: mismos registros financieros después de repetir la petición.
5. Pago concurrente: no aplicar dos veces el mismo saldo pendiente.
6. Reserva y obligación relacionadas: no descontar ambas por el mismo compromiso.
7. Cobro con comisión desconocida: no completar automáticamente con 10,35 % como dato real.
8. Reversión: evidencia conservada y movimientos financieros solo si efectivamente ocurrieron.
9. Saldo desactualizado o moneda distinta: mostrar limitación, no disponible global engañoso.
10. Acceso indebido: rechazar consulta/modificación de datos y archivos privados.

Cada caso requiere fixtures sintéticos identificados y luego contraste con muestras autorizadas. Hay pruebas sintéticas ejecutables para parte de estos casos en `tests/ledger.test.mjs`; reversión, reservas y validación con muestras reales siguen pendientes. No interpretar esta lista como una aceptación completada.
