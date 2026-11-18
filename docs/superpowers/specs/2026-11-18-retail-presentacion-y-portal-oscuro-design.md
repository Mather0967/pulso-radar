# Rivect Retail en modo presentación + portal oscuro con identidad RIVECT

Fecha: 18/11/2026 · Estado: borrador para aprobación del usuario

## Intención

El usuario presenta **Rivect Retail Intelligence en vivo**, en reuniones con dueños de comercios. Hoy la demo es un panel con menú lateral y navegación libre: sirve para explorar, no para contar una historia. Quiere que:

1. **Se vea y se sienta como una presentación guiada**: él avanza escena por escena y cada una cuenta una parte del valor para el comercio.
2. **A la vez parezca software funcionando "en algún lugar"**: datos que llegan, procesos en marcha, hora corriendo. No son diapositivas.
3. El **portal** («Mis proyectos») pase a **modo oscuro con la identidad de RIVECT**, la del logo del portal.

El usuario pasó MUI, Chakra UI, React Bits y Mantine como **referencias de estilo**. Eligió la opción 1: Mantine como base y React Bits para los efectos.

## Metas

- Recorrido en escenas, manejado por el presentador con teclado o control de presentaciones.
- Una "capa en vivo" que hace que el sistema parezca operar: feed de actividad, notificaciones, contadores, chat que escribe.
- Cada escena sigue siendo interactiva: el presentador puede cambiar números en vivo (por ejemplo, el simulador con datos que dice el dueño).
- Identidad RIVECT en Retail y en el portal: Mandarina `#FF762E`, Medianoche `#11222C`, Pizarra `#405C6B`, blanco cálido `#F7F5EF`. Retail hoy usa un azul de marca: se reemplaza.
- Modo oscuro en las dos.

## No metas

- Integraciones reales (WhatsApp, POS, ERP, IA) o backend nuevo. Sigue siendo una demo con datos de ejemplo.
- Cambiar los cálculos de negocio (`src/domain`, `src/services`, `src/store`, `src/data`).
- Rediseñar LANDUR o Pulso, que conservan su identidad propia.

## Anti-metas (falla aunque "funcione")

- Que parezca un PowerPoint: escenas sin interacción ni vida.
- Que la capa en vivo distraiga mientras el presentador habla: nada de pop-ups que tapen el dato central ni sonidos.
- Que se lea como datos reales de un cliente. Hay un indicador discreto «Demo · datos de ejemplo» que sigue la línea del README actual.
- Que se trabe en una notebook de reunión o en un proyector. Objetivo: navegación fluida en una notebook media y un primer render en menos de 3 s en la red del hosting.
- Romper el acceso del portal (sesión, CSP, solo administradores en `/retail/`).

## Restricciones

- Retail vive en `https://rivect.net/retail/` (build `vite.config.portal.ts`, `base: '/retail/'`), solo para administradores, y lo sirve `namecheap/server` desde `projects/rivect-retail/public/` (`scripts/publish-portal.mjs`). El build tiene que seguir funcionando con ese flujo.
- La CSP del portal permite `style-src 'self' 'unsafe-inline'`, así que el CSS en línea de Mantine funciona. Scripts solo `'self'` + nonce: nada de CDNs.
- La CSP tiene `font-src 'self'` y `style-src 'self'`: **Google Fonts hoy ya está bloqueado** en el portal y en Retail, que muestran la fuente del sistema. **Decisión de Claude:** las fuentes (Plus Jakarta Sans y JetBrains Mono) se alojan en el propio proyecto con `@fontsource`. En Retail entran en el bundle. En el portal se copian los `.woff2` a `namecheap/public/fonts/` y se agregan a la lista de archivos estáticos de `namecheap/server/main.mjs` (línea 38), sin tocar la CSP. Se eliminan los enlaces a Google Fonts.
- Las pruebas de cálculos (`npm test`, Vitest) siguen en verde.
- **El login (`account.html`) y Administración (`admin.html`) del portal no están en el repositorio**: el servidor los lee de la carpeta del hosting. En este trabajo solo se rediseña «Mis proyectos» (`namecheap/server/projects.mjs` + `namecheap/public/projects.css`). Para pasar el login y Administración a oscuro, el usuario tiene que traer esos archivos. Queda anotado como pendiente.

## Enfoques considerados

1. **Mantine + React Bits (elegido).** Mantine 7 trae modo oscuro de primera, un aspecto de panel moderno y piezas útiles para la capa en vivo (Notifications, Timeline, RingProgress, Stepper, Spotlight). Costo: reescribir la interfaz de las 7 secciones.
2. Mantener Tailwind y copiar el estilo: lo más liviano, pero mejora menos el aspecto y todo el pulido queda a mano.
3. MUI como base: se ve más corporativo y es más pesado.

Mezclar MUI, Chakra y Mantine se descartó: son tres sistemas de estilos con temas y resets globales que chocan.

**Portal:** son páginas HTML que arma el servidor, sin React. Meter Mantine obligaría a convertirlas en una app React y a tocar el flujo de sesión. **Decisión de Claude:** el portal toma el mismo lenguaje visual (tokens de color, tipografía, radios, sombras y tarjetas con brillo al pasar el mouse) con CSS propio, sin Mantine. Se ve como la misma familia sin riesgo para el acceso.

## Diseño — Retail

### Base técnica
- `@mantine/core`, `@mantine/hooks` y `@mantine/notifications` v7, con un tema RIVECT:
  - escala `mandarin` de 10 tonos (base `#FF762E`) como `primaryColor`;
  - escala oscura derivada de Medianoche `#11222C` y Pizarra;
  - `defaultColorScheme: 'dark'`, forzado en oscuro;
  - tipografía Plus Jakarta Sans y JetBrains Mono para cifras, iguales al portal.
- Se mantienen Recharts (con colores del tema), Framer Motion, Lucide y Zustand.
- React Bits: los componentes locales actuales (Aurora, CountUp, SpotlightCard, ShinyText, GlareHover, AnimatedContent) se recolorean a la marca. Se suman piezas al estilo React Bits cuando una escena lo pida (texto que se revela, números que corren).
- Tailwind se retira al final de la migración para que su reset no choque con el de Mantine.

### Estructura de la pantalla (modo presentación)
```
┌──────────────────────────────────────────────────────────────────────┐
│ ◆ RIVECT  Retail Intelligence   ● En línea  14:32:07   Demo · datos  │
├──────────────────────────────────────────────────────────────┬───────┤
│  Escena 3 de 7 · Asistente de ventas                         │ EN    │
│  «Respondé 24/7 sin sumar personal»                          │ VIVO  │
│                                                              │ 14:32 │
│   [contenido interactivo de la escena: chat que escribe,     │ Pedido│
│    gráficos, tablas, simulador]                              │ #1043 │
│                                                              │ 14:31 │
│                                                              │ Stock │
│                                                              │ bajo… │
├──────────────────────────────────────────────────────────────┴───────┤
│ ◀  ●●●○○○○  ▶    Apertura · Problema · Asistente · …    [N] notas    │
└──────────────────────────────────────────────────────────────────────┘
```
- **Barra superior**: logo RIVECT, estado «En línea» con un pulso, reloj real e indicador «Demo · datos de ejemplo».
- **Panel EN VIVO** (columna derecha, plegable): feed de eventos con hora (pedidos, mensajes respondidos, alertas de stock, clientes recuperados). Los eventos salen de los JSON de `src/data` con un generador determinístico. **Decisión de Claude:** el orden y el contenido de los eventos son fijos (cada reunión cuenta lo mismo) y la hora que muestran es la del reloj real en el momento en que aparecen. Las fechas fijas de los JSON no se muestran en el feed.
- **Barra inferior**: progreso por escenas y nombres clicables.

### Escenas (propuesta de Claude; el orden y los textos se pueden ajustar)
1. **Apertura**: «Un día en tu comercio». Logo, el comercio de ejemplo (`store-profile.json`) y la actividad del día que empieza a correr.
2. **El problema**: el simulador. Horas por semana en tareas repetitivas y plata que se pierde. El presentador puede escribir los números que le dice el dueño.
3. **Asistente de ventas**: el chat responde consultas de clientes escribiendo en tiempo real, con el catálogo al lado.
4. **Recuperación de clientes**: leads que se enfrían y seguimientos automáticos, con contadores de recuperados.
5. **Stock inteligente**: alertas que aparecen y cobertura por producto.
6. **Campañas**: armado y vista previa de una campaña.
7. **Impacto y cierre**: resumen del reporte, con números que corren, y la exportación a PDF que ya existe.

Cada escena reutiliza la lógica de su feature actual (`src/features/*`, `src/services/*`). Cambia la presentación, no los cálculos.

### Controles del presentador
- `→`, `PageDown` o `Espacio`: siguiente. `←` o `PageUp`: anterior. Los controles de presentación mandan esas teclas.
- `1`–`7`: ir a una escena. `F`: pantalla completa. `N`: mostrar u ocultar notas del presentador, ocultas por defecto porque la pantalla suele estar compartida.
- `L`: plegar el panel en vivo. `Esc`: modo exploración, con la navegación libre de hoy y el menú lateral para preguntas fuera del guion.
- La escena actual queda en la URL (`/retail/#/escena/3`) para recargar sin perder el lugar.
- Dentro de cada escena, los pasos internos (por ejemplo, "ahora entra un mensaje") avanzan con la misma tecla antes de pasar a la escena siguiente.

### Capa "funcionando"
- Reloj real y el pulso «En línea».
- Feed en vivo: un evento cada 4–8 s, con hora real.
- Notificaciones de Mantine **solo en momentos marcados de cada escena**, para no tapar el dato central (ver anti-metas).
- Chat con indicador «escribiendo…» y texto que aparece de a poco.
- Contadores que suben cuando corresponde a la escena.
- Pausa automática del feed si la pestaña no está visible.

## Diseño — Portal «Mis proyectos»
- `color-scheme: dark`. Fondo Medianoche con un leve degradado y la grilla de puntos actual en versión clara tenue. Superficies un tono más claro, bordes `rgba(255,255,255,.08)` y acento Mandarina.
- Logo en versión clara (`logo.svg`, letras `#F7F5EF` y símbolo Mandarina) en lugar de `projects-brand.svg`.
- Tarjetas de proyecto con el estilo SpotlightCard (brillo que sigue al mouse, borde Mandarina al pasar). Se respeta `prefers-reduced-motion`.
- El formulario de permisos de administrador, los botones y los mensajes de error se adaptan al oscuro con contraste AA.
- Solo HTML y CSS: no cambia la lógica, la sesión ni la CSP de `namecheap/server/projects.mjs`.

## Verificación esperada
- `npm test` de Retail en verde y pruebas nuevas de la navegación por escenas y del generador de eventos.
- `npm run build:portal` sin errores.
- Recorrido completo en Chromium (Playwright) a 1366×768 y 1920×1080, con capturas de las 7 escenas y de «Mis proyectos».
- Pruebas del portal (`node --test tests/*.test.mjs` en la raíz) en verde.

## Lo que queda a criterio del constructor
- La estructura de archivos de las escenas, los nombres de los componentes y la escala exacta de colores.
- Qué componentes de Mantine usar en cada escena.
- Los textos de cada escena, que el usuario revisa después en la demo.
- Cómo fraccionar la migración, siempre que cada paso compile y deje las pruebas en verde.
