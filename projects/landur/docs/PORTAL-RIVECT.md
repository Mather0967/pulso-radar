# LANDUR como proyecto del portal RIVECT

Actualización de alcance de acceso solicitada por el usuario · 24 de octubre de 2026.

## Decisión actual

**LANDUR debe aparecer en «Mis proyectos», junto a Pulso, después de iniciar sesión en RIVECT.** Este modo pasa a ser el destino de integración preferido. No se necesita otro dominio, otra aplicación Passenger ni una segunda contraseña para LANDUR.

La aplicación independiente y su ZIP anteriores siguen siendo útiles para pruebas aisladas, pero **no agregan por sí solos la tarjeta ni la sesión compartida al portal**. No seguir la guía de subdominio separado si lo que se quiere es esta integración.

Esto modifica el acceso/despliegue, no las reglas financieras ni la secuencia de los tres sprints. LANDUR continúa siendo una alfa: integración de portal no equivale a validación financiera ni aprobación de pentesting.

## Cómo funciona

```text
Login RIVECT existente
          ↓
Mis proyectos (/portal)
          ├── Pulso  → /pulso
          └── LANDUR → /landur/
```

- Se conserva el sistema de cuentas e invitaciones del portal (`AuthStore`).
- LANDUR verifica la sesión del portal y los permisos en cada solicitud, no solo en la tarjeta.
- No hay contraseña `LANDUR_PASSWORD` ni cookie `landur_session` en este modo.
- Cerrar sesión desde LANDUR cierra la sesión de RIVECT, también para Pulso.
- Los cambios financieros registran el ID del usuario real del portal en la auditoría.
- La interfaz incluye «← Mis proyectos».
- Se conserva la identidad visual RIVECT; no se reemplazan la landing, la administración existente ni las páginas de acceso del hosting.

## Permisos por proyecto

| Usuario | Pulso | LANDUR |
|---|---|---|
| Administrador activo | Edición | Edición |
| Miembro con `projects.pulso` | Según asignación | Sin acceso salvo asignación explícita |
| Miembro con `projects.landur` | Sin acceso salvo asignación explícita | `viewer` o `editor` |
| Usuario inactivo / sesión vencida | Sin acceso | Sin acceso |

En «Mis proyectos», los administradores ven **Acceso a proyectos**:

1. Seleccionar un usuario existente.
2. Elegir permiso de Pulso y LANDUR de forma independiente.
3. Guardar. Las sesiones del usuario afectado se invalidan y debe volver a ingresar.

Los miembros no pueden administrar permisos. Un viewer puede consultar y exportar, pero no registrar, pagar ni importar. El servidor impone esa restricción aunque se manipule el navegador.

La administración anterior de Pulso se mantiene compatible: guardar su permiso no borra el de LANDUR. Las invitaciones que use la UI anterior continúan funcionando; se puede asignar LANDUR al usuario creado desde el selector de proyectos. La API de invitaciones también admite el mapa explícito de proyectos, pero no se ha sustituido la pantalla de invitación del hosting.

Los administradores tienen acceso global, como en el portal existente. No son un rol financiero limitado; si un usuario no debe ver LANDUR, debe ser miembro con permisos explícitos, no administrador.

## Datos, rutas y PWA

- Código de LANDUR: `projects/landur/server/` y `projects/landur/public/`, bajo la raíz de la aplicación RIVECT, **fuera de su carpeta pública**.
- Base: `DATA_DIR/landur/landur.sqlite`. Con la configuración por defecto del portal, `<raíz RIVECT>/data/landur/landur.sqlite`.
- Pulso mantiene su almacenamiento separado en `DATA_DIR/pulso`.
- La base de LANDUR se abre de forma diferida para solicitudes autorizadas. Sin datos precargados ni importación automática de una demo.
- Recursos servidos mediante una lista permitida de rutas; no se expone `projects/landur/` como directorio estático completo.
- La PWA resuelve recursos/API dentro de `/landur/`.
- Manifiesto, inicio y service worker limitados a `/landur/`; no controla `/portal`, `/auth` ni Pulso.
- El service worker solo cachea la interfaz sin datos personales. No cachea API, exportaciones ni respuestas de login redirigidas.
- Para instalar en iPhone: abrir `https://rivect.net/landur/` desde Safari después de ingresar al portal, y usar Compartir → Agregar a pantalla de inicio. Reemplazar el dominio solo si cambia la configuración real del portal.

## Qué cambia en el despliegue existente

El instalador `scripts/cpanel-deploy.mjs` incorpora a sus rutas controladas:

- `server/projects.mjs` y `server/landur.mjs`.
- `public/projects.css`, `public/projects.mjs` y `public/projects-brand.svg`.
- `projects/landur/server/` y `projects/landur/public/`.
- La actualización de `server/main.mjs` que conecta estas rutas con el login existente.

El instalador conserva `server/site.mjs`, landing, páginas de acceso, archivos privados y datos de ambos proyectos. Toma respaldo de código y revierte la copia si falla. Antes de publicar ejecuta la suite de Pulso/portal y la de LANDUR.

No cambia el cron ni agrega otro. **El despliegue automático existente sigue siguiendo `main`; una rama de trabajo no modifica producción.** No se cambió el clon ni la rama del cPanel en esta sesión.

### Pasos para verlo en el portal real

1. Revisar/aprobar los cambios de esta rama para su publicación. No se ha hecho merge ni despliegue remoto en esta sesión.
2. Confirmar runtime del Passenger del portal: Node >=22.13 con `node:sqlite`. La versión de un `node` de Terminal distinto no lo acredita.
3. Tomar un respaldo privado del portal y sus datos. Si ya existe una base de LANDUR, usar copia consistente SQLite; no copiar un único `.sqlite` de una base activa ignorando WAL.
4. Publicar mediante el procedimiento existente del portal una vez que la revisión llegue a la rama que ese procedimiento despliega. **No ejecutar `scripts/cpanel-deploy.mjs` en la rama de trabajo: el instalador de producción exige `main`.**
5. Confirmar reinicio de la aplicación Passenger RIVECT. No levantar otro `npm start` de LANDUR.
6. Entrar como administrador y comprobar que «Mis proyectos» muestra Pulso y LANDUR.
7. Asignar LANDUR a los usuarios necesarios y probar editor, viewer, usuario sin permiso y revocación.
8. Comprobar Pulso sin cambios en sus datos ni permisos anteriores.
9. Probar instalación en Safari/iPhone y respaldos antes de aceptar el piloto. No usar datos reales hasta superar las puertas del roadmap.

El ZIP independiente `landur-pwa-cpanel-0.2.0.zip` no es un instalador del portal. No sobrescribir la raíz de RIVECT con ese ZIP.

## Respaldos en modo portal

La identidad y los permisos viven en el almacenamiento privado existente de RIVECT. Los movimientos financieros viven en `DATA_DIR/landur/landur.sqlite`; ambas partes deben incluirse en el procedimiento de respaldo/recuperación del portal.

El script `npm run backup` de la app independiente está diseñado para su propia configuración y no debe ejecutarse con valores improvisados contra el portal. Acordar un procedimiento específico de copia consistente del SQLite y respaldo de identidad antes de usar datos reales. No hacer migración automática entre una base standalone y esta base nueva: requiere corte, validación y respaldo.

## Evidencia de pruebas y límites

- Suite raíz: catálogo por permisos, login compartido, controles CSRF/origen, lectura/escritura, aislamiento, asignación/revocación y compatibilidad con el admin anterior.
- Test de instalación: preservación de landing, portal previo, identidad/datos y base LANDUR al copiar código.
- Suite de LANDUR sin regresiones en el modo independiente.
- `npm run test:portal` desde `projects/landur/`: QA Chromium de tarjetas, acceso sin segunda contraseña, registro auditado, permisos, retorno al portal, layout móvil, scope/caché de PWA y logout compartido.

Las pruebas usan un portal temporal con identidades sintéticas y sustitutos de `site.mjs`/páginas de cuenta porque los originales se conservan en Namecheap y no están en este repositorio. **No acreditan despliegue real, funcionamiento del login visual original en el hosting, aceptación en iPhone ni pentesting.**
