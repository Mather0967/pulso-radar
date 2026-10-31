# LANDUR — Contrato inicial de API y CSV

Base: mismo origen que la PWA. En modo portal, anteponer `/landur` a las rutas siguientes (por ejemplo `/landur/api/state`); sesión `rivect_session` y encabezado `X-CSRF-Token` del portal. Las rutas de login/demo standalone no están habilitadas en modo portal. JSON, `Cache-Control: no-store`, autenticación mediante cookie propia. Nunca llamar a `localhost` desde el iPhone publicado.

## Rutas

| Método/ruta | Uso |
|---|---|
| `GET /api/session` | Estado de acceso y modo demo, sin información financiera |
| `POST /api/login` | `{password}`; solo en modo privado |
| `POST /api/logout` | Invalida la sesión actual |
| `POST /api/demo` | Solo en instancia sintética; crea un espacio separado por visitante |
| `GET /api/state` | Cuentas, operaciones, movimientos, agregados por moneda y auditoría |
| `POST /api/commands` | Registra una operación atómica con `Idempotency-Key`; tope de 120 por minuto y por sesión |
| `POST /api/import/preview` | `{csv}`; valida dentro de transacción revertida, sin guardar |
| `POST /api/import/commit` | `{csv}` y `Idempotency-Key`; lote atómico, deduplicación adicional por fila |
| `GET /api/export.csv` | CSV de operaciones de todas las monedas del espacio, no del filtro visual |
| `POST /api/evidence` | `{operationId, name, mime, data}`; adjunta un comprobante, con `Idempotency-Key` |
| `GET /api/evidence/<id>` | Devuelve el archivo; solo el espacio dueño puede leerlo |

Mutaciones: `Content-Type: application/json`, `X-Landur-Request: 1` y origen permitido. La clave idempotente debe reutilizarse al reintentar **la misma operación**, no generar otra cuando se pierde una respuesta. El servidor devuelve conflicto si la clave existe con un contenido diferente.

## Tipos de comando

- `account`: `name`, `accountKind` (`bank`, `wallet`, `cash`), `currency`, `opening`, `cutoff`, `verified`, `accessible`.
- `expense`, `withdrawal`: `concept`, `amount`, `currency`, `date`, `accountId`; categoría opcional.
- `obligation`: `concept`, `amount`, `currency`, `date`, `due`; no mueve caja.
- `sale`: `concept`, `amount`, `currency`, `date`; no mueve caja.
- `payment`: campos comunes y `accountId`, `targetId` (obligación pendiente).
- `collection`: campos comunes y `accountId`, `targetId` (venta pendiente), `commission` explícita.
- `transfer`: campos comunes y `accountId`, `toAccountId` de igual moneda.
- `reversal`: `operationId`, `date`. Registra el contra-asiento de una operación existente. No borra ni edita la original: la marca como revertida, invierte sus movimientos de cuenta, desactiva su aplicación si la tenía y, cuando corresponde, revierte también la comisión del cobro. Se rechaza si ya fue revertida, si es una reversión, o si algo se apoya en ella sin revertir.
- `evidence.remove`: `evidenceId`. Elimina un comprobante adjunto. No toca importes ni la operación a la que estaba ligado: el archivo simplemente desaparece y la baja queda auditada con autor y fecha. Responde 404 si no existe o si pertenece a otro espacio, también cuando ya se borró. Reutilizar la misma `Idempotency-Key` devuelve la respuesta original en lugar de repetir la operación.
- `account.delete`: `accountId` y, cuando la cuenta tiene movimientos, `mode` obligatorio. Sin `mode`, una cuenta **sin movimientos** se elimina y punto; si tiene entradas de dinero se responde 409 y nada cambia. Las tres formas de resolver una cuenta con historial son explícitas:
  - `mode: 'move'` + `toAccountId`: traslada todas las entradas a esa cuenta y elimina la original. Las dos cuentas tienen que compartir moneda (no hay conversión automática); el saldo inicial se suma y el corte queda en el más antiguo de los dos, para que el total del espacio no cambie. Auditoría `account.merged` con la cuenta de origen, el saldo combinado y la cantidad de movimientos.
  - `mode: 'move'` + `newAccount: {name, accountKind?}`: crea una cuenta con ese nombre y los mismos tipo, moneda, saldo inicial y corte de la original, traslada allí los movimientos y elimina la original. Misma auditoría `account.merged`.
  - `mode: 'purge'` + `confirm: true` + `confirmName` con el **nombre exacto** de la cuenta: elimina la cuenta y **todo lo asociado**: operaciones con movimiento en ella (gastos, transferencias, retiros, pagos, cobros), sus aplicaciones, obligaciones, comisiones, contra-asientos y comprobantes adjuntos. Antes de borrar, la auditoría guarda una copia completa de las filas eliminadas (operaciones, entradas, aplicaciones, obligaciones y metadatos de comprobantes); el contenido de los archivos no se conserva. Auditoría `account.purged` y `account.deleted`. En el montaje del portal, además, se pide la **contraseña de la cuenta** (`password`): se verifica contra el almacén de identidad y se descarta antes de ejecutar el comando, así que no entra ni en la auditoría ni en la clave de idempotencia. Sin las tres condiciones, la respuesta es 400 o 403 y no se toca nada.

Estos son los borrados del sistema y son deliberadamente explícitos: nada se borra por omisión, y una operación financiera sigue sin poder borrarse por separado del historial de su cuenta. Lo que se pone mal en un registro se corrige con `reversal` y volviendo a cargar; lo que se pone mal en un comprobante se quita y se vuelve a adjuntar; una cuenta se elimina vacía, trasladando su historial o confirmando el borrado de ese historial. Nada de esto altera una cifra de forma silenciosa: cada baja queda en la auditoría con su autor y su fecha.

Importes de entrada como strings decimales, sin miles, hasta dos decimales; respuesta monetaria en unidades menores enteras. Monedas admitidas técnicamente: UYU, USD y BRL, separadas sin conversión. Esto no confirma cuáles usa LANDUR en producción.

## Comprobantes

`data` es base64 (con o sin prefijo `data:`). El archivo vive dentro de la misma base privada, así que el respaldo y la restauración ya probados lo incluyen sin un directorio adicional ni permisos nuevos en el hosting.

- **Admitidos:** JPEG, PNG, WebP y PDF, hasta 1.536 KB por archivo.
- **El tipo lo deciden los bytes**, no la etiqueta del cliente: se comprueba la firma y que el archivo esté completo (cierre de imagen, chunk final o marcador de cierre). Una extensión mentirosa no pasa, y un archivo truncado tampoco.
- **El nombre** se guarda como etiqueta: se le quitan los caracteres de control y los separadores de ruta.
- **Descarga:** `Content-Type` del archivo guardado, `Content-Disposition` `inline` para imágenes y `attachment` para PDF, y `Cache-Control: no-store`. El tipo no lo decide el cliente.
- **No se borran con la reversión.** La reversión de una operación conserva sus comprobantes, porque son parte de la historia.
- **Baja explícita:** `evidence.remove` los elimina a pedido del usuario (mal cargados, equivocados). Es la única forma de quitarlos: queda auditado con autor y fecha, y no requiere reabrir la operación. Revertir no los restaura.
- **Límite:** 30 llamadas por minuto y por sesión, junto con la importación. Es el mismo tope en el servidor autónomo y en el montaje del portal.
- **Reintento:** reutilizar la `Idempotency-Key` devuelve el mismo comprobante; usarla con otro archivo genera conflicto.
- **Alcance:** solo se adjunta a una operación existente del propio espacio. Una lectura ajena responde 404, igual que un identificador inexistente.

Los comprobantes no son una validación de contenido: el servidor comprueba estructura y tamaño, no que la imagen corresponda al gasto. Eso sigue siendo una revisión del usuario.

La clave de idempotencia se guarda **por usuario**: dos cuentas pueden usar el mismo valor sin recibir la respuesta de la otra, y reintentar con la misma clave sigue devolviendo el resultado original. Las claves de comando se descartan solas a los 30 días; las de importación (`csvrow-…`) se conservan porque son la memoria de duplicados de cada referencia externa.

Los registros tienen origen manual por defecto y pueden llevar `source`/`externalId`. Una referencia externa repetida no se confirma automáticamente si hay discrepancias. La corrección se hace revirtiendo y registrando de nuevo, nunca editando el registro original: la historia se conserva y cada reversión queda auditada con su autor y su fecha. Un registro equivocado, por lo tanto, **no se borra**: se anula con `reversal`. Las excepciones son `evidence.remove`, `account.delete` de una cuenta vacía o con su historial trasladado y `account.delete` con `mode:'purge'`, que sí elimina los movimientos de esa cuenta con confirmación explícita y dejando copia en la auditoría.

## Plantilla CSV propuesta

UTF-8, delimitador coma, encabezados exactos:

```csv
kind,date,concept,amount,currency,account_id,due,source,external_id,category
sale,2026-10-24,EJEMPLO SINTÉTICO,100.00,UYU,,,hoja-ejemplo,EJEMPLO-001,Ventas
```

- Máximo 100 KB y 200 filas de datos.
- `kind`: `expense`, `obligation`, `sale` o `withdrawal`.
- `source` y `external_id`: obligatorios, estables y únicos para la operación original.
- `account_id`: UUID de una cuenta de este espacio; obligatorio para gasto pagado/retiro, vacío para venta/obligación. Se muestra en Cuentas.
- `due`: fecha ISO para obligación; vacío para otros tipos.
- `amount`: usar punto decimal; si se usa coma decimal, encerrar la celda entre comillas conforme al formato CSV.
- Una fila inválida revierte todo el lote. La vista previa no reserva IDs ni persiste auditoría.
- Reimportar una fila idéntica devuelve «ya existe». Reusar su origen/referencia con datos distintos genera un conflicto para revisión, no una actualización silenciosa.
- Las filas legítimas con misma fecha e importe pero diferentes referencias no se fusionan.

El export de operaciones tiene un esquema de auditoría distinto de la plantilla de importación. **No es un respaldo restaurable ni debe reimportarse directamente.** La exportación neutraliza prefijos de fórmulas en campos de texto y conserva moneda/referencias.

Las hojas reales y la aceptación del contador siguen pendientes. Esta plantilla no equivale a un importador universal de Excel, Shopify o bancos.
