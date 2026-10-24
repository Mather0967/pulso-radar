# LANDUR PWA — Cómo subirla a Namecheap / cPanel

Versión 0.2.0 · 24 de octubre de 2026

## Antes de empezar: qué estás subiendo

Es una **alfa funcional de la PWA del sprint 1**, no el producto aprobado al final de las tres semanas. Incluye pantallas de Inicio, Movimientos, Cuentas, Egresos, Ventas, Pendientes y Configuración; registros guardados en servidor; pagos parciales; ventas/cobros; transferencias; importación/exportación CSV; instalación PWA y bloqueo offline.

**Todavía no habilitar operaciones con datos reales.** Quedan pendientes la validación con Rafa, reglas de disponible/reservas, adjuntos privados, correcciones/reversiones auditadas, autenticación/recuperación definitiva, aceptación en iPhone real y pentesting. El disponible permanece «Por validar»; no se elige un porcentaje de reinversión por suposición.

El usuario informó que dispone de la última versión de Node en su hosting. Igual se ejecuta la comprobación en el entorno exacto de Passenger para confirmar SQLite, permisos y rutas, no solo el número de versión.

Esta guía no solicita contraseñas ni tokens por chat. Los ejemplos `USUARIO_CPANEL` y `landur.tudominio.com` se reemplazan por los datos propios. No son rutas o dominios ya configurados.

---

## 1. Preparar el paquete correcto

Usar `landur-pwa-cpanel-0.2.0.zip`, generado por el proyecto, o la carpeta `projects/landur/` de la rama de trabajo.

El ZIP incluye exclusivamente código, recursos PWA, pruebas unitarias, documentación y scripts de servidor. **No incluye datos, contraseñas, `.env`, `node_modules`, imágenes de QA, sesiones ni respaldos.** La plantilla `.env.example` no contiene secretos ni se carga automáticamente.

Si se genera desde el repositorio:

```bash
cd projects/landur
npm ci
npm test
npm run test:browser
npm run package
```

`npm run package` requiere Python 3 en el equipo que arma el ZIP, no en el servidor. Las pruebas de navegador utilizan dependencias de desarrollo; no se necesitan en cPanel para ejecutar LANDUR. Si no se puede ejecutar Chromium en el equipo local, registrar la limitación, no marcar esa prueba como aprobada.

## 2. Crear un subdominio exclusivo y HTTPS

En **Domains / Dominios** de cPanel:

1. Crear un subdominio dedicado, por ejemplo `landur.tudominio.com`.
2. Confirmar que su DNS apunte al hosting correcto.
3. Habilitar certificado HTTPS mediante la opción SSL/AutoSSL disponible en el plan.
4. Activar redirección de HTTP a HTTPS.

LANDUR debe quedar en la raíz del subdominio: `https://landur.tudominio.com/`, **no** dentro de `/pulso` o `/landur` de otra app. Esto evita conflictos de rutas, cookies y service workers.

**No modificar el dominio, cron, aplicación Passenger ni despliegue de Pulso.**

## 3. Crear carpetas separadas

Desde File Manager o Terminal, preparar:

```text
/home/USUARIO_CPANEL/landur-app/          ← código de esta aplicación
/home/USUARIO_CPANEL/landur-private/data/ ← base de datos privada
/home/USUARIO_CPANEL/landur-backups/      ← respaldos privados
```

Ejemplo en Terminal, usando el home real de tu cuenta:

```bash
mkdir -p "$HOME/landur-app" "$HOME/landur-private/data" "$HOME/landur-backups"
chmod 700 "$HOME/landur-private" "$HOME/landur-private/data" "$HOME/landur-backups"
```

**Nunca subir bases, backups, contraseñas o código de servidor dentro de `public_html` ni de `public/`.**

## 4. Subir y extraer el ZIP

En File Manager:

1. Subir el ZIP a `/home/USUARIO_CPANEL/landur-app/`.
2. Extraerlo **en esa carpeta**. El ZIP no tiene una carpeta contenedora adicional.
3. Comprobar que exista `/home/USUARIO_CPANEL/landur-app/app.cjs`.
4. Verificar que también estén `package.json`, `package-lock.json`, `server/`, `public/`, `scripts/` y `tests/`.
5. Confirmar que `public/.htaccess` esté presente; activar «Show Hidden Files» para verlo.
6. Borrar o mover el ZIP fuera de cualquier carpeta pública después de extraerlo.

No subir todo `pulso-radar` encima de una aplicación existente.

## 5. Crear una aplicación Node separada

En **Setup Node.js App** de cPanel, crear una nueva aplicación:

| Campo | Valor |
|---|---|
| Node.js version | Versión instalada compatible, como mínimo 22.13 con `node:sqlite` |
| Application mode | Production, para el entorno privado de prueba |
| Application root | `landur-app` dentro del home |
| Application URL | El subdominio dedicado, en `/` |
| Application startup file | **`app.cjs`** |

Passenger es quien mantiene el proceso vivo. **No usar `npm start` como segundo servidor ni configurar un cron que arranque Node.**

El document root público debe apuntar exclusivamente a `landur-app/public/` o a una carpeta pública equivalente de la integración Node. Si el asistente de cPanel no lo deja así, verificarlo con el soporte del hosting antes de exponer la app. La raíz del código y el directorio de datos no deben ser navegables ni descargables.

Los menús y opciones exactos dependen del plan; la configuración final debe verificarse en ese cPanel. No editar manualmente las directivas Passenger generadas por el panel sin conocer su configuración.

## 6. Configurar las variables de entorno

En las variables de **esa aplicación Node**, definir:

```text
NODE_ENV=production
LANDUR_DEMO=0
LANDUR_PUBLIC_ORIGIN=https://landur.tudominio.com
LANDUR_DATA_DIR=/home/USUARIO_CPANEL/landur-private/data
LANDUR_BACKUP_DIR=/home/USUARIO_CPANEL/landur-backups
LANDUR_PASSWORD=<tu contraseña única de 16 a 256 caracteres>
```

- Reemplazar dominio y usuario por los reales. No usar los signos `< >` como parte del valor.
- `LANDUR_PUBLIC_ORIGIN` va **sin barra final**, sin ruta, sin usuario y sin contraseña.
- Crear el secreto con un gestor de contraseñas y configurarlo únicamente en cPanel.
- No definir `LANDUR_INSECURE_LOCAL=1` en el hosting.
- No es necesario publicar el puerto `3001`. Passenger gestiona el enlace HTTP.
- `LANDUR_DEMO=0` inicia un espacio vacío. Los datos sintéticos de la vista previa no se migran al espacio privado.

Por ahora existe un acceso de operador único; no equivale a un sistema de usuarios y recuperación aprobado. Reiniciar la app invalida sus sesiones privadas, incluso después de cambiar la contraseña.

## 7. Activar el Node correcto en Terminal

cPanel muestra un comando para entrar al entorno de la aplicación, similar a `source .../bin/activate`. **Copiar el comando exacto del panel**, no una ruta inventada.

Después:

```bash
cd "$HOME/landur-app"
node --version
npm ci --omit=dev
npm test
```

La ejecución no tiene dependencias externas de producción. `npm ci --omit=dev` usa el lockfile y evita instalar Chromium y Playwright en el hosting. No ejecutar `npm run test:browser` en cPanel salvo que se prepare explícitamente ese entorno de QA.

### Importante: variables en Terminal

Las variables del proceso Passenger **pueden no estar disponibles en la terminal**, aunque actives el entorno Node. Para probar el preflight y el respaldo, exportar los mismos valores en esa sesión sin escribir la contraseña en el historial:

```bash
export NODE_ENV=production
export LANDUR_DEMO=0
export LANDUR_PUBLIC_ORIGIN=https://landur.tudominio.com
export LANDUR_DATA_DIR="$HOME/landur-private/data"
export LANDUR_BACKUP_DIR="$HOME/landur-backups"
unset LANDUR_INSECURE_LOCAL
read -rsp 'Contraseña configurada en cPanel: ' LANDUR_PASSWORD; printf '\n'
export LANDUR_PASSWORD
npm run check:host
unset LANDUR_PASSWORD
```

El comando `read` se ejecuta en tu terminal de cPanel; no pegues su respuesta en el chat ni en el repositorio. Esta exportación solo dura esa sesión y no reemplaza la configuración del panel.

`check:host` debe devolver `status: ok`, `productionChecks: true`, `storageWrite: true`, `transaction: true` y `backup: true`. Si falla, corregir la causa antes de iniciar. Una advertencia `ExperimentalWarning` de SQLite no es por sí sola un fallo; un módulo ausente, falta de permisos o una transacción fallida sí bloquean el despliegue.

## 8. Reiniciar y revisar el entorno privado

1. En cPanel, guardar la configuración y pulsar **Restart** de LANDUR.
2. Abrir `https://landur.tudominio.com/` en una ventana privada del navegador.
3. Debe aparecer el acceso privado, **no una demo con saldos precargados**.
4. Iniciar sesión y comprobar el estado vacío.
5. Usar únicamente datos sintéticos para estas verificaciones. Una vez aceptado el piloto, preparar el espacio real con un corte de datos acordado; no mezclar pruebas con historia real.

Si aparecen errores 500/502/503, revisar el log de la aplicación en cPanel. No publicar el log completo sin revisar si contiene información sensible.

## 9. Probar los flujos antes de instalarla

En la instancia de prueba, registrar cuentas sintéticas con un saldo inicial y fecha de corte claros. Verificar:

- Gasto pagado: reduce la cuenta elegida y aparece una vez.
- Obligación: aparece pendiente y no mueve caja.
- Pago parcial: reduce deuda y caja, sin duplicar el gasto.
- Venta: no crea dinero en una cuenta hasta asociar el cobro.
- Cobro: requiere comisión explícita; usar cero solo cuando efectivamente no existe.
- Transferencia interna: cambia dos cuentas de igual moneda sin alterar el total propio.
- Retiro personal: separado de gastos operativos.
- Recarga: los registros siguen presentes.
- Reimportación del mismo CSV: informa registros ya existentes sin duplicarlos.
- Monedas distintas: aparecen separadas, no se suman entre sí.
- Disponible: muestra **Por validar**, no un número inventado.

### Verificar privacidad del despliegue

Sin iniciar sesión:

- `/api/state` y `/api/export.csv` deben devolver `401`.
- `/data/landur.sqlite`, `/.env`, `/server/ledger.mjs` y `/package.json` no deben exponer archivos.
- El navegador debe recibir cookies `HttpOnly`, `Secure` y `SameSite=Strict` tras ingresar.
- Cerrar sesión y volver atrás no debe recuperar el panel financiero.
- El manifiesto, iconos, JS y CSS sí son públicos: no contienen datos financieros ni secretos.

Esto es una verificación operativa inicial, **no reemplaza el pentesting de la semana 3**.

## 10. Instalar la PWA en iPhone

1. Abrir el subdominio directamente en **Safari**, con HTTPS válido.
2. Tocar **Compartir → Agregar a pantalla de inicio**.
3. Confirmar el nombre LANDUR y agregarla.
4. Abrir el icono y volver a ingresar si lo solicita.
5. Probar navegación, formularios, teclado decimal, recarga y suspensión/reanudación.
6. Activar modo avión y recargar: debe mostrar el bloqueo sin conexión. **No debe permitir guardar ni mostrar un guardado exitoso ficticio.**
7. Restaurar conexión y verificar que no se duplicaron operaciones.

No se publica en App Store. No hay escritura offline ni notificaciones push en este piloto. La emulación móvil ya probada no sustituye esta verificación en el iPhone de Rafa.

## 11. Respaldos

Con las mismas variables privadas disponibles en Terminal:

```bash
cd "$HOME/landur-app"
npm run backup
```

El respaldo se guarda en `LANDUR_BACKUP_DIR` y elimina sesiones de la copia. El script usa una copia consistente de SQLite; no copiar solo el `.sqlite` de una base activa ignorando sus archivos WAL.

Antes de usar datos reales, acordar frecuencia y retención, configurar una copia externa protegida/cifrada y probar restauración. **Esta versión no instala automáticamente un cron de respaldo.** No escribir la contraseña en un comando cron ni en un archivo público; un operador deberá configurar un mecanismo privado aprobado para tareas programadas.

Para restaurar: detener todos los escritores/Passenger, preservar el almacenamiento actual completo, revisar la compatibilidad de esquema y restaurar en un directorio privado limpio. No mezclar la copia con WAL/SHM antiguos. Probar primero fuera del entorno real.

## 12. Actualizar sin perder datos

1. Probar el código nuevo antes de publicar.
2. Tomar un respaldo consistente y conservar el código previo.
3. Detener/reiniciar LANDUR según el procedimiento de cPanel, sin tocar Pulso.
4. Reemplazar únicamente código/recursos. No sobrescribir `landur-private` ni `landur-backups`.
5. Si cambia el esquema, revisar una migración explícita; no hay un sistema general de migraciones/reversión en esta alfa.
6. Ejecutar pruebas y preflight con el entorno correcto.
7. Reiniciar y revisar los flujos mínimos.
8. La PWA puede avisar que hay una actualización. Terminar cualquier formulario antes de aplicarla. Una reinstalación no debe ser el procedimiento normal para actualizar.

No usar el `.cpanel.yml` ni el cron de Pulso para desplegar LANDUR. La rama de trabajo y este ZIP no modifican producción por sí solos.

## Problemas frecuentes

| Síntoma | Revisar |
|---|---|
| Falta `node:sqlite` | Versión y módulos del Node activado para esa app, no otro Node de SSH |
| `403 Origen no autorizado` al guardar | `LANDUR_PUBLIC_ORIGIN`: HTTPS, subdominio exacto, sin barra final |
| Entra pero vuelve al login | HTTPS, cookies, host dedicado; revisar reinicios repetidos/múltiples workers |
| No escribe la base | Ruta absoluta privada, permisos del usuario Node, cuota de disco |
| Error 500 al arrancar | `app.cjs`, variables obligatorias, versión de Node y log de Passenger |
| JS/CSS/iconos devuelven HTML o 404 | Document root/rutas de Passenger; extraer paquete sin carpeta adicional |
| No aparece Agregar a pantalla de inicio | Abrir directamente en Safari, no en un navegador embebido; validar HTTPS e iOS |
| Dice Sin conexión con internet disponible | API inaccesible, sesión vencida o proxy/ruta mal configurada; revisar Network y logs sin exponer secretos |
| Se ve una versión antigua | Revisar actualización del service worker y encabezados estáticos; no tocar datos para renovar la interfaz |

## Condición final de habilitación

El hecho de que la PWA abra en cPanel **no significa que el proyecto haya terminado**. Para habilitar operaciones reales deben estar aprobados los criterios financieros, privacidad del despliegue, respaldo/restauración, uso en iPhone y pentesting/correcciones/retesting del roadmap.
