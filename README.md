# Pulso · desarrollo interno

Migración del código completo de la demo del equipo LIDIA en Rivera/Livramento. Conserva radar, ideas, perfiles, puntajes, calculadora, seguimiento, exportación, roadmap, fuentes e historial del monitor. Uso local; el repositorio no despliega la aplicación.

## Empezar

Requiere Node.js 22 o posterior. Sin paquetes externos ni claves API.

```sh
git clone https://github.com/Mather0967/pulso-radar.git
cd pulso-radar
npm run dev
```

Abrir http://localhost:4173. Al modificar src/ o scripts/ el servidor recompila y reinicia; recargar el navegador para ver cambios.

```sh
npm test
npm run build
npm start
```

Opcional: copiar `.env.example` a `.env` y configurar PORT o DATA_DIR. El servidor escucha exclusivamente en 127.0.0.1. No hay autenticación de equipo: no exponerlo en Internet ni en una red compartida.

## Mapa del código

| Ruta | Responsabilidad |
|---|---|
| src/index.html, styles.css, app.mjs | Pantallas, diseño e interacción |
| src/core.mjs | Normalización, ranking, ofertas y roadmap |
| src/providers.mjs | Consultas acotadas a Overpass y Algolia |
| src/monitor.mjs | Comparación de capturas, historial y fallos |
| src/worker.mjs | API separada del adaptador HTTP local |
| src/snapshot.json | Captura original con su procedencia y fecha |
| scripts/dev.mjs | Servidor Node y configuración local |
| scripts/storage.mjs | Persistencia JSON en disco con escritura atómica |
| scripts/build.mjs | Generación de dist/server; no editar dist |
| tests/ | Reglas, rutas, fallos y persistencia |

## Datos y monitor

Historial y caché se guardan en `data/`, excluido de Git. Notas, favoritas y perfil permanecen en localStorage de cada navegador; usar la exportación de la interfaz como respaldo. No hay sincronización de equipo todavía. Se conserva la captura original; no se importan automáticamente historial cloud ni notas de otros navegadores.

Con el servidor iniciado, ejecutar `npm run monitor` o usar el botón de revisión en la interfaz. El monitor no se programa automáticamente. La tarea de la demo anterior pertenece a otra aplicación y no alimenta este proyecto.

API: GET `/api/businesses?region=frontera|rivera|livramento`, GET `/api/signals?q=software`, GET `/api/agent/state`, POST `/api/agent/run`, POST `/api/agent/import`. Los POST se serializan para evitar sobrescribir revisiones concurrentes. Caché de 30 minutos; el monitor limita revisiones repetidas en una hora.

Ante fallos, el monitor conserva capturas anteriores con su fecha y registra errores. Propuestas y precios son hipótesis; el puntaje no predice ventas. Datos públicos no demuestran interés comercial.

Datos © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright). Fuentes: Overpass y Hacker News/Algolia. Conservar atribución. No depender del servidor comunitario para un producto comercial.

## Trabajo del equipo

Crear ramas por cambio, ejecutar `npm test`, abrir PRs y revisar antes de integrar. CI solo ejecuta pruebas, sin publicación. Próximos pasos: importación de respaldos, persistencia compartida de oportunidades, usuarios y permisos, configuración de fuentes y programación del monitor. Ver ROADMAP.md y MIGRATION.md.

