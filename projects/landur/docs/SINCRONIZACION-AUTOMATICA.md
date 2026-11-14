# Sincronización automática con Google Sheets

Objetivo: que lo que se carga en la planilla aparezca en LANDUR solo, en segundos, y que quede igual
a la planilla (importes, fechas, filas editadas, borradas o canceladas).

## Cómo funciona

```
Planilla (Apps Script)  ──aviso──▶  POST /landur/api/hooks/sync  ──▶  sincronía (lee la planilla, concilia)
  · al editar una celda                 (token)                        · junta avisos seguidos
  · al agregar/borrar filas                                            · nunca corre dos a la vez
  · latido cada 5 minutos                                              · mínimo 15 s entre corridas
Reloj interno de LANDUR (cada LANDUR_SYNC_MINUTES = 15, solo lo vencido) ──┘
Botón «Sincronizar ahora» (Conexiones) ─────────────────────────────────┘ (comparte la corrida en curso)
```

Passenger puede apagar el proceso por inactividad: por eso el disparo confiable es el aviso externo (el
latido de 5 minutos de la planilla también lo despierta). El reloj interno solo cubre el tiempo en que
el proceso ya está vivo: sincroniza **Sheets, Shopify y Meta** cuando están vencidos (`lastSync`, cada
`LANDUR_SYNC_MINUTES`, 15 por defecto) y hace una pasada apenas arranca el proceso. No repite lo que acaba de
sincronizar un aviso.

## Puesta en marcha (una sola vez)

1. **Planilla.** Usar la plantilla [`plantilla/plantilla-ventas-landur.xlsx`](plantilla/) (en Drive:
   «LANDUR · Ventas (plantilla sincronizable)»). Se regenera con `python docs/plantilla/generar-plantilla.py`.
2. **Compartirla** (lector) con el correo de la cuenta de servicio de Google (`…@…iam.gserviceaccount.com`).
3. **Token en el servidor.** En cPanel → Setup Node.js App → variables de entorno:
   `LANDUR_SYNC_TOKEN` = 32 caracteres o más al azar (por ejemplo `openssl rand -hex 24`). Reiniciar la app.
   Sin esta variable la ruta del aviso no existe.
4. **Conexión en LANDUR** (Conexiones → Google Sheets): pestaña `Ventas`, mes vacío, cuenta, moneda,
   cuenta de servicio. El saldo inicial (corte) de la cuenta debe ser anterior a la venta más vieja.
5. **Apps Script de la planilla.** Extensiones → Apps Script → pegar [`plantilla/apps-script.gs`](plantilla/apps-script.gs)
   (también está en la pestaña «Instrucciones»). Poner la URL real y el token en `configurar()` y ejecutarla;
   después ejecutar `instalar()` y aceptar los permisos. Borrar el token del código.

## La planilla definitiva y su traspaso a Rafa

La planilla de Drive «LANDUR · Ventas (planilla sincronizable)» ya trae todos los datos disponibles (20 ventas: minorista de
septiembre y noviembre y mayorista de octubre y noviembre). Pestañas: **Ventas** (lo que lee LANDUR), **Resumen** (qué tiene que
mostrar LANDUR: ventas, gastos y saldo), **Importar con IA** (texto para pegarle a una IA y cargar los datos reales) e
**Instrucciones**. En Ventas las columnas que se escriben van contiguas (A a P) y las fórmulas al final (`MP Neto`,
`Ganancia Bruta`, `Control`), así pegar una tabla nunca pisa una fórmula; `Control` dice OK por fila.

Las filas con Notas «Provisorio» (la mayorista, que no trae día ni número de pedido) son datos de muestra: Rafa las reemplaza
por las reales. Borrar o corregir una fila no rompe nada: LANDUR revierte lo suyo.

**Para entregarla** (quien administra LANDUR, una sola vez, antes de transferirla):
1. Compartirla con la cuenta de servicio de Google (lector). El permiso **sobrevive** al cambio de dueño.
2. En LANDUR: conexión de Sheets con pestaña `Ventas`, mes vacío, la cuenta y la cuenta de servicio.
3. Transferir la propiedad a Rafa (Compartir → su correo → «Transferir propiedad»).

Después del traspaso no hay que tocar nada en LANDUR ni recargar datos: la conexión apunta a la planilla, no a su dueño, y LANDUR la
lee solo cada `LANDUR_SYNC_MINUTES`. Lo único que no se traspasa es el **Apps Script opcional** (tiempo real): sus disparadores
quedan a nombre de quien los instaló, así que si se usa, Rafa ejecuta `instalar()` una vez.

## Con el formato actual de la planilla de Rafa (sin pedirle nada)

LANDUR lee su planilla tal cual está; no hace falta que cambie ninguna columna ni que instale nada:

- **Conexión:** pestañas `minorista, mayorista` (una sola conexión lee las dos; hasta 4), mes de la planilla = el año y mes
  actuales (por ejemplo `2026-11`: de ahí sale el año de «Setiembre 16»), la cuenta y la cuenta de servicio.
- **Fechas:** entiende el día suelto (8, 9), el mes escrito en la primera fila de un tramo («Setiembre 16», «Octubre») y lo
  aplica a las filas siguientes. La mayorista no trae día: se fecha el 1 del mes y la tarjeta dice cuántas filas fueron así.
- **Cobro:** lo decide la columna «Transf.». En la minorista, con TRUE y comisión (`MP Fee`/`MP Neto`). En la mayorista, que
  no tiene comisión, con TRUE el cobro entra completo.
- **Casi tiempo real sin Apps Script:** el reloj interno lee las pestañas cada `LANDUR_SYNC_MINUTES`. Con `2` o `3` los cambios
  aparecen en pocos minutos y solo hace falta que la cuenta de servicio pueda leer la planilla.
- **Lo único que ningún código resuelve:** que la planilla que se lee esté **viva y legible**. Un fragmento copiado una vez no se
  actualiza solo; tiene que ser la planilla real (o una vista conectada con `IMPORTRANGE`) y legible con el enlace o compartida con la
  cuenta de servicio.

## Probarlo

```bash
curl -sS -X POST -H "Authorization: Bearer $LANDUR_SYNC_TOKEN" "https://TU-DOMINIO/landur/api/hooks/sync?wait=1"
```

Con `?wait=1` espera la sincronía (hasta 25 s) y devuelve el resultado: `result.ok`, `result.created`,
`result.reverted`, `result.errors` y `result.totals` (lo que suma la planilla contra lo que quedó en LANDUR).
Sin `wait` responde `202` enseguida. `401` = token incorrecto; `404` = sin `LANDUR_SYNC_TOKEN` en el servidor;
`429` = demasiados intentos con token malo (20 por minuto).

Para dejarlo funcionando aunque se borre el Apps Script, un cron de cPanel hace lo mismo:

```bash
*/5 * * * * curl -fsS -X POST -H "Authorization: Bearer TOKEN" https://TU-DOMINIO/landur/api/hooks/sync >/dev/null
```

(No tocar el cron ni el instalador de Pulso: es otro cron.)

## Qué hace la sincronía con los cambios

- Fila nueva → venta (+ material y envío). El **cobro** lo decide la columna «Transf.»: con TRUE y comisión (`MP Fee` o
  `MP Neto`) se registra; sin TRUE la venta queda pendiente de cobro. Si la planilla desmarca «Transf.», el cobro se revierte.
- Importe, fecha, comisión o estado cambiados → se **revierte** lo asentado y se registra lo nuevo.
- Fila borrada, pedido pasado a Cancelado o con otro Nro. Pedido → se **revierte**.
- Nada se borra: las reversiones quedan en el historial de LANDUR. Lo rehecho lleva otra referencia (`row-X-r2`, `row-X-cobro-r2`…).
- Una venta que **eliminaste en LANDUR** y sigue en la planilla no vuelve sola: la tarjeta de Conexiones pregunta «¿Querés
  agregarlas también?» (`restoreDeleted`). Rehacer lo que la propia sincronía acaba de revertir por un cambio de la planilla sí es automático.
- No se revierte nada si la pestaña perdió más de la mitad de sus filas (aviso), si alguna fila no se pudo leer
  en esa pasada, ni si la venta tiene un cobro cargado a mano.
- Cada resultado trae `totals`; si la planilla y LANDUR no suman lo mismo, la tarjeta de Conexiones lo dice.

## Operación

- Una falla (planilla sin compartir, token de Google vencido, etc.) no tumba nada: queda en la auditoría
  (`sync.sheets.error`, una vez por mensaje distinto) y la próxima corrida reintenta.
- Mantener **un solo proceso** de Passenger para LANDUR: dos procesos escribirían la misma base SQLite.
- `LANDUR_SYNC_MINUTES=0` apaga el reloj interno; el aviso de la planilla sigue funcionando.
- Si el saldo inicial de la cuenta es posterior a las fechas de la planilla, la venta entra pero no su cobro ni sus gastos: la
  tarjeta lo avisa **una sola vez** con la fecha más vieja y a qué fecha mover el saldo inicial.
