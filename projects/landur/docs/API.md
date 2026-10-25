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
| `POST /api/commands` | Registra una operación atómica con `Idempotency-Key` |
| `POST /api/import/preview` | `{csv}`; valida dentro de transacción revertida, sin guardar |
| `POST /api/import/commit` | `{csv}` y `Idempotency-Key`; lote atómico, deduplicación adicional por fila |
| `GET /api/export.csv` | CSV de operaciones de todas las monedas del espacio, no del filtro visual |

Mutaciones: `Content-Type: application/json`, `X-Landur-Request: 1` y origen permitido. La clave idempotente debe reutilizarse al reintentar **la misma operación**, no generar otra cuando se pierde una respuesta. El servidor devuelve conflicto si la clave existe con un contenido diferente.

## Tipos de comando

- `account`: `name`, `accountKind` (`bank`, `wallet`, `cash`), `currency`, `opening`, `cutoff`, `verified`, `accessible`.
- `expense`, `withdrawal`: `concept`, `amount`, `currency`, `date`, `accountId`; categoría opcional.
- `obligation`: `concept`, `amount`, `currency`, `date`, `due`; no mueve caja.
- `sale`: `concept`, `amount`, `currency`, `date`; no mueve caja.
- `payment`: campos comunes y `accountId`, `targetId` (obligación pendiente).
- `collection`: campos comunes y `accountId`, `targetId` (venta pendiente), `commission` explícita.
- `transfer`: campos comunes y `accountId`, `toAccountId` de igual moneda.

Importes de entrada como strings decimales, sin miles, hasta dos decimales; respuesta monetaria en unidades menores enteras. Monedas admitidas técnicamente: UYU, USD y BRL, separadas sin conversión. Esto no confirma cuáles usa LANDUR en producción.

Los registros tienen origen manual por defecto y pueden llevar `source`/`externalId`. Una referencia externa repetida no se confirma automáticamente si hay discrepancias. La corrección/reversión todavía no está habilitada.

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
