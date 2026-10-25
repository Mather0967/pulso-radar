# Traspaso a ChatGPT — Instalar LANDUR dentro del portal RIVECT en cPanel

Documento autónomo · 24 de octubre de 2026 · Versión 1.0

## 0. Instrucción y resultado esperado

El usuario quiere que instales la versión desarrollada de LANDUR en su hosting Namecheap/cPanel, **dentro del portal RIVECT existente**, de modo que después de iniciar sesión aparezcan dos proyectos:

```text
https://rivect.net/login
            ↓
https://rivect.net/portal  — Mis proyectos
            ├── Pulso  → /pulso
            └── LANDUR → /landur/
```

**Debe usar el mismo login, las mismas cuentas del portal y permisos independientes por proyecto. No crear una segunda aplicación Node, otro subdominio ni una segunda contraseña para LANDUR.**

Este archivo incluye el contexto necesario sin depender del chat original. Los archivos actuales del repositorio y la configuración real del hosting deben inspeccionarse antes de actuar. Si contradicen este documento, detenerse y explicar la diferencia; no improvisar otra arquitectura.

El usuario indicó que puede abrir Terminal en cPanel y que tiene Node actualizado. Eso no demuestra que el runtime exacto de Passenger y el de Terminal sean el mismo ni que SQLite esté habilitado.

## 1. Acceso y límites de autorización

- Usar únicamente una sesión de cPanel/Terminal u otra herramienta autorizada que realmente esté disponible para vos. No afirmar que podés operar cPanel solo porque recibiste este documento.
- El usuario debe iniciar sesión mediante la interfaz segura de la herramienta que utilice. No solicitar contraseñas de cPanel, códigos 2FA, tokens de GitHub, cookies o claves SSH por chat.
- Si no tenés herramienta para controlar el navegador/terminal autorizado, indicarlo y guiar al usuario; no inventar una instalación completada.
- No imprimir variables de entorno completas, archivos de identidad, `.env`, sesiones ni respaldos en el chat. No pegar secretos en comandos que quedan en el historial.
- No consultar ni probar sistemas de bancos, Shopify, Mercado Pago o terceros. Esta tarea es desplegar el portal propio.
- No cambiar reglas financieras, agregar conectores ni introducir datos reales para demostrar que funciona.
- La instalación no autoriza por sí sola un merge de GitHub, cambios de dominio/roles globales, borrado de datos, activación de nuevos crons o una migración financiera. Cuando alguna de esas acciones sea necesaria, explicar el impacto y obtener aprobación explícita.
- Si la herramienta de trabajo está ligada a una rama fija de Arena, respetarla. No cambiarla para satisfacer los requisitos del despliegue. El checkout existente de producción en cPanel es un contexto distinto y debe inspeccionarse por separado.

## 2. Fuente del código y estado conocido

| Dato | Valor conocido al escribir esta guía |
|---|---|
| Repositorio | `Mather0967/pulso-radar` |
| URL | `https://github.com/Mather0967/pulso-radar` |
| Rama de trabajo | `arena/eab1cd0e-pulso-radar` |
| Último commit de implementación revisado | `01db0e777ddfe339a83b88d02e0939562eb7372b` |
| Commit de integración del portal | `5f126e8` — resolver SHA completo desde Git antes de usarlo |
| Aplicación financiera | `projects/landur/` |
| Adaptación de portal cPanel | `namecheap/` |
| Estado remoto | Código subido a la rama de trabajo; no se acreditó merge a `main` ni instalación en Namecheap |

Puede haber commits posteriores, incluido este documento. Consultar el historial actual y aprobar una revisión concreta antes de publicar. **No asumir que `main` ya contiene LANDUR.**

El ZIP anterior `landur-pwa-cpanel-0.2.0.zip` es de la aplicación independiente: **NO instala la integración de portal y NO debe extraerse encima del portal RIVECT**.

## 3. Estado del producto: no confundir despliegue con aceptación

LANDUR es una **alfa funcional del sprint 1**, no el producto terminado ni una versión aprobada para operar con dinero real.

Implementado:

- Inicio, movimientos, cuentas, egresos, ventas, pendientes y configuración.
- Gastos sin factura, obligaciones y pagos parciales.
- Ventas/cobros relacionados, comisión real explícita, transferencias internas y retiros personales.
- Persistencia SQLite, auditoría e idempotencia.
- CSV acotado con vista previa, importación atómica y exportación.
- PWA con iconos/manifiesto, recursos relativos y bloqueo de operaciones offline.
- Integración con el login RIVECT, permisos por proyecto y retorno a Mis proyectos.

Pendiente:

- Validación de hojas reales, saldos, cuentas y reglas con Rafa.
- Disponible/reservas, porcentajes de reparto y excepciones.
- Adjuntos privados, corrección/reversión auditada y otras funciones restantes del MVP.
- Aceptación de usuarios y del procedimiento de recuperación del portal.
- Respaldo/restauración operativos del conjunto identidad + finanzas en este hosting.
- Safari e instalación en iPhone físico; pentesting, correcciones y retesting.

El disponible debe seguir mostrando **«Por validar»**. No seleccionar 25 % o 30 % de reinversión mayorista por conveniencia. No presentar una venta, un cobro y una transferencia como tres ingresos.

## 4. Arquitectura que se debe conservar

### Identidad y autorización

- El portal usa `AuthStore` de `server/auth.mjs`.
- Cookie compartida: `rivect_session`, HttpOnly, Secure y SameSite=Strict en modo real.
- LANDUR verifica la sesión y el permiso en cada petición, no solo al mostrar su tarjeta.
- Administradores activos tienen edición en ambos proyectos, según el modelo del portal existente.
- Miembros necesitan `projects.landur = "viewer"` o `"editor"`. Tener `projects.pulso` no concede LANDUR.
- Viewer puede consultar y exportar; no registrar, pagar ni importar.
- Guardar permisos invalida las sesiones del usuario afectado. No reactiva usuarios inactivos.
- Logout desde LANDUR cierra la sesión del portal, también para Pulso.
- Las operaciones financieras registran el ID del usuario del portal como autor.

### Runtime y almacenamiento

- Se usa el **mismo proceso Passenger/Node del portal**, con un adaptador de rutas para LANDUR.
- Requiere Node >=22.13 con `node:sqlite` disponible; verificarlo realmente.
- No hay dependencias externas de ejecución en LANDUR. Playwright y Chromium son solo de QA y no deben instalarse en el hosting productivo.
- Base de LANDUR: `<DATA_DIR efectivo>/landur/landur.sqlite`.
- Pulso conserva su almacenamiento en `<DATA_DIR efectivo>/pulso`.
- Identidad y otros archivos privados del portal permanecen en su almacenamiento existente. No regenerarlos ni sustituirlos.
- La base LANDUR se crea vacía al primer acceso autorizado que necesita datos; no se precarga una demo.
- SQLite necesita disco persistente, permisos correctos y bloqueo/WAL compatible. No asumir funcionamiento sobre almacenamiento compartido/NFS sin comprobarlo.

### Rutas y PWA

- `/portal`: selector con Pulso y LANDUR según permisos.
- `/landur/`: PWA financiera.
- `/landur/api/session`: información de la sesión del portal y CSRF, sin segunda contraseña.
- `/landur/api/state`, `/landur/api/commands`, `/landur/api/import/preview`, `/landur/api/import/commit`, `/landur/api/export.csv`: rutas financieras protegidas.
- `/landur/api/logout`: logout compartido.
- `/landur/api/login` y `/landur/api/demo`: **no habilitadas** en modo portal.
- El service worker tiene scope `/landur/`, no `/`. Nunca debe controlar Pulso, el portal o `/auth`.
- Solo se cachea la interfaz sin datos personales. No API, CSV, credenciales ni respuestas redirigidas al login.
- En modo portal, los recursos LANDUR se sirven desde una lista permitida en Node. No exponer todo `projects/landur/` como carpeta estática.

## 5. Inventario del hosting: comprobar antes de modificar

Las siguientes rutas están documentadas para el portal existente, pero **son valores esperados, no hechos verificados en tu sesión**:

| Elemento | Ruta/configuración documentada |
|---|---|
| Portal publicado | `$HOME/rivect-portal` |
| Clon Git usado para publicar | `$HOME/repositories/pulso-radar` |
| Estado/respaldos de código | `$HOME/pulso-deploy` |
| Script instalado de sincronización | `$HOME/pulso-deploy/sync.sh` |
| Rama del clon de publicación | `main` |
| Git de cPanel | `/usr/local/cpanel/3rdparty/bin/git` |
| Node 22 candidato | `/opt/alt/alt-nodejs22/root/usr/bin/node` |
| Otro candidato documentado | `$HOME/nodevenv/rivect-portal/22/bin/node` |
| Dominio permitido por el código actual | `rivect.net` / `www.rivect.net` |
| Origen de escritura en modo real | `https://rivect.net` |

En cPanel inspeccionar:

1. Application root, URL, startup file, versión exacta de Node y modo de la aplicación **existente de RIVECT**.
2. El comando de activación del entorno Node que muestra ese panel.
3. El document root público: debe limitarse a recursos públicos, no incluir código/SQLite/identidad.
4. La ruta efectiva `DATA_DIR`; puede ser absoluta o relativa a la raíz del portal.
5. Propietario, permisos y espacio disponible de datos y respaldos.
6. Existencia y estado del cron de sincronización. Inspeccionarlo localmente sin divulgar posibles secretos en otras entradas.
7. Estado Git del clon de despliegue: rama, revisión, remoto esperado y cambios locales. No forzar ni descartar cambios.
8. Existencia de `server/site.mjs`, páginas de login/activación/admin/landing y archivos de identidad reales del portal.

**Los originales de `server/site.mjs` y varias páginas del portal se conservan en Namecheap y no están en el repositorio. No reemplazarlos con los fixtures de pruebas.**

Si no encontrás el portal existente o el sitio es otro dominio, detenerse. El código actual no tiene una variable genérica para cambiar el origen productivo del portal: editarlo requiere revisión y pruebas, no inventar una variable.

## 6. Separar instalación de la política Git

El procedimiento documentado sincroniza **`main`**. El instalador `scripts/cpanel-deploy.mjs` rechaza otras ramas cuando se ejecuta como CLI.

Antes de publicar:

1. Confirmar qué revisión contiene la integración y las correcciones, y cuál está aprobada para publicar.
2. Verificar si esa revisión ya está incorporada en `main`.
3. Si solo está en `arena/eab1cd0e-pulso-radar`, **detener la publicación** y pedir al responsable que apruebe/revise e integre los cambios mediante su flujo GitHub.
4. No cambiar el cron a la rama de trabajo, no quitar el guard de `main`, no invocar `installRelease()` manualmente para saltarse las pruebas y no renombrar la rama.
5. No cambiar el checkout ligado a una sesión Arena. Un agente que solo tiene cPanel no debe asumir acceso o autorización para operar GitHub.

Si el cron actual publica automáticamente al detectar cambios en `main`, el merge puede provocar el despliegue. Coordinar la revisión, el respaldo y la ventana de cambios **antes** de integrar. Si hace falta pausar temporalmente el cron, pedir autorización, registrar su configuración original y no habilitar una nueva tarea al terminar por supuesto.

## 7. Respaldar antes de copiar código

El instalador mantiene respaldos de las rutas de código que modifica. **Eso no es un respaldo de la identidad ni de las finanzas.**

Preparar un respaldo privado verificable de:

- Código actual y configuración necesaria para recuperarlo.
- Identidad, usuarios, permisos y demás datos del portal.
- Datos de Pulso.
- Base LANDUR y sus relaciones si ya existe.
- Configuración de Passenger, cron y revisión publicada, sin publicar secretos.

Para obtener una captura consistente del conjunto, coordinar una ventana sin escrituras y detener los procesos escritores si corresponde. Para SQLite activo usar su mecanismo de copia consistente (por ejemplo `VACUUM INTO` sobre la base correcta); no copiar solo el `.sqlite` dejando fuera WAL. No borrar WAL/SHM de una base en uso.

Guardar el respaldo fuera de cualquier directorio público y del checkout; permisos restrictivos. Verificar tamaño, contenido esperado y capacidad de restauración en una ubicación aislada. Si no hay respaldo verificable, no continuar con cambios de producción.

El `npm run backup` y `npm run check:host` de la aplicación **standalone** requieren su propia configuración; **no inventar `LANDUR_PASSWORD` para ejecutarlos contra el portal**. Para este modo comprobar directamente runtime/almacenamiento y usar el procedimiento de respaldo aprobado del portal.

## 8. Comprobar el Node exacto de Passenger

Activar en Terminal el entorno mostrado por la aplicación RIVECT de cPanel y comprobar:

```bash
node --version
node --input-type=module -e 'import { DatabaseSync } from "node:sqlite"; const db = new DatabaseSync(":memory:"); console.log(db.prepare("select sqlite_version() as version").get()); db.close();'
```

Eso prueba carga de SQLite, no persistencia ni permisos del directorio de producción. Probar una base **temporal con nombre único** dentro del directorio privado autorizado, una transacción y una copia consistente; cerrar y eliminar solo esos archivos temporales al terminar.

Una advertencia `ExperimentalWarning` no equivale a error. Un fallo de importación, permisos, bloqueo o transacción sí bloquea la publicación.

**Advertencia sobre el wrapper actual:** `scripts/cpanel-deploy.sh` busca dos rutas concretas de Node **22**, aunque en cPanel se haya seleccionado una versión más nueva. Si no coinciden con el runtime real o no existen, no cambiar Passenger de versión a ciegas. Detenerse y pedir una actualización revisada del wrapper antes de automatizar. Lo mismo aplica si no existe el Git de cPanel esperado.

## 9. Qué archivos cambia realmente el instalador

Revisar el valor actual de `managedPaths` en `scripts/cpanel-deploy.mjs`. En la versión documentada incluye:

```text
src/
dist/server/
scripts/storage.mjs
server/main.mjs
server/auth.mjs
server/access.mjs
public/pulso-session.js
server/projects.mjs
server/landur.mjs
public/projects.css
public/projects.mjs
public/projects-brand.svg
projects/landur/server/
projects/landur/public/
```

Mapeo de fuentes:

- Las rutas de destino `server/...` y `public/...` se copian desde `namecheap/server/...` y `namecheap/public/...` del repositorio.
- El resto se copia desde la ruta equivalente del repositorio.
- `dist/server/` se genera con `scripts/build.mjs` antes de copiar.

Deben preservarse:

- `server/site.mjs`.
- Landing y páginas de login/activación/administración del hosting.
- Archivo previo `public/portal.html`: queda conservado, aunque `/portal` ahora usa la vista versionada de `server/projects.mjs`.
- `.env`, variables y secretos existentes.
- Todos los datos, identidad y respaldos, incluidos los de LANDUR.

**No copiar `namecheap/` entera encima del portal, no extraer el ZIP independiente en la raíz RIVECT y no usar una sincronización con borrado general.**

## 10. Ejecutar la publicación, solo con las condiciones cumplidas

Antes: destino verificado, revisión aprobada en `main`, respaldo comprobado, runtime compatible, sin cambios locales desconocidos y coordinación con el cron.

El mecanismo existente es:

```text
scripts/cpanel-sync.sh
  → fetch origin main y avance rápido del clon de despliegue
  → scripts/cpanel-deploy.sh
  → scripts/cpanel-deploy.mjs
      → exige rama main
      → compila Pulso
      → ejecuta pruebas de Pulso/portal
      → ejecuta pruebas de LANDUR
      → respalda y sustituye únicamente managedPaths
      → solicita reinicio Passenger con tmp/restart.txt
      → registra revisión y respaldo en status.json
```

Si verificaste que `$HOME/pulso-deploy/sync.sh` corresponde al script aprobado y que sus rutas/runtime son correctos, podés ejecutar **ese procedimiento existente**, en una ventana coordinada:

```bash
/bin/bash "$HOME/pulso-deploy/sync.sh"
```

No pegar este comando sin inspeccionar previamente el archivo instalado: puede ser una copia desactualizada o tener una configuración distinta. No iniciar además otro `npm start`, no crear otra app Node y no ejecutar simultáneamente sync, deploy y copias manuales.

Hay bloqueos de concurrencia, pero el wrapper puede terminar sin hacer trabajo si otro proceso tiene el bloqueo. Un código de salida cero o un mensaje `status: deployed` **no demuestra que el portal ya esté sano**. Verificar revisión, fecha, log y pruebas posteriores.

Si el proceso se niega a publicar por la rama, runtime, pruebas o un despliegue previo incompleto, no anular la protección. Resolver la causa o devolver el bloqueo al usuario.

Las variables `PULSO_DEPLOY_TARGET`, `PULSO_DEPLOY_STATE` y `PULSO_GIT` existen en el script de despliegue. No usarlas para improvisar otras rutas: los wrappers y cron tienen rutas/bloqueos propios que también deben ser consistentes.

## 11. No activar la demo de Arena en producción

El entorno del puerto 3001 de Arena es una **demo sintética separada**. Para funcionar dentro del visor embebido tiene cookies particionadas y una alternativa de sesión en memoria cuando el navegador bloquea cookies.

Eso **no es el sistema de acceso del portal real**. No trasladar `LANDUR_DEMO=1`, `LANDUR_INSECURE_LOCAL=1`, sesiones sintéticas, cabeceras demo ni la base `demo.sqlite` a la instalación RIVECT.

En modo portal no se necesita configurar `LANDUR_PASSWORD`, `LANDUR_PUBLIC_ORIGIN`, `LANDUR_DATA_DIR` ni otro puerto de LANDUR. Se utiliza la configuración existente del portal (`DATA_DIR`, origen y sesión RIVECT). No eliminar otras variables del portal que utilice Pulso.

No poner `RIVECT_LOCAL=1` ni `RIVECT_TEST=1` en Passenger productivo.

## 12. Pruebas de humo obligatorias después del reinicio

### A. Continuidad del portal y Pulso

- Landing existente abre normalmente.
- Login original permite ingresar, sin sustituirlo por una página de ejemplo.
- `/portal` muestra «Mis proyectos».
- Administrador ve **Pulso** y **LANDUR**.
- Pulso abre y mantiene sus datos anteriores.
- Administración e invitaciones existentes siguen disponibles.

### B. LANDUR y sesión compartida

- «Abrir LANDUR» lleva a `/landur/`.
- No solicita una segunda contraseña.
- Un espacio nuevo aparece vacío, no con saldos de demostración.
- «← Mis proyectos» vuelve al selector.
- Un registro sintético controlado se conserva al recargar y al reiniciar Passenger.
- Cerrar sesión desde LANDUR invalida el acceso a ambos proyectos.

No cargar pruebas en una base que ya tiene datos reales sin plan autorizado: todavía no hay una UI completa de reversión. Preferir entorno/usuarios/base de prueba aislados. No inventar una limpieza SQL sobre el libro real al finalizar.

### C. Permisos

Usar cuentas de prueba autorizadas, sin elevar usuarios reales por conveniencia:

- Administrador: edición en ambos proyectos.
- Miembro solo Pulso: no ve tarjeta LANDUR y su API responde `403`.
- Miembro LANDUR editor: consulta y registra.
- Miembro LANDUR viewer: consulta/exporta, no registra/paga/importa; comprobar rechazo servidor, no solo botón deshabilitado.
- Miembro sin proyectos: no ve accesos habilitados.
- Revocar LANDUR conserva el permiso Pulso, invalida sesiones del afectado y exige nuevo login.
- Guardar permisos de Pulso en el admin anterior no borra LANDUR.

### D. Exposición y CSRF

Sin sesión:

- `/landur/` redirige al login.
- `/landur/api/state` y `/landur/api/export.csv` devuelven `401`.
- No se descargan `.env`, identidad, bases, respaldos ni código servidor por URL.

Con sesión de prueba:

- Escrituras sin CSRF válido o con origen ajeno devuelven `403`.
- Cookies reales conservan HttpOnly/Secure/SameSite=Strict.
- Una credencial de demo por encabezado no habilita rutas del portal.

Son verificaciones autorizadas del sitio propio, no un pentest completo.

### E. PWA en iPhone

- Abrir `/landur/` directamente en Safari, sobre HTTPS válido, después de ingresar al portal.
- Compartir → Agregar a pantalla de inicio.
- Abrir icono: debe entrar a LANDUR o pedir el acceso del portal, nunca una contraseña standalone.
- Comprobar manifiesto/inicio/scope bajo `/landur/`.
- Navegar a Pulso y confirmar que el service worker de LANDUR no lo controla.
- Verificar que Cache Storage no contenga API, exportaciones ni datos financieros.
- Probar teclado, formularios, suspensión/reanudación y sesión vencida.
- Sin conexión no se debe afirmar que una operación se guardó ni permitir una escritura financiera offline.

## 13. Qué hacer si falla

1. No seguir copiando archivos ni crear otra instalación en paralelo para ocultar el fallo.
2. Registrar paso, error no sensible, revisión y estado observado.
3. Revisar log de Passenger y estado del despliegue localmente, evitando exponer secretos.
4. Si falla la copia, el instalador intenta restaurar las rutas de código modificadas; comprobar el resultado, no asumirlo.
5. Si la copia terminó pero el sitio falla, el rollback automático de copia **no cubre esa comprobación de salud posterior**.
6. Coordinar detener el cron para que no vuelva a desplegar la revisión problemática; requiere autorización y registro de su estado original.
7. Revertir solo código desde el respaldo previo o mediante una revisión de reversión aprobada en el flujo Git. Respetar los archivos ausentes antes de la instalación, la lista de rutas y la compatibilidad con el esquema.
8. No restaurar la base financiera antigua para resolver un error de CSS/JS, ni perder operaciones posteriores al respaldo.
9. Reiniciar Passenger y repetir login, Pulso, permisos y finanzas sintéticas.
10. No borrar respaldos ni cambiar el cron de nuevo hasta verificar el resultado y acordar el siguiente paso.

El instalador no implementa migraciones generales de SQLite ni una reversión automática de esquema. Si hay cambios de esquema respecto del sitio real, detenerse para diseñar/revisar la migración antes de publicar.

## 14. Problemas previsibles

| Síntoma | Revisar antes de cambiar código |
|---|---|
| No aparece LANDUR | Revisión publicada, `/portal`, reinicio, rol/permisos y scripts `projects.*` |
| Pulso aparece pero LANDUR da 403 | `projects.landur`, rol y sesión del usuario; no conceder admin para saltarlo |
| LANDUR da 503 | Código runtime copiado, Node/SQLite y permisos del almacenamiento privado |
| Solicita segunda contraseña | Se abrió la app standalone o se desplegó el ZIP equivocado; usar `/landur/` del portal |
| «Sesión vencida» en producción | Cookie RIVECT, HTTPS, host, expiración/revocación; no habilitar fallback demo |
| Escrituras dan 403 | Origen exacto y CSRF del portal; no desactivar estos controles |
| JSON o CSS devuelven otra página | Rutas Passenger/document root, archivos publicados y scope |
| Cambiar permiso Pulso elimina LANDUR | Se publicó código antiguo de administración; verificar merge de grants |
| El wrapper no encuentra Node | Busca rutas específicas Node 22; revisar el runtime configurado y actualizar de forma controlada |
| `status.json` dice deployed pero sitio falla | El estado registra copia/reinicio solicitado, no pruebas de salud completas |

## 15. Evidencia previa y cómo reportar el trabajo

Últimos resultados locales conocidos:

- 58 pruebas de Pulso/portal aprobadas.
- 39 pruebas de LANDUR aprobadas después de corregir la demo embebida.
- QA Chromium del modo independiente y de la integración de portal.
- Regresión de demo dentro de iframe sin cookies, separada de autenticación privada.

Los tests del portal usan identidades sintéticas y sustitutos de `site.mjs`/páginas de cuenta porque los originales solo están en Namecheap. **No prueban que el portal real ya esté publicado ni validan Safari físico o pentesting.**

Al terminar, entregar al usuario un informe con:

1. Estado: instalado y verificado / instalado con pendientes / bloqueado / revertido.
2. Dominio, aplicación cPanel y rutas efectivas comprobadas, sin secretos.
3. SHA exacto publicado y cómo se obtuvo aprobación para publicarlo.
4. Respaldo creado, ubicación privada y validación realizada.
5. Archivos/rutas modificados y confirmación de que Pulso, identidad y datos se preservaron.
6. Estado final del cron y Passenger; no afirmar actualizaciones automáticas si no están verificadas.
7. Resultados reales de cada prueba de humo, incluidas las fallidas y las no ejecutadas.
8. Permisos asignados, solo los autorizados.
9. Instrucciones para abrir `/portal`, entrar a LANDUR e instalar en iPhone.
10. Limitaciones y siguiente acción. No declarar «listo para dinero real» mientras falten las puertas funcionales y de seguridad del roadmap.

## Resumen de prohibiciones críticas

**NO:** instalar LANDUR como otra app para este pedido; sobrescribir el portal con el ZIP standalone; reemplazar `site.mjs` con fixtures; borrar o migrar datos por supuesto; desplegar la rama de trabajo saltando el guard de `main`; activar demos en producción; debilitar cookies/CSRF; otorgar LANDUR a todos los usuarios de Pulso; inventar reglas financieras; publicar secretos; declarar éxito sin verificar el portal real.
