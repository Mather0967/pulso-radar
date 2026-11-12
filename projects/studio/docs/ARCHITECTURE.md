# RIVECT Studio — Architecture

Contracts live in `src/engine/types.ts`. This document explains the decisions behind them and
how the pieces run. Where the two disagree, `types.ts` wins.

## 0. The three ideas everything hangs on

1. **Time is the only input.** A simulation compiles to a flat timeline of spans; a tour compiles
   to a flat list of beats with absolute scenes. What is on screen is a pure function of
   `(scenario, t)`. Pause, seek, back, chapter jump and speed all fall out of that for free.
2. **A `Scene` is absolute, never a delta.** Tour beats and manual interaction write the same
   `Scene` object. Applying a scene twice gives the same screen. Manual takeover and resume are
   just "stop writing scenes" / "write the scene for the current time again".
3. **Layout is a synchronous pure function with fixed node sizes.** No measuring, no async
   layout, no waiting for React Flow before moving the camera.

## 1. Stack

| Choice | Decision | Why |
|---|---|---|
| Vite + React 19 + TypeScript (strict) | keep | No backend, static bundle, fast. |
| `@xyflow/react` v12 | keep | Pan/zoom, sub-flows (`parentId`), custom nodes/edges. |
| `zustand` | keep | Selectors per node id; `subscribe` for non-React consumers; `persist` for visits. |
| `motion` | keep, narrow use | Enter/exit of nodes, surface items, captions. Never for tokens or camera. |
| Tailwind v4 | keep | Tokens as CSS variables in `@theme`. |
| `elkjs` | **dropped** | Async (breaks synchronous seek), ~1.4 MB, and its output is not art-directable. Graphs here are 5–8 macro nodes and 4–8 step subflows authored on a `col/row` grid. Revisit only if a subflow passes ~12 nodes or graphs become generated. |
| XState | **not used** | Two hand-rolled pure compilers plus one rAF loop are smaller than the statechart. |
| `vite-plugin-pwa` | added | Precache so the hosted URL opens with no internet after one visit. |
| `@fontsource-variable/*`, `lucide-react` | added | Fonts and icons bundled; zero runtime CDN. |
| `vitest` | added | The purity tests in §11 are the safety net of the whole design. |

## 2. Folder structure

```
src/
  engine/              pure TypeScript. No React, no store, no DOM.
    types.ts           contracts
    layout.ts          buildGraph(scenario, scene) -> { nodes, edges, rects }
    sim.ts             compileSim(sim, choices) -> SimTimeline ; simStateAt(timeline, t)
    tour.ts            compileTour(scenario) -> CompiledTour ; beatAt(tour, t)
    validate.ts        validateScenario(scenario) -> string[]   (dev boot + test)
    dsl.ts             tiny authoring helpers: hop(edge, node), say(...)   (optional sugar)
  runtime/             glue between engine, store and DOM
    store.ts           zustand store (slices in §9)
    clock.ts           the single requestAnimationFrame loop: director tick + sim tick + token writer
    actions.ts         seek, play, pause, takeover, resume, runSim, choose, focus
    camera.ts          viewportFor(rect, pane, inset) + apply via setViewport
    edgeRegistry.ts    Map<edgeId, { path, dot }> for imperative token drawing
  canvas/              Canvas.tsx, MacroNode.tsx, StepNode.tsx, SimEdge.tsx, LaneLabel.tsx
  surfaces/            registry.ts, Dock.tsx, chat/ crm/ store/ panel/ calendar/ ad/
  content/
    integrations.ts    the ONLY place "verified" may be written
    library/           whatsappInbox.ts, catalog.ts, crm.ts, website.ts, ads.ts, assistant.ts, calendar.ts, quotes.ts
    scenarios/         ferreteria.ts, dental.ts, restaurante.ts, index.ts
  ui/                  BusinessPicker, TourBar, CaptionBar, DiagnosisChips, ServicesRail,
                       SimControls, NodeDetail, VisitPanel, VisitPrint, CredibilityBadge
  styles/tokens.css
```

Import rule: `engine` imports nothing from the app. `content` imports only `engine/types` and
`engine/dsl`. `canvas`, `surfaces`, `ui` read the store and call `runtime/actions`; they never
call each other's internals.

## 3. Data flow

```
 content/scenarios/*.ts ──► validateScenario (dev/test)
          │
          ├─ compileTour ─► CompiledTour { beats[{t0,t1,scene}] , chapters, end }
          └─ compileSim(sim, choices) ─► SimTimeline { spans, marks, notes, end, awaiting }
                                               ▲
   ┌───────────── runtime/clock.ts (one rAF) ──┴──────────────────────────────┐
   │ tour.t += dt*speed ─► beatAt(t) ─► store.scene = beat.scene  (tour mode) │
   │ simT = tour.t - scene.sim.t0   (tour)   |   simT += dt*speed  (manual)   │
   │ simStateAt(timeline, simT) ─► diff ─► store.sim.{nodes,surfaces,note}    │
   │                              └─► token dots: direct DOM writes (no React)│
   └──────────────────────────────────────────────────────────────────────────┘
          │ store.scene                                 │ store.sim
          ▼                                             ▼
   buildGraph(scenario, scene)                 MacroNode / StepNode (status by id)
     ├─► Canvas: tween positions ─► React Flow        Dock ─► surfaces (reduced state)
     └─► camera.ts: rects ─► setViewport              CaptionBar, TourBar

 UI input (pan, click, chip, "Simular") ─► runtime/actions ─► takeover() + writes store.scene
```

## 4. Hierarchical graph

**Decision: React Flow sub-flows, built by a pure function, one renderer.**

- A `MacroNode` is one RF node. Collapsed it is a 240×96 card. Expanded, *the same node id*
  grows into a container and its `StepNode`s are added as RF nodes with `parentId` and positions
  relative to it. Collapsed children are **absent** from the array (not `hidden`).
- Ids: children are written with local ids and addressed as `${macroId}/${localId}`. Sub-edges
  likewise. `buildGraph` does the prefixing; nothing else does.
- Macro edges always attach to the macro container, expanded or not. No boundary-crossing edges
  between a container and its children in v1 (add `entry`/`exit` ports to `Subflow` if the gap
  ever reads as a break).
- All sizes are constants in `layout.ts` (`MACRO 240×96`, `STEP 184×64`, gaps, container padding,
  header). Labels truncate/wrap inside the fixed box. This removes measured-dimension bugs.
- The first screen is `expanded: []`: 5–7 cards and their edges, nothing else.

### Layout (`buildGraph`) — grid tracks, like CSS grid

```
buildGraph(scenario, scene):
  if scene.view.kind == 'compare': return buildCompare(...)          // §8
  for m in scenario.nodes:
     size[m] = m.id in scene.expanded
                 ? { w: PAD*2 + cols(m)*STEP_W + (cols-1)*GAP, h: HEADER + PAD + rows(m)*STEP_H + ... }
                 : MACRO
  colW[c] = max(size[m].w for m in column c)      rowH[r] = max(size[m].h for m in row r)
  x[c] = Σ(colW[<c] + GAP_X)                       y[r] = Σ(rowH[<r] + GAP_Y)
  macro m at (x[m.col], y[m.row] + (rowH - size.h)/2)       // top-left, vertically centred in its row
  child s of expanded m at (PAD + s.col*(STEP_W+GAP), HEADER + s.row*(STEP_H+GAP))   // relative
  handles: pick source/target side from grid direction (dx>0: right→left, dx==0: bottom→top, dx<0: left→right)
  nodes  = [all macros..., all children...]        // parents strictly before children
  edges  = macro edges + sub-edges of expanded macros (zIndex above containers)
  rects  = absolute rect per node id               // used by the camera, not by React Flow
```

Expanding a node widens its column and heightens its row; neighbours are pushed, never
overlapped. Deterministic and synchronous, so the camera can target the *final* layout
immediately.

### Animating layout changes

`Canvas` owns RF nodes with `useNodesState`. When `buildGraph` output changes:

- nodes present before and after: tween `position`, `width`, `height` in a small rAF loop
  (300 ms / speed, ease-out), calling `setNodes` each frame. Edges follow because they are
  recomputed from positions. A CSS `transition` on the node transform is **not** used: edges
  would not follow it.
- entering children: mounted at their final relative position; fade/scale in on an inner div.
- leaving children: removed first, then the container shrinks.
- `opts.animate === false` (seek): set final values directly.

This tween and the camera glide are *presentational*: they run on wall-clock time and are not
part of the timeline state. Beats only need to be long enough for them (≥ 600 ms at 1x).

## 5. Simulation engine

**Decision: declared as a list of steps (data), compiled once into spans, sampled per frame.**

### Declaration

Steps run in sequence; `par: true` starts a step together with the previous one. Step kinds:
`activate` (node runs, ends `done` or `failed`), `token` (travels along one or more edges),
`wait` (time passes, optionally showing a node as waiting; `note` is the time-skip label),
`surface` (emits a `SurfaceEvent`), `choice` (branches; nested `steps` per option).
Human-in-the-loop is not a step kind: it is `StepNode.actor === 'human'`, rendered with a person
badge, in both manual and automated flows. Default durations live in `sim.ts`
(`activate 900, token 700, wait 1400, surface 500`).

### Compile

```
compileSim(sim, choices):
  out = { spans: [], marks: [], notes: [], end: 0, awaiting: null }
  walk(steps, t):                        # returns end time, or null if it stopped at an open choice
    prevT0 = t
    for s in steps:
      if s.do == 'choice':
        opt = s.options.find(o => o.id == choices[s.id])
        if !opt: out.awaiting = { id, prompt, options }; out.end = t; return null
        t = walk(opt.steps, t); if t == null: return null
        prevT0 = t; continue
      t0 = s.par ? prevT0 : t
      t1 = t0 + (s.dur ?? DEFAULT_DUR[s.do])
      activate: spans.push(node span, waiting:false, outcome: s.outcome ?? 'done')
      wait:     if s.node: spans.push(node span, waiting:true, outcome:'done')
      token:    for e in s.edges: spans.push(token span)
      surface:  marks.push({ t: t0, event })
      if s.note: notes.push({ t0, t1, text })
      prevT0 = t0; t = max(t, t1)
    return t
  end = walk(sim.steps, 0); if end != null: out.end = end
  return out
```

Choosing an option = recompile with the new `choices` map. The timeline before the choice point
is identical by construction, so the run continues from the same `t` with no jump.

### Sample

```
simStateAt(tl, t):                       # pure; t clamped to [0, tl.end]
  nodes = {}                             # later spans override earlier ones
  for span of kind 'node' with t >= span.t0:
     nodes[span.node] = t >= span.t1 ? span.outcome : (span.waiting ? 'waiting' : 'active')
  tokens  = token spans with t0 <= t < t1  -> { edge, p: (t - t0) / (t1 - t0), label }
  visited = token spans with t >= t1       -> edge ids (styled as "data passed here")
  nMarks  = count of marks with mark.t <= t
  note    = last note with t0 <= t < t1
  awaiting = tl.awaiting && t >= tl.end ? tl.awaiting : null
```

Surface state is `seed events + marks[0..nMarks]` folded through the surface reducer. The fold
is recomputed only when `nMarks` (or the run) changes, so seeking backwards needs no special
case. Spans per sim are < 200; a linear scan per frame is fine.

### Runner (inside the clock tick)

```
tickSim(simT):
  s = simStateAt(timeline, simT)
  if !shallowEqual(s.nodes, store.sim.nodes): store.sim.nodes = s.nodes       # discrete -> React
  if s.nMarks != last.nMarks: store.sim.surfaces = foldSurfaces(...)          # discrete -> React
  note / awaiting / visited: same diff-then-set
  for each edge in edgeRegistry: dot.style.display = 'none' unless in s.tokens # continuous -> DOM
  for tok in s.tokens:
     { path, dot, len } = edgeRegistry.get(tok.edge)
     pt = path.getPointAtLength(ease(tok.p) * len)
     dot.setAttribute('transform', `translate(${pt.x},${pt.y})`)
```

### Token rendering

`SimEdge` (custom edge) renders: the base path, and a hidden `<g>` "dot" (circle + optional
label pill). In `useLayoutEffect` it registers `{ path, dot, len: path.getTotalLength() }` in
`edgeRegistry` and re-registers when the path `d` changes. The clock moves dots by writing
attributes directly. **No React render happens per frame anywhere in the app.**
Edge states (`idle`, `active` while a token is on it, `visited`) are CSS classes driven by the
discrete store state.

`ponytail:` one token per edge at a time. If a story needs a burst on one edge, add a small dot
pool per edge; the span model already allows overlapping spans.

## 6. Tour director ("JARVIS")

**Decision: one master clock; beats are patches compiled into absolute scenes; nothing is awaited.**

### Declaration and compile

`Tour = chapters[] -> beats[]`. A beat is `dur` + a patch over the previous scene (omitted
field = inherit; explicit value incl. `null`/`[]` = replace). Typical chapter:

```
{ dur: 2500, camera: { nodes: ['wa'] }, caption: 'Todo empieza con un mensaje…', highlight: ['wa'] },
{ dur: 1200, expanded: ['wa'], camera: { nodes: ['wa'] }, surfaces: ['chat'] },
{ dur: 'sim', sim: { sim: 'consulta', choices: { respuesta: 'responde' } }, caption: '…' },
{ dur: 3000, expanded: [], camera: { nodes: ['wa', 'crm'] }, surfaces: ['crm'], caption: '…' },
```

```
compileTour(scenario):
  scene = INITIAL_SCENE; t = 0
  for chapter, for beat:
     scene = { ...scene, ...definedFieldsOf(beat) }             # the fold
     if beat.sim: scene.sim = { ...beat.sim, choices: beat.sim.choices ?? {}, t0: t }
     dur = beat.dur == 'sim' ? compileSim(sims[scene.sim.sim], scene.sim.choices).end + TAIL : beat.dur
     beats.push({ t0: t, t1: t + dur, chapter, hold: !!beat.hold, scene })
     t += dur
```

A simulation started in one beat keeps running across the following beats (its `t0` is
absolute) until a beat sets `sim` to something else or `null`; after it ends it stays in its
final state. That is how the camera can move while a simulation is running.

### Tick

```
tick(now):                                    # the only rAF loop
  dt = min(now - last, 100) * speed ; last = now       # clamp: tab switch must not jump the tour
  if control == 'tour' and playing:
     t += dt
     i = beatAt(t)
     if i != beatIndex:
        if beats[beatIndex].hold and i > beatIndex and holdReleased != beatIndex:
           t = beats[beatIndex].t1 - 1 ; playing = false ; holdReleased = beatIndex ; return
        beatIndex = i ; store.scene = beats[i].scene            # same object identity => no-op renders
     if t >= tour.end: t = tour.end ; playing = false
     simT = scene.sim ? t - scene.sim.t0 : null
  if control == 'manual' and scene.sim and !sim.awaiting:
     simT += dt
  if simT != null: tickSim(min(simT, timeline.end))
```

The compiled `SimTimeline` is cached by `(simId, JSON choices)`.

### Seek and everything built on it

```
seek(t, { animate }):
  t = clamp(t, 0, tour.end) ; beatIndex = beatAt(t) ; holdReleased = -1
  control = 'tour' ; store.scene = beats[beatIndex].scene ; applyOpts = { animate }
  # sim state needs nothing: next tick samples simStateAt(t - scene.sim.t0)
```

- **pause / resume**: flip `playing`.
- **back**: `seek(t - beat.t0 > 1000 ? beat.t0 : beats[i-1].t0, { animate: true })`.
- **chapter jump**: `seek(chapters[k].t0, { animate: true })`.
- **scrub** (progress bar): `seek(t, { animate: false })`.
- **speed** 0.5–2: multiplies `dt`. Layout tween and camera durations are divided by it.
- **hold** beats auto-pause at their end; pressing play continues.

No snapshots, no undo of side effects: there are no side effects, only `scene` and `t`.

### Manual takeover

```
takeover():   if control == 'tour': control = 'manual' ; playing = false
              simT = scene.sim ? t - scene.sim.t0 : null       # the running sim keeps going, freely
resume():     seek(t, { animate: true }) ; playing = true      # glides back, re-expands, re-syncs
```

`takeover()` is called by: `onMoveStart` with a non-null event (user pan/zoom), node click,
expand toggle, diagnosis chip, service pick, "Simular", choosing a branch. In manual mode those
actions mutate `store.scene` directly (toggle an id in `expanded`, set `highlight`, set `sim`
with `t0: 0`). The TourBar shows "Retomar recorrido" whenever `control === 'manual'`.

Interactive moment inside the tour: a `hold` beat whose sim has an unresolved choice. The tour
pauses on the question; the owner taps an option → `choose()` → takeover → that branch runs;
"Retomar" continues with the next beat. An unresolved choice on a non-hold beat is a
validation error.

### Camera

`scene.camera` is a target (`'all'` or node ids), not a viewport. `Canvas` runs, on change of
`scene.camera` identity, dock state, or pane size:

```
rect = union(graph.rects[id] for id in target)          # from buildGraph's FINAL layout
vp   = viewportFor(rect, paneSize, inset = { right: dockOpen ? DOCK_W : 0, bottom: CAPTION_H, top: BAR_H, pad: 48 }, maxZoom)
reactFlow.setViewport(vp, { duration: animate ? 700 / speed : 0 })
```

`viewportFor` is six lines of arithmetic (fit rect into the unobstructed area, centre it).
`fitView` is not used: it depends on measured nodes and cannot account for the dock. User pans
never fight the camera because the effect fires only when the target changes.

## 7. Surfaces

**Decision: a registry of `{ kind, reduce, Component }`; state is a fold over events.**

```ts
// surfaces/registry.ts
interface SurfaceModule<S> {
  initial: S;
  reduce(state: S, event: SurfaceEvent): S;       // pure; ignores events of other kinds
  Component: React.FC<{ def: SurfaceDef; state: S }>;
}
export const surfaces: Record<SurfaceKind, SurfaceModule<any>> = { chat, crm, store, panel, calendar, ad };
```

- A scenario declares instances in `Scenario.surfaces` (`{ kind, title, integration?, seed? }`);
  events address an instance by its key. Initial content is `seed` events — no second format.
- Kinds in v1: `chat` (WhatsApp-like, supports a `DocCard` for quotes/bookings), `crm` (stage
  board), `store` (product page + orders), `panel` (admin table), `calendar` (agenda), `ad`.
  A quote is a chat `card` plus a `panel.row`, not its own surface.
- **Dock**: overlays the right edge of the canvas (width 420 px; 380 px below 1440 px wide).
  Shows `scene.surfaces` (max 2) stacked. The canvas keeps its size; the camera compensates
  through its inset. An empty list slides the dock out.
- New items animate in with `motion` (`initial` only for items added after mount, so a seek
  does not replay thirty entrances).
- Each surface header shows the credibility badge and the fixed text "Datos de ejemplo".

## 8. Before / After

**Decision: a `Comparison` is one more graph with two lanes and two ordinary simulations,
rendered by the same canvas and engine through `scene.view`.**

- `buildCompare` lays out `before` nodes in the top lane and `after` nodes in the bottom lane
  on a shared column grid. Authors align stages by `col`, so a removed step leaves a visible
  empty column underneath. Lane titles ("Hoy" / "Con RIVECT") are non-interactive RF nodes.
- Every `before` node carries a `fate`: `removed`, `automated`, or `human`.
- Three phases, each just a scene (usually three beats):
  1. `before` — after lane hidden. `beforeSim` runs: human nodes, `wait` steps with time-skip
     notes ("3 horas después"), ending in an `activate` with `outcome: 'failed'` (the
     forgotten follow-up).
  2. `shift` — no sim. Fates render: `removed` strikes through and fades to 30 %, `automated`
     gets the orange outline and a bolt, `human` keeps a person badge ("Sigue decidiendo una
     persona"). The after lane fades in beneath.
  3. `after` — before lane stays dimmed with its fate marks. `afterSim` runs below.
- `estimates` are optional and typed `illustrative: true`; the component always prints
  "Escenario ilustrativo" next to them. There is no API for an un-labelled number.
- Reachable from the tour (beats with `view`), from a `Focus.comparison`, and from NodeDetail.

## 9. Store (zustand)

One store, four slices. Engine functions are called from `runtime/`, never from components.

```ts
interface Store {
  // session
  scenarioId: Id | null;                    // null = BusinessPicker
  // scene — what is rendered. Written by the director (tour) or by actions (manual).
  scene: Scene;
  applyAnimated: boolean;                   // false for scrubbing; read by Canvas effects
  openNode: Id | null;                      // NodeDetail popover
  // tour
  tour: { t: number; playing: boolean; speed: number; control: 'tour' | 'manual'; beatIndex: number };
  // sim — discrete, derived each tick, set only on change
  sim: {
    nodes: Record<Id, NodeStatus>;
    visited: Id[];                          // edge ids
    surfaces: Record<Id, unknown>;          // reduced state per surface instance
    note: string | null;
    awaiting: SimTimeline['awaiting'];
  };
  // visit — the only persisted slice
  visit: VisitRecord | null;                // draft for the current visit
  visits: VisitRecord[];                    // saved
}
```

- Continuous values (`simT`, token progress, `last` timestamp) are module variables in
  `clock.ts`, not store state. `tour.t` is written to the store at most ~10×/s (progress bar).
- Node components select by id: `useStore(s => s.sim.nodes[id] ?? 'idle')`. Node `data` only
  carries the static definition, so RF node objects are stable while a simulation runs.
- **Persistence**: `persist` middleware, `partialize: ({ visit, visits })`, key
  `rivect-studio/visits`, `version: 1`. Export JSON = `Blob` + `<a download>`. Printable
  summary = a `VisitPrint` component + `@media print` stylesheet + `window.print()`.
  Problems come from tapped diagnosis chips, modules from a "Me interesa" toggle in NodeDetail.

## 10. Credibility model

- `content/integrations.ts` is the single registry. An entry is `simulated` or `verified`; the
  type requires `verifiedOn` and `evidence` for `verified`. Code review of that one file is the
  gate.
- Nodes and surfaces reference an integration by id. No reference, or a `simulated` entry →
  badge "Simulación" (hollow dot). `verified` → "Integración verificada" (solid check) with the
  date in NodeDetail. Scenario files cannot type the word "verified".
- Independently of badges, the footer always states: "Demostración con datos de ejemplo".
  A verified integration still runs sample data here; the badge is about what RIVECT has
  actually connected, not about this screen being live.
- The visit export copies each chosen module's credibility so the later proposal cannot
  upgrade a claim by accident.
- Copy rule for content authors: captions say "puede" / "así funcionaría", never "ya está
  conectado a tu sistema".

## 11. Checks that must exist

1. `validateScenario` over every scenario (vitest + thrown in dev on load): every node/edge/
   surface/sim/chapter/comparison id referenced by steps, beats and focus links resolves;
   token edges connect expanded-addressable nodes; `scene.surfaces.length <= 2`; no unresolved
   choice on a non-hold beat; grid positions do not collide.
2. Purity: for each sim and a handful of `t`, `simStateAt(tl, t)` equals the result of
   stepping 0→t in 16 ms increments. For each tour, `beats[i].scene` deep-equals a re-fold.
3. `buildGraph`: parents precede children; no rect overlaps for every single-expanded state.

## 12. Performance notes (target: 60 fps on a mid laptop, 30–60 nodes)

- One rAF loop. Per frame: one linear scan of spans, a few `getPointAtLength` calls, attribute
  writes. React renders only on discrete changes (a node changes status, an event lands).
- `nodeTypes` / `edgeTypes` at module scope; node and edge components wrapped in `memo`.
- Active-node glow = opacity animation on a pseudo-element, not animated `box-shadow`/`filter`.
- No `backdrop-filter` on anything that overlaps the canvas (dock, caption bar).
- `onlyRenderVisibleElements` stays off: at this size it costs more than it saves and it would
  unmount edge paths the registry needs.
- The layout tween calls `setNodes` for ≤ 40 nodes for 300 ms; acceptable. Do not tween during
  seek.
- Stop the rAF loop when nothing is playing and no manual sim is running.

## 13. React Flow v12 pitfalls

- **Controlled nodes must apply `onNodesChange`** (use `useNodesState`). Otherwise dimension
  changes are dropped and nodes stay `visibility: hidden`. When syncing from `buildGraph`,
  merge into existing nodes so `measured` is preserved.
- **`parentId`** (not `parentNode`); child `position` is relative; **parents must come before
  children** in the array or children render at absolute coordinates / throw.
- **`width`/`height` vs `measured`**: we set `width`/`height` explicitly on every node. Never
  read `node.measured` for layout or camera; use `graph.rects`.
- **Handles**: when a macro node changes size or the chosen handle side changes, call
  `useUpdateNodeInternals()(id)` or edges attach to stale coordinates.
- **`nodeTypes`/`edgeTypes` identity**: define outside components; a new object each render
  remounts every node and logs warning 002.
- **`fitView` right after `setNodes`** uses the previous nodes, and `fitView` on unmeasured
  children is a no-op. That is why the camera uses `setViewport` with computed bounds.
- **`setViewport(vp, { duration })`** is a d3 transition on wall-clock time: it cannot be
  paused or scrubbed and is cancelled by user interaction. Treat as presentational. Check the
  installed 12.x for `ease`/`interpolate` options before hand-rolling an easing.
- **`onMoveStart(event, viewport)`**: `event` is `null` for programmatic moves. Takeover only
  when it is non-null, or the camera will take over from itself.
- **Do not animate `transform` on the RF node wrapper** (`.react-flow__node`); RF owns it.
  Animate an inner element.
- **Edge z-order**: edges between children can render under the parent container; set
  `zIndex` on sub-edges explicitly.
- Flags: `nodesDraggable={false} nodesConnectable={false} zoomOnDoubleClick={false}
  minZoom={0.3} maxZoom={1.6} deleteKeyCode={null}`. The wrapper needs an explicit height.
- Import `@xyflow/react/dist/style.css` before Tailwind layers; override via CSS variables.
- React StrictMode double-invokes effects: clock start/stop and edge registration must be
  idempotent.
- Keep the React Flow attribution unless RIVECT holds a Pro subscription.

## 14. Extension guide

### Add a business (one file)

`src/content/scenarios/estudio-contable.ts`, then one line in `scenarios/index.ts`.

```ts
import { whatsappInbox, crm, calendar, website } from '../library';
import type { Scenario } from '../../engine/types';

const wa = whatsappInbox('wa', { col: 0, row: 0 }, { label: 'WhatsApp del estudio' });
const agenda = calendar('agenda', { col: 1, row: 0 }, { label: 'Turnos y vencimientos' });

export const estudioContable: Scenario = {
  id: 'estudio-contable',
  business: { label: 'Estudio contable', icon: 'calculator', tagline: '…' },
  nodes: [wa, agenda /* … */],
  edges: [{ id: 'wa>agenda', from: 'wa', to: 'agenda' }],
  surfaces: { chat: { kind: 'chat', title: 'WhatsApp', integration: 'whatsapp-cloud-api' } /* … */ },
  sims: { consulta: { id: 'consulta', label: 'Simular una consulta', steps: [/* … */] } },
  quickSims: ['consulta'],
  comparisons: [/* … */],
  diagnosis: [{ id: 'sin-respuesta', label: 'Consultas sin responder', nodes: ['wa'], chapter: 'whatsapp' }],
  services: [/* … */],
  tour: { chapters: [/* … */] },
};
```

Run the tests: `validateScenario` reports every dangling id. No engine or component changes.

### Add a library node

One file in `content/library/` exporting a `NodeFactory` (returns a `MacroNode` with its
subflow, texts taken from params). It may also export step helpers that take the macro id and
return `SimStep[]` (e.g. `whatsappInbox.inquirySteps('wa', { text })`) so common sequences are
written once.

### Add a surface kind

Add the kind to `SurfaceKind`, its events to `SurfaceEvent`, a folder in `surfaces/` with
`reduce` + `Component`, and one entry in the registry. The compiler forces the registry entry.

### Mark an integration as verified

Edit `content/integrations.ts` only; `verifiedOn` and `evidence` are mandatory.

## 15. Build order for the implementer

1. `engine/` (layout, sim, tour, validate) with the tests in §11 — no UI.
2. Canvas with static map + expand/collapse + camera targets.
3. Clock + sim runner + `SimEdge` tokens + one scenario's quick sim.
4. Surfaces dock with `chat` and `crm`.
5. Director + TourBar (play/pause/seek/back/chapters/speed/takeover/resume).
6. Before/After view. 7. Diagnosis, services, NodeDetail, credibility badges.
8. Visit save/export/print. 9. Remaining surfaces and scenarios. 10. PWA + offline pass.

## 16. Deliberately left out of v1

Voice narration (captions are already time-coded: add an audio track keyed by beat later),
branching tours (tours are linear; branching lives in sims), nested subflows deeper than one
level, user-editable graphs, auto-layout, multi-token bursts per edge, i18n (copy is Spanish
in content files).

## 17. Implementation notes (deviations from the plan above)

Recorded after the first full build; the code is the source of truth.

- **Offline**: instead of `vite-plugin-pwa`, `npm run build:offline` uses `vite-plugin-singlefile` to emit one
  self-contained `dist-offline/index.html` that opens from disk (`file://`). Simpler for a sales laptop: no
  hosting, no first visit, no service worker.
- **`Simulation.continues`**: a sim can continue another one. Node states, visited edges and surface events of
  the predecessor chain are the base of the next sim (`clock.ts chainBase`). This lets one story span several
  chapters (pedido → stock → presupuesto → seguimiento) while each chapter's camera follows its own part.
  A combined sim (concatenated steps) is used for the manual "Simular una consulta" button.
- **`Simulation.surfaces`**: dock surfaces shown when a sim is run by hand outside the tour.
- **`dur: 'sim'`** means "until the sim that is currently running ends + tail", even if it started beats ago.
  A test enforces that every new caption stays on screen ≥ 2.8 s.
- **`PACE` (engine/sim.ts)**: one global tempo multiplier for sim steps and fixed beat durations. Content is
  authored brisk; `PACE = 1.3` gives ~4 min tours. The presenter also has 0.75× / 1× / 1.5×.
- **Answered hold**: resuming after the client picked a branch skips the following beat when it would replay
  the same sim with a preset answer.
- **Macro status when collapsed** aggregates its children's statuses, so a collapsed node still lights up
  while its internal automation runs.
- **Compare view**: the summary is a slim strip under the top bar; the camera reserves vertical space for it.
- **Dev handle**: in dev, `window.__studio = { actions, C, store }` for scripted checks (e.g. `__studio.actions.seek(60000)`).
