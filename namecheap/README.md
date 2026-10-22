# Adaptación para Passenger

Esta carpeta contiene la integración del servidor de Pulso con un portal autenticado existente. No es una instalación completa: las páginas del portal y el módulo `site.mjs` se conservan en el entorno de destino.

## Sesión

Passenger sirve el directorio `public/` directamente. Por ese motivo, el bootstrap de sesión se solicita por `/auth/pulso-session.js`, una ruta autenticada fuera del directorio estático, que incorpora el usuario y CSRF. Se conservan las comprobaciones de origen y permisos.

## Gemini compartido

Configurar `GEMINI_API_KEY` en las variables de entorno del proceso Node. También se admite `GOOGLE_API_KEY`. `GEMINI_MODEL` es opcional; su predeterminado es `gemini-3.8-flash`.

La clave se utiliza sólo en el servidor y nunca se incluye en las respuestas de estado, código cliente, registros del proyecto o respaldos de datos. Los usuarios autorizados comparten la conexión y su cuota. Los usuarios viewer pueden consultar IA sin obtener permisos para guardar, importar ni modificar registros.

## Actualización

Ejecutar `npm test`. Aplicar `server/main.mjs` y `server/access.mjs` a la adaptación del portal, junto con los módulos modificados de `src/` y sus equivalentes compilados de `dist/server/`. Preservar los recursos existentes que no forman parte de este cambio: estilos, marca y laboratorios. El directorio de datos no forma parte de la actualización. Conservar un respaldo previo siguiendo el procedimiento habitual del entorno.

Reiniciar el proceso Node después de actualizar sus archivos o variables. Verificar acceso, guardado y persistencia después de recargar; luego probar radar y consultas de IA con perfiles editor y viewer.

Las pruebas automatizadas usan un proveedor simulado. La activación requiere una clave real y una consulta de prueba para comprobar disponibilidad, cuota y permisos. Esta entrega no acredita un despliegue ni una validación en producción.

## Groq compartido

Configurar `GROQ_API_KEY` en el entorno Node; `GROQ_MODEL` es opcional y usa `openai/gpt-oss-120b`. Groq tiene prioridad sobre Gemini del servidor; una clave temporal de Gemini sigue seleccionando Gemini. Las credenciales sólo viajan en encabezados desde el servidor. Las consultas de evidencia conservan esquema estricto y validación literal de citas.

La conexión Groq analiza únicamente datos aportados, sin búsqueda web automática. Cada consulta tiene un presupuesto de salida de 2200 tokens y rechaza entradas superiores a 10000 caracteres antes de llamar al proveedor; el límite real de tokens del proveedor sigue aplicándose. No hay reintentos automáticos ni compras de cuota. Las pruebas usan respuestas simuladas; la conexión requiere una prueba real tras configurar la clave.

## Informe con investigación web

`POST /api/ai/research` inicia una búsqueda de empresa/redes y casos internacionales con `browser_search` de Groq. `GET /api/ai/research/:id` consulta el trabajo persistido, aislado por proyecto. Una sola investigación por proceso/proyecto evita consultas simultáneas repetidas. El informe se conserva en la cartera al completar la consulta. Los trabajos pueden consultarse durante siete días. Las llamadas fallidas no reemplazan el informe anterior.

La interfaz calcula escenarios deterministas a partir de supuestos editables. El valor del tiempo liberado se muestra como capacidad; sólo la fracción que reduce gasto efectivo entra al cambio operativo. La contribución adicional requiere tasa de conversión, ticket y margen; se descuentan costos recurrentes y pago inicial. Desconocido permanece `null`, incluyendo la ganancia de partida. Se exportan JSON y CSV con fórmulas, unidades, supuestos y fuentes.

Los canales encontrados son candidatos para revisión humana. El informe indica si la respuesta trae metadatos de ejecución web y distingue URLs presentes en herramientas de referencias reportadas por el modelo. Se rechazan esquemas malformados, hechos/casos sin referencias y protocolos no web. Las referencias aún requieren comprobación de contenido, autoría, fecha y homónimos; la herramienta no verifica estados financieros ni garantiza ahorro. No se reutilizan porcentajes de multinacionales como datos de la empresa local.

Pruebas con proveedor simulado: `npm test`. La entrega exige también prueba de búsqueda y persistencia con la clave del servidor y la sesión de producción.

## Despliegue automático desde GitHub

cPanel mantiene un clon público de `Mather0967/pulso-radar` en `~/repositories/pulso-radar`, rama `main`. Un cron cada cinco minutos ejecuta `~/pulso-deploy/sync.sh`, copia instalada de `scripts/cpanel-sync.sh`. Hace fetch y avance rápido; nunca fuerza ni descarta cambios locales. Sólo ejecuta el despliegue si cambió el commit respecto de `~/pulso-deploy/status.json`.

Antes de publicar se compila y se ejecuta toda la suite con el Node 22 de Passenger. `scripts/cpanel-deploy.mjs` sustituye únicamente las rutas de código enumeradas en `managedPaths`, conserva un respaldo previo en `~/pulso-deploy/backups`, conserva datos, credenciales, landing y módulo de sitio, y solicita reinicio de Passenger mediante `tmp/restart.txt`. Un fallo de copia restaura el código anterior. `.cpanel.yml` permite ejecutar el mismo despliegue desde Git Version Control. Los bloqueos evitan ejecuciones simultáneas.

Registro: `~/pulso-deploy/deploy.log`; commit publicado y respaldo: `~/pulso-deploy/status.json`. Para pausar la actualización, desactivar el cron. Para revertir una versión, hacer `git revert` del commit en GitHub y publicar a `main`; la automatización desplegará ese nuevo commit. Una rama de trabajo o PR sin integrar no modifica producción. Si el repositorio se vuelve privado habrá que configurar acceso de sólo lectura antes de reactivar el cron.
