# Pulso · RIVECT

Espacio operativo de investigación, seguimiento y laboratorios de automatización.

Ver [PRODUCT.md](PRODUCT.md) para funciones implementadas, persistencia, límites y validación. La identidad y la configuración del Site existente se preservan en `.openai/hosting.json`.

Construir: `node scripts/build.mjs`. Pruebas: `node --test tests/*.test.mjs`. Desarrollo: `node scripts/dev.mjs`. El servidor local escucha únicamente en loopback.

Historial: [ROADMAP-V1.md](ROADMAP-V1.md). Este documento histórico describe la primera entrega; PRODUCT.md describe la versión actual.

## Proyecto LANDUR

La PWA financiera de LANDUR se desarrolla en [`projects/landur/`](projects/landur/README.md). Por solicitud del usuario se integra al selector de proyectos del portal RIVECT, junto a Pulso, con sesión compartida y permisos/almacenamiento separados. Ver la [integración y publicación](projects/landur/docs/PORTAL-RIVECT.md). La lógica y los datos de Pulso se preservan; los cambios de portal y despliegue están en la rama de trabajo, no acreditan publicación en Namecheap.
