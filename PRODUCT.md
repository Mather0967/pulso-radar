# Pulso · Espacio operativo RIVECT

## Qué funciona

- Cartera de empresas editable, archivo reversible, responsable, fecha de contacto y etapa comercial.
- Inicio con métricas provenientes de registros reales, tareas pendientes/completadas y próximos contactos.
- Evidencia original con fuente, fecha y revisión; biblioteca de casos; análisis revisado y versiones históricas de informes descargables.
- Espacio por usuario de ChatGPT, guardado en servidor, copia local de recuperación, exportación completa y control de conflictos entre dispositivos. Un conflicto requiere elegir una versión, nunca se sobrescribe silenciosamente.
- Cinco laboratorios interactivos: agenda, pedidos, inventario, tareas y base de consultas. Permiten crear/eliminar registros, cambiar estados, ajustar stock, buscar, importar/exportar JSON y descargar una app HTML autónoma. El CSV neutraliza fórmulas de planillas.
- Gemini con clave temporal en memoria para investigación y asistencia con citas. La extracción propone hipótesis separadas del original. Ninguna respuesta sustituye la revisión de fuentes.
- Naranja mandarina `#FF762E`, azul medianoche `#11222C`, modos claro/oscuro y diseño adaptable.
- Símbolo RIVECT original con una cruz cristiana latina en espacio negativo. El eje representa fundamento; los caminos convergentes representan inteligencia, tecnología y dirección. La identidad generada se entrega por separado; el sitio usa una adaptación vectorial del concepto.

## Persistencia y acceso

El acceso del Site permanece privado. Las rutas de datos requieren identidad de ChatGPT y aíslan la información por ID de usuario. El backend usa el binding BUCKET y escrituras condicionales con ETag. No hay base de datos creada al atender peticiones ni claves de Gemini almacenadas. La copia local permite recuperar cambios pendientes. Ante dos versiones, el panel de guardado permite descargar respaldo, reintentar con confirmación o cargar la copia del servidor.

Los registros de navegador de la versión anterior se conservan. El primer guardado los lleva a la cuenta cuando el servidor está vacío. Si ya hay información remota, Pulso requiere revisar ambas versiones. Las tareas y laboratorios forman parte del respaldo completo. Archivar una empresa conserva sus fuentes e informes.

## Límites explícitos

Los laboratorios son herramientas para validar procesos; no envían mensajes, cobran pagos, reservan recursos externos ni sustituyen un ERP. La base de consultas devuelve respuestas cargadas por el usuario; no simula un modelo de IA. Las apps HTML descargadas guardan datos en el navegador que las abre y no sincronizan con Pulso. Las transcripciones de voz deben ingresarse como texto; no se incluye un servicio de transcripción ni importación de PDFs binarios.

La disponibilidad, el acceso al modelo y la cuota de Gemini dependen de Google. Esta sesión prueba su contrato con respuestas simuladas y conserva pendiente la comprobación con una clave real. El radar depende de fuentes públicas y conserva los resultados visibles si una actualización falla. No hay programación automática activada.

Límites por espacio: 1000 empresas, 100 laboratorios (500 registros cada uno), 2000 tareas y hasta 3 MB por guardado. El acceso compartido por equipo o los permisos por rol no están implementados: cada cuenta tiene su espacio propio. No se afirma una garantía de disponibilidad o funcionamiento del 100%.

## Verificación

28 pruebas de reglas, rutas, persistencia, aislamiento de usuarios, conflictos, respaldo, fuentes y contrato de Gemini. Pruebas de navegador con rutas locales simuladas del Worker: creación de empresa/evidencia, agenda con cambio de estado, sincronización, recarga, recuperación en otra sesión y vista móvil sin desbordes. Pruebas adicionales para los cinco flujos de laboratorio. Se inspeccionan capturas de escritorio y móvil; los datos QA no se publican.

## Desarrollo

`node scripts/build.mjs` y `node --test tests/*.test.mjs`. Servidor local: `node scripts/dev.mjs`. Para probar identidad local de forma explícita, `PULSO_LOCAL_AUTH=1`; este ajuste sólo existe en el adaptador de desarrollo y no en el Worker publicado. No exponer el servidor de desarrollo fuera de loopback. La publicación se realiza con el flujo de Sites y el ID existente en `.openai/hosting.json`.

## Informe de empresa (octubre de 2026)

El Asistente IA usa Groq GPT-OSS con `browser_search` para investigar la empresa, candidatos de redes sociales, dos casos multinacionales y riesgos con prevención y controles del piloto. Cada afirmación requiere referencias; los perfiles sin una fuente con la URL exacta se omiten y se marcan como faltantes. La identidad sigue pendiente cuando los metadatos no respaldan la coincidencia. El contenido generado requiere revisión humana.

`POST /api/ai/research` crea un trabajo; `GET /api/ai/research/:id` consulta su estado. Se mantiene un trabajo activo por sesión de proyecto y se conservan los informes anteriores ante fallos. La consulta envía solamente los datos identificatorios y del proceso; las finanzas se calculan en código. Si la búsqueda responde en prosa se hace una segunda llamada sin búsqueda para convertir la evidencia a JSON, conservando la procedencia original. Ambas llamadas consumen cuota del proveedor.

Los escenarios conservador, base y optimista tienen supuestos editables. Horas liberadas × costo de hora representa capacidad; sólo la proporción indicada como reducción real de gasto se contabiliza como ahorro efectivo. La contribución adicional aplica conversión y margen a oportunidades recuperadas. El cambio mensual descuenta el costo recurrente; la curva de doce meses descuenta la implementación. Los valores desconocidos quedan pendientes, y se conservan los resultados negativos. Hay exportación CSV y JSON.

La validación automática cubre cálculos, valores desconocidos, límites, referencias, perfiles sin fuente, normalización de prosa, trabajos asincrónicos y aislamiento por proyecto. La disponibilidad de investigación web depende de la cuota de Groq; los tests usan respuestas simuladas y no demuestran disponibilidad del servicio.

### NVIDIA para prototipado

La conexión NVIDIA tiene prioridad cuando está configurada en Passenger y usa DeepSeek V4.1 Flash. El informe admite 24.576 tokens máximos de salida; la cuota efectiva depende de NVIDIA. La búsqueda web usa Tavily por separado y consume dos búsquedas básicas por intento. Los extractos se conservan desde la respuesta del buscador y no se reemplazan por citas inventadas. También se puede analizar exclusivamente los datos aportados, con una indicación explícita de que no se consultó internet. Sin claves nuevas se mantiene el proveedor anterior. La activación y prueba real quedan pendientes de las claves y disponibilidad del hosting.
