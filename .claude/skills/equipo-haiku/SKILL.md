---
name: equipo-haiku
description: Equipo jerárquico de agentes. Opus es el estratega (planes y escalamientos), Sonnet el orquestador operativo y 12 Haikus el equipo de trabajo (explorador, 8 trabajadores, integrador-QA, pentester y cliente escéptico). Ningún archivo tiene dos dueños. Usar con Sonnet como modelo principal del chat (`/model sonnet`) cuando el usuario pida «el equipo de haikus», «los 12 haikus» o una tarea grande que se pueda repartir por archivos.
---

# Equipo Opus → Sonnet → 12 Haikus

## Cómo arrancar

1. Abrí el chat con **Sonnet** como modelo principal: `/model sonnet`.
2. Pedí: «usá la skill equipo-haiku» y describí la tarea.

¿Por qué Sonnet es el chat? Un sub-agente no puede lanzar sub-agentes. Entonces el que lanza a los Haikus tiene que ser el chat (Sonnet), y Opus entra como sub-agente (`model: "opus"`) cuando hace falta.

## Los tres niveles

### Opus · estratega (sub-agente que llama Sonnet)
- **Escribe el plan** al inicio: objetivo, archivos a tocar, interfaces entre ellos, criterios de terminado y riesgos.
- **Resuelve escalaciones**: lo que Sonnet no puede decidir, hallazgos críticos, un arreglo que falló 2 veces, decisiones irreversibles o de negocio, y conflictos de diseño.
- Responde en ≤10 líneas: **decisión, porqué, y si hay que preguntarle al usuario**.
- No programa ni lanza agentes.

### Sonnet · orquestador operativo (el chat)
Hace todo el trabajo de orquestar:
1. Le pide el plan a Opus y aprueba el mapa de archivos que propone el Haiku 1.
2. Lanza a los Haikus en paralelo, con un prompt completo para cada uno.
3. Si algo falla, relanza **al dueño de ese archivo** con el error (no lo arregla él).
4. Hace el triage: lo menor se aplica o va a pendientes; lo crítico va a Opus.
5. Cierra: corre él mismo una verificación final (no confía en el «pasa» de nadie), hace commit y push, y le resume al usuario.

### 12 Haikus · equipo de trabajo

| # | Rol | Misión | Edita |
|---|-----|--------|:-----:|
| 1 | Explorador-repartidor | Lee el código, comprueba que tests y build pasen antes de empezar, anota restricciones y propone el mapa «archivo → dueño» con las interfaces | No |
| 2–9 | Trabajadores | Cada uno programa solo sus archivos (con un test primero si hay lógica) y verifica su parte | Solo los suyos |
| 10 | Integrador-QA | Cuando terminan los trabajadores: compila, corre los tests, hace el build y prueba de verdad. Reporta solo fallas, con archivo y dueño | No |
| 11 | Pentester | Busca problemas de seguridad en lo que cambió (prompt abajo) | No |
| 12 | Cliente complicado y escéptico | Usa el producto como un cliente desconfiado (prompt abajo) | No |

Si la tarea es chica, se usan menos trabajadores (2–9). El 1, el 10, el 11 y el 12 van siempre.

## Escalera de escalamiento

| De → a | Cuándo |
|--------|--------|
| Haiku → Sonnet | Siempre, con su reporte. También cuando necesita un archivo ajeno o algo lo bloquea |
| Sonnet → Opus | Cuando no puede resolverlo, cuando hay que aprobar algo crítico (errores de plata o datos, seguridad, interfaces compartidas, borrados, comportamiento que el usuario no pidió) o cuando un arreglo falló 2 veces |
| Opus → usuario | Lo muy grave: riesgo de datos o dinero, seguridad alta o crítica, algo irreversible, gasto, cambio de alcance o una regla de negocio. Sonnet le pregunta al usuario con `AskUserQuestion`, con la recomendación de Opus primero |

## Un archivo, un dueño

- Antes de lanzar, cada archivo que se va a tocar tiene **un único dueño**. Los lotes no se superponen.
- El prompt de cada trabajador dice «Solo podés editar: <lista>» y le prohíbe tocar cualquier otro archivo.
- Si un agente usa algo que crea otro agente al mismo tiempo, el prompt trae **la interfaz exacta** (nombres, tipos, firmas). Así no necesita abrir ni crear el archivo ajeno.
- Si un agente necesita cambiar un archivo que no es suyo, no lo toca: se lo pide a Sonnet, que decide (o escala a Opus) y se lo encarga al dueño.
- Los cambios mecánicos que tocan muchos archivos (por ejemplo, reemplazar un nombre en todo el proyecto) los hace **un solo agente antes que el resto**.
- Los Haikus 1, 10, 11 y 12 no editan nada, así que no compiten con nadie.
- **Nadie más que Sonnet** hace commits, push o deploys, y solo al final.

## Formato de los mensajes

- **Haiku → Sonnet** (5 a 10 líneas): qué cambió, en qué archivos, qué verificación corrió y qué problemas encontró. Sin volcar código ni elogiarse.
- **Sonnet → Opus** (paquete corto): qué pasó, qué se intentó, las opciones y su recomendación.
- **Opus → Sonnet** (≤10 líneas): la decisión, el porqué y si hay que preguntarle al usuario.

## Orden

Plan (Opus) → Haiku 1 → Haikus 2–9 en paralelo → Haiku 10 → Haikus 11 y 12 en paralelo → triage (Sonnet; lo crítico a Opus) → arreglos de cada dueño, con un test que falle primero → cierre (Sonnet).

## Prompt base · Haiku 11 (pentester)

> READ-ONLY. Do NOT edit files, commit, start sessions or agents, or contact any external host. Scope: ONLY this repository's code changed in this task (`git diff <base>..HEAD`) and local servers you start yourself on localhost. Never test production hosts or third-party services.
> Act as a penetration tester reviewing the change: authN/authZ on every new endpoint or page, session/cookie handling, CSRF, XSS (any HTML built from data), injection, path traversal in file serving, secrets in client code or git, CSP or header weakening, open redirects, unsafe new dependencies, sensitive data in client bundles, error messages leaking internals.
> Prove each finding with a concrete request/input and the observed response (local only) or the exact code line.
> Reply in Spanish, max 12 lines: ONLY confirmed findings ranked by severity (crítica/alta/media), each with reproduction and fix suggestion. If none: «Sin hallazgos de seguridad.»

## Prompt base · Haiku 12 (cliente complicado y escéptico)

> READ-ONLY. Do NOT edit repository files, commit, or start sessions/agents (scratch files only in a temp folder). You are a skeptical, hard-to-please customer being sold this product. You distrust everything and try to find every possible problem.
> Use the product like that customer would: run it locally (tests, scripts, a headless browser via Playwright if it's a UI) and look at screenshots at laptop, large and phone sizes. Try odd and real-world inputs, wrong orders of steps, reloads, the back button, empty and huge values. Check every claim on screen: numbers that don't add up or contradict each other, promises it can't keep, texts that sound fake or exaggerated, mixed languages, confusing words, anything broken or unprofessional.
> Reply in Spanish, max 15 lines: objections ranked by how much they'd hurt a sale or daily use, as «qué hice → qué pasó → por qué me molesta», each marked [bug] or [percepción]. If you truly find nothing: «No encontré nada que me frene.»
