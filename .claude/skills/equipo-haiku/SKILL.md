---
name: equipo-haiku
description: Orquestar un equipo de 12 sub-agentes Haiku desde el modelo principal. 10 trabajan en paralelo, cada uno dueño exclusivo de sus archivos, y reportan solo lo relevante y crítico. Al final entran 2 revisores de solo lectura, un pentester y un cliente complicado y escéptico. Usar cuando el usuario pida «el equipo de haikus», «los 12 haikus», «sub-agentes haiku», o una tarea grande que se pueda repartir por archivos.
---

# Equipo Haiku (10 + 2)

El modelo principal es el **orquestador**: reparte, integra, decide y verifica. Los Haiku hacen el trabajo y le reportan corto. Nada llega al usuario sin que el orquestador lo haya comprobado.

## Reglas del equipo

1. **Un archivo, un dueño.** Antes de lanzar, repartí los archivos en lotes que no se superpongan. Cada prompt dice «You own ONLY: …» y prohíbe editar cualquier otro archivo. Dos agentes nunca tocan el mismo archivo al mismo tiempo. Si uno necesita cambiar un archivo ajeno, lo pide y decide el orquestador.
2. **Interfaces fijadas en el prompt.** Cuando un agente usa lo que crea otro en paralelo, el prompt trae la firma exacta (tipos, exports, rutas y nombres de clases). Así pueden trabajar a la vez sin esperarse.
3. **Reportes cortos.** Cada agente responde en 5 a 10 líneas: qué cambió, en qué archivos, el resultado de la verificación que corrió y los problemas. Nada de volcados de código ni resúmenes elogiosos.
4. **Aprobación solo de lo crítico.** Los cambios chicos se aplican directo. Lo crítico (errores de plata o de datos, seguridad, cambios de interfaces compartidas, borrados o comportamiento que el usuario no pidió) se propone y lo aprueba o rechaza el orquestador.
5. **Sin efectos externos.** Ningún Haiku hace commits, push, deploys, abre sesiones ni lanza otros agentes. Eso lo hace solo el orquestador, después de verificar.
6. **Modelo.** Todos con `model: "haiku"` en la herramienta Agent. Los 10 trabajadores van en paralelo (`run_in_background: true`). Los 2 finales también van en paralelo entre sí, pero recién cuando terminaron los 10.

## Qué hace el orquestador (lo mínimo)

El orquestador **no explora, no programa y no prueba a mano**: eso lo hacen los Haiku. Hace solo 5 cosas:

1. **Decidir**: qué se construye, qué es crítico y qué se le pregunta al usuario (nunca lo delega).
2. **Repartir**: aprobar el mapa de archivos y dueños que propone el Haiku 1.
3. **Lanzar**: un mensaje con todos los prompts en paralelo.
4. **Aprobar o rechazar** solo lo que los agentes marcan como crítico.
5. **Cerrar**: corre él mismo **un** comando de verificación final (no confía en el «pasan» de nadie), hace commit y push, y le resume al usuario.

## Los roles de los 12

| # | Rol | Qué hace | Edita |
|---|-----|----------|-------|
| 1 | Explorador-repartidor | Lee el código, fija la línea base (tests y build), anota restricciones (`AGENTS.md`, CSP, hosting) y propone el mapa «archivo → dueño» con las interfaces entre ellos | Nada |
| 2–9 | Trabajadores | Cada uno implementa su lote de archivos con TDD cuando hay lógica, y corre su verificación | Solo sus archivos |
| 10 | Integrador-QA | Cuando terminan 2–9: typecheck, tests, build y prueba real (navegador con capturas, entradas reales). Reporta **solo fallas**, con su archivo dueño | Nada |
| 11 | Pentester | Revisión de seguridad del diff (abajo) | Nada |
| 12 | Cliente escéptico | Usa el producto como un cliente desconfiado (abajo) | Nada |

Si la tarea es chica, se usan menos trabajadores (2–9): manda la regla de un dueño por archivo, no llegar a 12. El 1, el 10, el 11 y el 12 van siempre.

## Flujo

1. **Haiku 1** explora y devuelve el mapa de archivos en ≤15 líneas. El orquestador lo aprueba o lo corrige.
2. Los reemplazos mecánicos que tocan muchos archivos los hace un solo trabajador **antes** que el resto, para no pisar a nadie.
3. **Haikus 2–9** en paralelo, con prompts autosuficientes: contexto, archivos propios, interfaces, criterio de terminado y comando de verificación.
4. **Haiku 10** integra y prueba. Si algo falla, el orquestador relanza **al dueño de ese archivo** con el error (no lo arregla él).
5. **Haikus 11 y 12** en paralelo, solo lectura.
6. **Triage del orquestador.** Lo crítico vuelve a su dueño, con la orden de escribir primero un test que falle. Lo menor va a pendientes. Le cuenta al usuario qué decidió y por qué.
7. **Cierre del orquestador**: un comando de verificación propio, commit, push y el registro que pida el proyecto (por ejemplo, BACKLOG, que puede escribir un trabajador).

## Revisor 11 · Pentester (Haiku, solo lectura)

Prompt base:

> READ-ONLY. Do NOT edit files, commit, start sessions or agents, or contact any external host. Scope: ONLY this repository's code changed in this task (`git diff <base>..HEAD`) and local servers you start yourself on localhost. Never test banks, third-party providers or production hosts.
> Act as a penetration tester reviewing the change: authZ/authN on every new endpoint or page, session/cookie handling, CSRF, XSS (any HTML built from data), injection, path traversal in static file serving, secrets in client code or git, CSP weakening, open redirects, unsafe dependencies added, data exposed in the client bundle, error messages leaking internals.
> Prove each finding with a concrete request/input and the observed response (local only).
> Reply in Spanish, max 12 lines: ONLY confirmed findings ranked by severity (crítica/alta/media), each with reproduction and fix suggestion. If none: «Sin hallazgos de seguridad.»

## Revisor 12 · Cliente complicado y escéptico (Haiku, solo lectura)

Prompt base:

> READ-ONLY. Do NOT edit files, commit, or start sessions/agents. You are a skeptical, hard-to-please business owner (Uruguay, voseo) who is being sold this product. You distrust everything and try to find every possible problem.
> Use the product like that owner would: run it locally (tests, scripts, a headless browser via Playwright if it's a UI), try odd and real-world inputs, wrong orders of steps, mobile width, slow or offline moments, back button, reloads, typos, huge or empty values. Check every claim on screen: numbers that don't add up, promises the demo can't keep, texts that sound fake or exaggerated, confusing words, things that look broken or unprofessional, anything that would make you say «esto no me sirve» or «me están vendiendo humo».
> Reply in Spanish, max 15 lines, as a list of objections ranked by how much they'd hurt a sale or daily use: what you did → what happened → why it bothers you. Mark which ones are real bugs vs. perception problems. If you truly find nothing: «No encontré nada que me frene.»

## Antes de cerrar

- Cada hallazgo crítico de los revisores quedó corregido con su test, o como decisión explícita que se le informa al usuario.
- Los resultados que reportás al usuario son los que corriste vos (suite, build, capturas), no los que dijeron los agentes.
- Decile al usuario cuántos agentes usaste y por qué: si la tarea toca menos de 10 archivos, usá menos trabajadores. La regla de un dueño por archivo manda sobre llegar a 10.
