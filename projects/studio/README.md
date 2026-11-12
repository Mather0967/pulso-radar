# RIVECT Studio

Demo comercial para visitas presenciales. Elegís un rubro y la app recorre sola el mapa del negocio:
muestra el problema, abre las áreas, ejecuta las automatizaciones con datos de ejemplo, muestra las
interfaces (WhatsApp, CRM, agenda, tienda) y termina en un antes/después y un resumen guardable.

Rubros incluidos: **Ferretería**, **Clínica odontológica**, **Restaurante** (~4 min cada uno a ritmo normal).

## Usar en una visita

| Necesito | Cómo |
|---|---|
| Abrir sin internet | `npm run build:offline` una vez → copiar `dist-offline/index.html` a la notebook → doble clic. Es un único archivo, sin servidor. |
| Desarrollar | `npm install` → `npm run dev` |
| Pausar / seguir | Barra inferior o **espacio** |
| Capítulo anterior / siguiente | **← / →** o la barra de capítulos (clic en cualquier punto para saltar) |
| Ritmo | Botón "Ritmo tranquilo / normal / rápido" |
| Tomar el control | Mover el mapa, tocar un nodo o "Tomar el control". "Volver al recorrido" retoma donde estaba. |
| Diagnóstico | "Diagnóstico" → tocar lo que cuenta el dueño: resalta el área y queda anotado en la visita. |
| Pregunta interactiva | En el capítulo 3 el recorrido se detiene en "¿Qué pasa si no responde?". El cliente elige; o play para seguir. |
| Guardar la visita | "Lo que vimos" → nombre, contacto, problemas, módulos ("Le interesa" en cada nodo), notas → Guardar / Exportar (JSON) / Imprimir. Se guarda en esta computadora (localStorage). |

## Demo de restaurantes

En modo portal, la tarjeta de Restaurante suma el botón "Abrir demo de gestión" hacia `/studio/restaurantes/` (ver `namecheap/README.md`). Esa carpeta es un build externo copiado dentro de `public/`: recompilar el Studio con `npm run build:portal` la borra y hay que volver a copiarla.

## Credibilidad

Todo lo que se ve es simulación con datos de ejemplo y así se rotula. La única forma de marcar una
integración como verificada es `src/content/integrations.ts`, con fecha y evidencia obligatorias.
Las comparaciones no muestran porcentajes; solo cuentan pasos del propio diagrama ("Escenario ilustrativo").

## Agregar un rubro

Un archivo en `src/content/scenarios/` que exporta un `Scenario` (copiar `ferreteria.ts` como plantilla)
y una línea en `scenarios/index.ts`. Después `npm test`: valida ids colgados, solapamientos del layout,
duración del recorrido y que cada subtítulo dure lo suficiente para leerse.

## Documentos

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — decisiones de arquitectura (motor de simulación, director del recorrido, grafo jerárquico).
- [docs/CREATIVE-DIRECTION.md](docs/CREATIVE-DIRECTION.md) — guiones, textos y dirección visual.
