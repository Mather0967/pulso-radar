# LANDUR en Namecheap / cPanel / Passenger

## Estado y supuestos

**Destino indicado por el usuario: Namecheap.** El repositorio documenta una aplicación Pulso con cPanel, Passenger y Node 22, pero eso no acredita todavía la versión exacta ni la configuración disponible para LANDUR.

La versión 0.2.0 incluye backend y PWA alfa probados localmente. **La recuperación de acceso, los usuarios definitivos, adjuntos, reversión y aceptación del piloto siguen pendientes. No está habilitada para operar con datos reales ni se ha desplegado en Namecheap.**

Para ejecutar el despliegue, seguir [SUBIR-A-CPANEL.md](SUBIR-A-CPANEL.md). El usuario confirmó Node actualizado; falta el preflight en el entorno exacto de Passenger.

No modificar `.cpanel.yml`, el cron ni el instalador de Pulso. No publicar esta carpeta como sustituto de Pulso.

## Arquitectura prevista para este hosting

- Aplicación Node independiente con entrada `app.cjs` para Passenger.
- Código ESM dentro de `server/`; sin dependencias npm de ejecución ni compilación de addons.
- SQLite mediante `node:sqlite`, **Node >=22.13 con ese módulo habilitado**. Es una API experimental en el runtime local; validar soporte del runtime real antes de adoptar esta configuración en producción.
- Una instancia/proceso de aplicación inicialmente. El límite de intentos está en memoria y las sesiones privadas se invalidan al arrancar: no habilitar múltiples workers sin adaptar y probar estos controles.
- Disco local persistente con soporte de bloqueo SQLite/WAL. No asumir que un volumen compartido/NFS funciona igual.
- Un subdominio exclusivo para LANDUR, con HTTPS y la app en `/`. No montarla dentro de `/pulso` ni en un subdirectorio sin adaptar rutas/cookies/service worker.
- Mismo origen para interfaz y API: las llamadas futuras usarán `/api/...`, nunca `localhost` desde el teléfono.
- Datos y respaldos fuera del código y de la raíz pública. Sesión propia, sin compartir identidad con Pulso.

La autenticación actual es una base de operador único para desarrollo: contraseña del entorno, cookie HttpOnly/Secure/SameSite, caducidad, logout y límite de intentos. No equivale a gestión de usuarios, recuperación ni autenticación de producción aprobada.

## Organización sugerida en el servidor

Los nombres siguientes son ejemplos; sustituir `USUARIO_CPANEL` y el dominio por los valores reales. No son accesos existentes.

```text
/home/USUARIO_CPANEL/
├── landur-app/                 # contenido de projects/landur/
│   ├── app.cjs                 # archivo de inicio Passenger
│   ├── package.json
│   ├── public/                 # únicamente interfaz y recursos públicos
│   ├── server/
│   ├── scripts/
│   └── tests/
├── landur-private/
│   └── data/                   # landur.sqlite y archivos WAL/SHM
└── landur-backups/             # respaldos privados, fuera del despliegue
```

**Nunca** colocar la base, los comprobantes, backups, `.env`, código del servidor o todo el repositorio en `public_html`. El document root debe limitarse a recursos públicos. Passenger puede servir `public/` sin pasar por Node; no confiar en la autenticación de Express/Node para proteger un archivo ubicado ahí.

Permisos de referencia: carpetas de datos/backups `700`, archivos privados `600`, propietario igual al usuario que ejecuta Node. Verificar que la configuración concreta permita estos permisos. Los futuros comprobantes necesitan rutas autenticadas y almacenamiento privado, no `public/uploads`.

## Configuración inicial en cPanel

Cuando corresponda probar staging:

1. Confirmar que el plan tiene **Setup Node.js App / Passenger** y seleccionar la versión exacta de Node.
2. Crear una app separada con raíz `landur-app` y URL del subdominio dedicado.
3. Usar **`app.cjs`** como startup file. Validar que el panel acepte este archivo y el arranque ESM por importación dinámica.
4. Configurar las variables abajo en cPanel, sin almacenarlas en Git ni compartirlas por chat.
5. Entrar a la terminal y activar el entorno Node usando el comando que muestra **esa** aplicación de cPanel. El `node` de SSH puede ser distinto del de Passenger.
6. Ejecutar `npm run check:host` y `npm test` desde la raíz de LANDUR.
7. Reiniciar esa app en cPanel. Probar el subdominio y las rutas API con datos sintéticos/instancia de prueba separada. No iniciar `npm start` como daemon paralelo a Passenger.

No hay dependencias de ejecución en este corte. Usar `npm ci --omit=dev` en cPanel con el lockfile versionado; las dependencias de desarrollo Playwright/Chromium no son necesarias en el hosting. No ejecutar QA de navegador en el plan de producción.

### Variables para el futuro modo privado

| Variable | Valor / propósito |
|---|---|
| `NODE_ENV` | `production` |
| `LANDUR_DEMO` | `0` |
| `LANDUR_PUBLIC_ORIGIN` | `https://SUBDOMINIO_REAL`, sin barra final ni ruta |
| `LANDUR_DATA_DIR` | Ruta absoluta privada, fuera de código y `public_html` |
| `LANDUR_BACKUP_DIR` | Ruta absoluta privada de respaldos, fuera de código y `public_html` |
| `LANDUR_PASSWORD` | Secreto único de 16–256 caracteres; configuración provisional de operador único |
| `LANDUR_INSECURE_LOCAL` | No establecer en producción |

`PORT` es un fallback para Node independiente; Passenger administra la conexión del servidor. No exponer un puerto adicional públicamente. `.env.example` es documentación: no se carga automáticamente.

La aplicación se niega a arrancar en producción si faltan el origen HTTPS o la ruta privada, si la contraseña es insuficiente, si el modo demo está activo o si se solicitan cookies inseguras. La configuración también rechaza datos dentro de carpetas públicas, incluso por enlaces simbólicos detectables.

No se confía en `X-Forwarded-Host` para autorizar escrituras. `LANDUR_PUBLIC_ORIGIN` fija el origen del navegador detrás del proxy. Las peticiones JSON mutantes requieren encabezado propio y control de origen; no se habilita CORS abierto.

## Preflight y límites de lo que demuestra

```bash
cd /home/USUARIO_CPANEL/landur-app
node --version
npm run check:host
npm test
```

`check:host` verifica versión, carga de SQLite, configuración, escritura en almacenamiento privado, transacción y copia consistente. Crea y elimina una base temporal, sin modificar la base financiera. No imprime contraseñas.

Estas pruebas **no** demuestran que HTTPS, proxy, Passenger, document root, instalación iOS o controles operativos estén bien configurados. Hay que probarlos en el host real. Tampoco son pentesting.

Si el host no ofrece Node compatible/SQLite/disco persistente, **no se fuerza el despliegue ni se reemplaza la base por archivos JSON**. Registrar el bloqueo y validar actualización de runtime o adaptación a MySQL/MariaDB disponible en el plan. Ese cambio requiere diseño y pruebas; todavía no está implementado.

## Respaldos y recuperación

Con el entorno privado configurado, `npm run backup` usa `VACUUM INTO` para generar una copia consistente de SQLite, incluso en modo WAL, y elimina sesiones de la copia. Exige `LANDUR_BACKUP_DIR` fuera de la aplicación en producción. No copiar únicamente el archivo `.sqlite` de una base activa ignorando WAL.

Antes del piloto:

- Acordar frecuencia, retención, cifrado y una copia fuera del hosting; no hay cron de respaldo instalado todavía.
- Probar restauración en un entorno aislado y comparar saldos, relaciones y auditoría.
- Para una restauración real: detener Passenger y cualquier escritor, preservar el directorio privado completo, revisar compatibilidad de esquema, restaurar la copia en un directorio limpio y luego arrancar apuntando a él. No dejar WAL/SHM de otra versión junto a la copia restaurada.
- No restaurar datos para revertir únicamente una actualización de código sin evaluar las operaciones posteriores.
- Rotar la contraseña en cPanel requiere reiniciar; el arranque invalida todas las sesiones privadas.

## Despliegues futuros

- Actualizar solo código de LANDUR; no sobreescribir directorios de datos/backups.
- Ejecutar pruebas antes de publicar y tomar respaldo antes de cambios de esquema.
- No hay instalador automático de LANDUR ni migraciones versionadas de esquema en este corte. No conectar la app al cron de Pulso.
- Registrar revisión publicada y versión del esquema; mantener una versión previa para reversión compatible.
- La rama de trabajo no modifica producción por sí sola. No se ha realizado ninguna operación remota sobre Namecheap.

## Checklist antes de aceptar el hosting

- [ ] Plan, versión exacta de Node y SQLite comprobados dentro del entorno cPanel.
- [ ] Inicio `app.cjs` probado mediante Passenger, no solo terminal.
- [ ] Subdominio dedicado, HTTPS, origen y cookies comprobados.
- [ ] Document root limitado a recursos públicos; bases/secretos inaccesibles por URL.
- [ ] Persistencia tras reinicio, cuotas, permisos y bloqueo de SQLite comprobados.
- [ ] Respaldo privado, restauración y estrategia de retención validados.
- [ ] Autenticación/recuperación/usuarios definitivos acordados.
- [x] Interfaz PWA alfa implementada y probada en Chromium con viewport móvil.
- [ ] Validación Safari e instalación en iPhone real.
- [ ] Criterios funcionales y pentesting del roadmap superados.
