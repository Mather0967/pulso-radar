/**
 * RIVECT Studio — core contracts. Types only, no imports, no runtime code.
 * See docs/ARCHITECTURE.md for the reasoning behind each shape.
 *
 * Conventions
 * - All times are milliseconds at 1x speed.
 * - Ids are plain strings. A child of an owner (macro node or comparison) is
 *   WRITTEN with a local id ("classify") and ADDRESSED everywhere else
 *   (simulations, beats, focus links) as `${ownerId}/${localId}` ("wa/classify").
 * - Everything in a Scenario is plain serialisable data.
 */

export type Id = string;

/* ───────────────────────── Credibility ───────────────────────── */

/**
 * The only place where "verified" can be claimed is the integration registry
 * (src/content/integrations.ts). Scenarios reference integrations by id and
 * can never assert a status themselves. Anything without an integration is
 * rendered as "simulated".
 */
export type Integration =
  | { id: Id; name: string; status: 'simulated' }
  | {
      id: Id;
      name: string;
      status: 'verified';
      /** ISO date RIVECT last confirmed it works in a real delivery. */
      verifiedOn: string;
      /** Internal note: which project / how it was verified. Shown in the node detail. */
      evidence: string;
    };

export type Credibility = Integration['status'];

/* ───────────────────────── Graph ───────────────────────── */

/** Position on a coarse grid; pixels are computed by engine/layout.ts. */
export interface GridPos {
  col: number;
  row: number;
}

/** Who performs a step. Drives the node look and the human-in-the-loop badge. */
export type Actor = 'system' | 'ai' | 'human';

export interface Edge {
  /** Local id inside a subflow/comparison; global id for macro edges. */
  id: Id;
  from: Id;
  to: Id;
  label?: string;
}

/** A node inside a subflow (one automation step). Fixed size, never nested further. */
export interface StepNode {
  id: Id;
  label: string;
  /** lucide icon name. */
  icon?: string;
  actor: Actor;
  pos: GridPos;
  integration?: Id;
  /** One or two sentences shown when the node is opened. */
  detail?: string;
}

export interface Subflow {
  nodes: StepNode[];
  edges: Edge[];
}

/** A system/area of the business on the top-level map. Expands into its subflow. */
export interface MacroNode {
  id: Id;
  /** Library entry that produced it, e.g. "whatsapp-inbox". Used for visit records. */
  lib: string;
  label: string;
  icon: string;
  /** One line under the label, owner-language ("Responde consultas al instante"). */
  blurb: string;
  pos: GridPos;
  integration?: Id;
  subflow: Subflow;
  /** Surface opened when the node is clicked. */
  surface?: Id;
}

/** Shape of a shared node-library entry: a plain function returning data. */
export type NodeFactory<P = Record<string, never>> = (id: Id, pos: GridPos, params: P) => MacroNode;

/* ───────────────────────── Surfaces ───────────────────────── */

export type SurfaceKind = 'chat' | 'crm' | 'store' | 'panel' | 'calendar' | 'ad';

/** A fake app shown in the dock. Initial content is just events applied before t=0. */
export interface SurfaceDef {
  kind: SurfaceKind;
  title: string;
  integration?: Id;
  seed?: SurfaceEvent[];
  /** chat: who the business is talking to (header). */
  contact?: string;
  /** panel: column headers. */
  columns?: string[];
  /** crm: stage columns, left to right. */
  stages?: string[];
}

/** Small document card attachable to a chat message (quote, booking confirmation, order). */
export interface DocCard {
  title: string;
  lines: Array<{ label: string; value: string }>;
  total?: string;
}

/**
 * Everything a simulation can do to a surface. `surface` is the key in
 * Scenario.surfaces. Each kind has a pure reducer in src/surfaces/<kind>.
 */
export type SurfaceEvent =
  | { surface: Id; type: 'chat.message'; from: 'customer' | 'business' | 'bot'; text: string; card?: DocCard }
  | { surface: Id; type: 'chat.typing'; from: 'customer' | 'business' | 'bot' }
  | { surface: Id; type: 'crm.card'; id: Id; stage: string; title: string; note?: string }
  | { surface: Id; type: 'crm.move'; id: Id; stage: string; note?: string }
  | { surface: Id; type: 'store.view'; product: string; detail?: string; cta?: string }
  | { surface: Id; type: 'store.order'; id: Id; items: string[]; total: string }
  | { surface: Id; type: 'panel.row'; id: Id; cells: string[]; status?: string }
  | { surface: Id; type: 'panel.status'; id: Id; status: string }
  | { surface: Id; type: 'calendar.book'; id: Id; day: string; time: string; label: string }
  | { surface: Id; type: 'calendar.cancel'; id: Id }
  | { surface: Id; type: 'ad.show'; headline: string; body: string; cta: string }
  | { surface: Id; type: 'ad.click' };

/* ───────────────────────── Simulation ───────────────────────── */

interface StepBase {
  /** Override the default duration for this step type (engine/sim.ts DEFAULT_DUR). */
  dur?: number;
  /** Start together with the previous step instead of after it (fan-out, synced surface event). */
  par?: boolean;
  /** Short status line shown while the step is running ("Buscando precio en el catálogo…"). */
  note?: string;
}

export type SimStep =
  /** Node lights up for `dur`, then settles as done (or failed: a dead end, e.g. forgotten follow-up). */
  | (StepBase & { do: 'activate'; node: Id; outcome?: 'done' | 'failed' })
  /** A token travels along each edge simultaneously. */
  | (StepBase & { do: 'token'; edges: Id[]; label?: string })
  /** Time passes. With `node`, that node shows a waiting state. `note` is the time-skip label ("3 horas después"). */
  | (StepBase & { do: 'wait'; node?: Id })
  | (StepBase & { do: 'surface'; event: SurfaceEvent })
  /** Branch. Unresolved -> the simulation stops here and asks. Never has a duration. */
  | { do: 'choice'; id: Id; prompt: string; options: ChoiceOption[] };

export interface ChoiceOption {
  id: Id;
  label: string;
  steps: SimStep[];
}

export interface Simulation {
  id: Id;
  /** Button label, e.g. "Simular una consulta". */
  label: string;
  steps: SimStep[];
  /** Surfaces start from the final state of this sim (story continuity across chapters). */
  continues?: Id;
  /** Dock surfaces shown when the sim is run by hand (outside the tour). Max 2. */
  surfaces?: Id[];
}

/** A simulation being played: which one, with which branches chosen, since when. */
export interface SimRun {
  sim: Id;
  /** choiceId -> optionId. Missing key = ask the user when reached. */
  choices: Record<Id, Id>;
  /** Tour time at which the run starts (0 for manual runs). */
  t0: number;
}

/* Compiled form — output of compileSim(sim, choices). Pure function of its inputs. */

export type Span =
  | { kind: 'node'; node: Id; t0: number; t1: number; waiting: boolean; outcome: 'done' | 'failed' }
  | { kind: 'token'; edge: Id; t0: number; t1: number; label?: string };

export interface SimTimeline {
  spans: Span[];
  /** Surface events, sorted by t. */
  marks: Array<{ t: number; event: SurfaceEvent }>;
  notes: Array<{ t0: number; t1: number; text: string }>;
  end: number;
  /** Set when compilation stopped at an unresolved choice (at t = end). */
  awaiting: { id: Id; prompt: string; options: Array<{ id: Id; label: string }> } | null;
}

export type NodeStatus = 'idle' | 'active' | 'waiting' | 'done' | 'failed';

/* ───────────────────────── Before / After ───────────────────────── */

/** What happens to a manual step once the process is automated. */
export type Fate = 'removed' | 'automated' | 'human';

export interface IllustrativeEstimate {
  label: string;
  before: string;
  after: string;
  /** Forces the UI tag "Escenario ilustrativo". There is no other kind of estimate. */
  illustrative: true;
}

/**
 * Same case, two lanes in one graph. Both lanes share the column grid:
 * same `pos.col` = same stage of the case, so removed steps leave visible gaps.
 * Lane row is assigned by the layout (before on top, after below); `pos.row` is relative to the lane.
 */
export interface Comparison {
  id: Id;
  title: string;
  /** The case both lanes process, e.g. "Consulta de precio por WhatsApp". */
  caseLabel: string;
  before: { nodes: Array<StepNode & { fate: Fate }>; edges: Edge[] };
  after: Subflow;
  /** Keys in Scenario.sims. Steps address nodes as `${comparison.id}/${localId}`. */
  beforeSim: Id;
  afterSim: Id;
  estimates?: IllustrativeEstimate[];
}

/* ───────────────────────── Scene & tour ───────────────────────── */

export type View =
  | { kind: 'map' }
  /** before: run manual lane · shift: reveal fates · after: run automated lane. */
  | { kind: 'compare'; id: Id; phase: 'before' | 'shift' | 'after' };

/** Camera is a target, not a viewport: the runtime computes x/y/zoom from the laid-out bounds. */
export type CameraTarget = 'all' | { nodes: Id[]; maxZoom?: number };

/**
 * The complete presentational state of the studio. It is ABSOLUTE (never a delta):
 * applying a Scene always yields the same screen. Tour and manual mode both write it.
 */
export interface Scene {
  view: View;
  /** Macro ids currently expanded. */
  expanded: Id[];
  camera: CameraTarget;
  /** Node ids to emphasise; everything else dims. null = nothing dimmed. */
  highlight: Id[] | null;
  /** Surface ids in the dock, max 2. */
  surfaces: Id[];
  caption: string | null;
  sim: SimRun | null;
}

/**
 * A beat = a duration + a patch over the previous beat's scene.
 * Omitted field = inherit. Explicit value (including null / []) = replace.
 */
export interface Beat {
  /** 'sim' = length of the simulation started in this beat plus a short tail. */
  dur: number | 'sim';
  /** Auto-pause at the end of the beat until the presenter continues. */
  hold?: boolean;
  view?: View;
  expanded?: Id[];
  camera?: CameraTarget;
  highlight?: Id[] | null;
  surfaces?: Id[];
  caption?: string | null;
  /** Start a simulation at this beat's start (t0 is filled in by compileTour). null = clear. */
  sim?: { sim: Id; choices?: Record<Id, Id> } | null;
}

export interface Chapter {
  id: Id;
  title: string;
  beats: Beat[];
}

export interface Tour {
  chapters: Chapter[];
}

/* Compiled form — output of compileTour(scenario). */

export interface CompiledBeat {
  t0: number;
  t1: number;
  /** Index into CompiledTour.chapters. */
  chapter: number;
  hold: boolean;
  /** Fully resolved scene for this beat (fold of all patches up to and including it). */
  scene: Scene;
}

export interface CompiledTour {
  beats: CompiledBeat[];
  chapters: Array<{ id: Id; title: string; t0: number }>;
  end: number;
}

/* ───────────────────────── Diagnosis / services ───────────────────────── */

/**
 * A one-tap entry point: highlights part of the map and offers a jump.
 * Used for both diagnosis chips (problems) and the services rail.
 */
export interface Focus {
  id: Id;
  label: string;
  /** One sentence shown next to the highlighted area. */
  blurb?: string;
  /** Macro node ids to highlight and frame. */
  nodes: Id[];
  /** Tour chapter to jump to ("Ver cómo se resuelve"). */
  chapter?: Id;
  /** Or open a before/after. */
  comparison?: Id;
}

/* ───────────────────────── Scenario ───────────────────────── */

/** One business type. Adding a business = adding one file that exports one of these. */
export interface Scenario {
  id: Id;
  business: { label: string; icon: string; tagline: string };
  nodes: MacroNode[];
  /** Edges between macro nodes. */
  edges: Edge[];
  surfaces: Record<Id, SurfaceDef>;
  sims: Record<Id, Simulation>;
  /** Sims offered as buttons in manual mode; first one is "Simular una consulta". */
  quickSims: Id[];
  comparisons: Comparison[];
  diagnosis: Focus[];
  services: Focus[];
  tour: Tour;
}

/* ───────────────────────── Visit ───────────────────────── */

/** Saved locally (localStorage) and exported as JSON / printable summary. */
export interface VisitRecord {
  /** Bump when the shape changes; export files carry it. */
  schema: 1;
  id: Id;
  /** ISO timestamps. */
  createdAt: string;
  updatedAt: string;
  scenarioId: Id;
  businessName: string;
  contact: string;
  /** Focus ids from Scenario.diagnosis. */
  problems: Id[];
  /** MacroNode.lib keys the owner showed interest in. */
  modules: Id[];
  notes: string;
}
