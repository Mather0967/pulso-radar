# Sincronización automática con Google Sheets

Objetivo: que lo que se carga en la planilla aparezca en LANDUR solo, en segundos, y que quede igual
a la planilla (importes, fechas, filas editadas, borradas o canceladas).

## Cómo funciona

```
Planilla (Apps Script)  ──aviso──▶  POST /landur/api/hooks/sync  ──▶  sincronía (lee la planilla, concilia)
  · al editar una celda                 (token)                        · junta avisos seguidos
  · al agregar/borrar filas                                            · nunca corre dos a la vez
  · latido cada 5 minutos                                              · mínimo 15 s entre corridas
Reloj interno de LANDUR (cada LANDUR_SYNC_MINUTES, respaldo) ───────────┘
Botón «Sincronizar ahora» (Conexiones) ─────────────────────────────────┘ (comparte la corrida en curso)
```

Passenger puede apagar el proceso por inactividad: por eso el disparo confiable es el aviso externo (el
latido de 5 minutos de la planilla también lo despierta). El reloj interno solo cubre el tiempo en que
el proceso ya está vivo.

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

- Fila nueva → venta (+ cobro, material y envío).
- Importe, fecha, comisión o estado cambiados → se **revierte** lo asentado y se registra lo nuevo.
- Fila borrada, pedido pasado a Cancelado o con otro Nro. Pedido → se **revierte**.
- Nada se borra: las reversiones quedan en el historial de LANDUR.
- No se revierte nada si la pestaña perdió más de la mitad de sus filas (aviso), si alguna fila no se pudo leer
  en esa pasada, ni si la venta tiene un cobro cargado a mano.
- Cada resultado trae `totals`; si la planilla y LANDUR no suman lo mismo, la tarjeta de Conexiones lo dice.

## Operación

- Una falla (planilla sin compartir, token de Google vencido, etc.) no tumba nada: queda en la auditoría
  (`sync.sheets.error`, una vez por mensaje distinto) y la próxima corrida reintenta.
- Mantener **un solo proceso** de Passenger para LANDUR: dos procesos escribirían la misma base SQLite.
- `LANDUR_SYNC_MINUTES=0` apaga el reloj interno; el aviso de la planilla sigue funcionando.
