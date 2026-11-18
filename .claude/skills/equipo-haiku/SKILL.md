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

## Flujo

1. **Mirar antes de repartir.** Leé el código que se va a tocar, fijá la línea base (tests y build en verde) y anotá restricciones como la CSP, el hosting o las reglas del proyecto (`AGENTS.md`).
2. **Repartir.** Hacé la lista de archivos y dueños (hasta 10 trabajadores). Los reemplazos mecánicos que tocan muchos archivos los hace el orquestador **antes** de lanzar, para no pisar a nadie.
3. **Lanzar los 10** con prompts autosuficientes: contexto, archivos propios, interfaces, criterio de terminado y el comando de verificación.
4. **Integrar.** Cuando terminan: typecheck, tests y build, y además **probar de verdad** lo que se cambió (navegador, capturas, entradas reales). No confíes en un «pasan» de un agente sin correrlo vos.
5. **Ronda final: los 2 revisores** (solo lectura, abajo).
6. **Triage.** Corregí los hallazgos críticos, cada uno con un test que falla primero y pasa después. Los menores van a la lista de pendientes. Contale al usuario qué decidiste y por qué.
7. **Recién ahí:** commit, push y el registro que pida el proyecto (por ejemplo, BACKLOG).

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
