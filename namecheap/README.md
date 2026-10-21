# Corrección de la instalación de Namecheap

Estado: código preparado y pruebas locales realizadas; NO desplegado todavía.

La instalación usa Passenger con `/home/riveggry/rivect-portal` como raíz y `public/` como directorio de recursos estáticos. Passenger sirve `public/pulso-session.js` directamente, evitando la ruta Node que agregaba `window.RIVECT`. El bootstrap ahora se solicita por `/auth/pulso-session.js`, fuera del directorio estático. Mantiene la sesión HttpOnly y la validación CSRF.

`server/main.mjs`, `server/auth.mjs` y `public/pulso-session.js` son la adaptación recuperada de la instalación real. El resto del portal (`server/site.mjs`, páginas y archivos de marca) se conserva en el hosting; estos archivos no representan una instalación nueva completa.

Antes de aplicar: conservar el respaldo `backup-code-20261021.zip` creado en la raíz de la aplicación y descargar cualquier copia local pendiente desde Pulso. No modificar `data/` ni las identidades.

## Aplicación en el hosting existente

1. Ejecutar `npm test` en el repositorio.
2. Actualizar `server/main.mjs` con el archivo de esta carpeta.
3. Actualizar en `src/` los módulos modificados y el texto de la conexión de Gemini en `index.html`.
4. Recompilar la API con `node scripts/build.mjs`, o preparar los archivos compilados localmente. Conservar los recursos actuales de marca y diseño del hosting: al crear `dist/server/assets.mjs`, reemplazar únicamente los cuerpos de `app.mjs`, `sync.mjs`, `evidence.mjs`, `workspace.mjs` y `evidence-assistant.mjs`; no reemplazar CSS, logos ni módulos de laboratorios de producción con versiones anteriores del repositorio.
5. Actualizar `dist/server/index.js`, `gemini-evidence.mjs`, `providers.mjs` y `evidence.mjs` con sus versiones compiladas.
6. En cPanel → Setup Node.js App → aplicación RIVECT → Environment variables, configurar `GEMINI_API_KEY` una sola vez. `GEMINI_MODEL` es opcional (predeterminado `gemini-3.8-flash`). La clave también puede venir de `GOOGLE_API_KEY`. No agregar el valor a Git, ZIP de código, archivos públicos ni al navegador.
7. Reiniciar la aplicación Node desde cPanel. No basta con reemplazar los archivos: los módulos se conservan en memoria hasta reiniciar.
8. Entrar a `/portal`, abrir Pulso, comprobar la carga del expediente y guardar una modificación reversible. Verificar la persistencia después de recargar y revisar el radar. Comprobar el estado de Gemini con otro usuario con permiso de edición.

La clave del servidor se utiliza tanto para el análisis de empresas como para las preguntas, extracción y relaciones de evidencia. Los usuarios existentes autorizados comparten esa conexión y su cuota. `/api/ai/status` informa disponibilidad, proveedor y modelo, nunca la clave. Se conserva el acceso autenticado y la restricción de escritura de usuarios viewer.

La activación real requiere cargar una clave válida y realizar una consulta de prueba; las pruebas automatizadas usan un proveedor simulado y no acreditan disponibilidad, cuota ni permisos de una clave real.
