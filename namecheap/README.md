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
