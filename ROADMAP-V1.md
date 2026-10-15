# Pulso · V1 de inteligencia comercial interna

Referencia: `pulso-radar-roadmap-v1.pdf`, recibido el 14/10/2026.
Pulso es una herramienta interna de RIVECT. Avanza en incrementos independientes y no bloquea otros proyectos.

## Alcance aplicado

Sectores piloto: contables, jurídicos y escribanos. Un ciclo: empresa real → evidencia local → comparables internacionales → análisis con límites → informe de reunión → piloto medido. Fuente y fecha obligatorias; hechos revisados separados de hipótesis. No hay puntuación comercial en este ciclo.

La página inicial es **Ciclo de oportunidad**. Las pantallas anteriores siguen disponibles para compatibilidad y sus estimaciones no alimentan los informes V1.

| Fase del PDF | Implementación | Pendiente de validación real |
| --- | --- | --- |
| 0. Alcance | Sectores y criterios explícitos; límites visibles. | Firma del alcance por el equipo. |
| 1. Fundaciones | Modelo de evidencia y pruebas, persistencia local exportable. Orquestación directa, sin infraestructura multiagente. | Evaluar repositorio y n8n con un flujo concreto; no se ha demostrado que n8n aporte valor. |
| 2. Captura local | Notas, formularios, transcripciones pegadas y archivos TXT/MD. Original, fuente, fecha y revisión conservados. Búsqueda por palabras y consultas a Gemini sobre el expediente, con citas literales validadas. Extracción de campos como hipótesis separadas y propuestas de relaciones revisables. | Validar con una clave Gemini real. La clave temporal existente se reutiliza en memoria; no se agregan secretos. Transcripción de audio y formatos binarios siguen pendientes. |
| 3. Biblioteca | Casos con URL consultable, fecha, sector, condiciones y revisión. Asociación explícita por expediente. Alertas de vigencia. | Cargar y verificar casos internacionales reales con fuentes originales. No se precargan casos inventados. |
| 4. Análisis | Problema, similitudes, diferencias, hipótesis, datos faltantes, alternativas y próxima prueba. Gemini puede proponer el borrador con citas; requiere cargarlo en el formulario, revisarlo y guardarlo. Sin diagnóstico validado automáticamente. | Revisión del análisis con evidencia real. |
| 5. Informe | Versiones históricas independientes, fuentes incluidas, faltantes visibles y exportación HTML imprimible. | Revisar con el equipo el primer informe para una reunión real. |
| 6. Piloto | Registro de tiempo antes/después, tarea, método, referencia, validación y criterios de cierre. Alertas justificadas al abrir el expediente. | Ejecutar una oportunidad real y demostrar ahorro. No hay notificaciones de fondo. |
| 7. Cierre | Lista verificable; un informe desactualizado bloquea el cierre del piloto. | Cierre operativo humano y registro de aprendizajes; todavía no se declara V1 cerrada. |

## Uso y respaldo

1. Agregar una empresa real desde Empresas o el botón superior.
2. Abrir Ciclo de oportunidad y registrar evidencia con referencia y fecha.
3. Cargar casos internacionales consultables y explicar sus condiciones.
4. Vincular casos y guardar el análisis. Declarar incertidumbre y datos faltantes.
5. Emitir una versión del informe; si faltan fuentes o revisión se emite como borrador.
6. Medir la misma tarea antes y con Pulso. Documentar el método, revisar el informe vigente y validar el resultado.

Todo el ciclo es local al navegador. **Exportar respaldo** incluye empresas, evidencia, casos, análisis, informes y pilotos; **Restaurar respaldo** reemplaza esos datos tras confirmación. No hay sincronización compartida ni carga remota de archivos. Las transcripciones se ingresan ya revisadas. TXT/MD: hasta 200 KB y 12.000 caracteres por registro. La exportación HTML conserva el texto y las fuentes del informe al emitirlo.

Las alertas indican revisión pendiente o fuentes con más de 90 días. Son reglas de revisión, no pruebas de necesidad comercial. Un enlace guardado no implica que Pulso haya visitado o verificado su contenido. El equipo marca explícitamente la revisión.

## Fuera de V1

Monitoreo continuo amplio, agentes autónomos complejos, integraciones masivas, predicción, puntuación comercial, propuestas avanzadas y oferta a terceros.

## Verificación de este cambio

Construcción local y 24 pruebas de reglas, rutas, persistencia y contrato de Gemini con respuestas simuladas. La vista previa de navegador no pudo verificarse por un fallo del entorno de automatización. No se ejecutaron llamadas reales a Gemini: no hay una clave disponible en este entorno. No se inventan resultados del piloto.

## Asistencia Gemini en el ciclo V1

En **Asistente IA**, configurar la clave temporal de Gemini que ya usa Pulso. Volver a **Ciclo de oportunidad**:

- Evidencia/Biblioteca: seleccionar un original para proponer campos o preguntar por los registros del expediente.
- Análisis: seleccionar los casos que se pueden enviar y pedir una propuesta de relaciones. Revisar el borrador antes de guardarlo.
- Una propuesta extraída sólo se guarda mediante una acción explícita y siempre como hipótesis sin revisar. El original y su texto completo permanecen disponibles.

Las consultas envían únicamente los registros del expediente activo y los casos seleccionados (o la biblioteca en su pestaña), hasta 40 registros y 120.000 caracteres de datos. No se hacen búsquedas externas en este flujo. Si una cita no corresponde literalmente al original, un ID no existe o una relación carece de fuente local, se rechaza la respuesta. Esto valida trazabilidad, no la corrección semántica: sigue siendo necesaria la revisión humana.

Se usa el endpoint Interactions, modelo gemini-3.8-flash, response_format JSON con esquema y store:false, de acuerdo con [la documentación oficial](https://ai.google.dev/gemini-api/docs/structured-output). La clave sólo se transmite por encabezado, no se añade al prompt ni al respaldo. Los errores del proveedor se devuelven sin su contenido original.
