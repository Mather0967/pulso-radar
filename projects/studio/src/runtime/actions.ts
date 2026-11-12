import { scenarioById } from '../content/scenarios';
import { beatAt, INITIAL_SCENE } from '../engine/tour';
import type { Focus, Id, Scene, VisitRecord } from '../engine/types';
import { C, load, unload } from './clock';
import { EMPTY_SIM, get, set } from './store';

const patchScene = (p: Partial<Scene>) => set((s) => ({ scene: { ...s.scene, ...p }, animate: true }));
const patchTour = (p: Partial<ReturnType<typeof get>['tour']>) => set((s) => ({ tour: { ...s.tour, ...p } }));

/* ── session ── */

export function startScenario(id: Id, mode: 'tour' | 'free') {
  const sc = scenarioById(id);
  if (!sc) return;
  load(sc);
  const s = get();
  const visit = s.visit?.scenarioId === id ? s.visit : newVisit(id);
  set({
    scenarioId: id, visit, openNode: null, panel: null, focus: null, sim: EMPTY_SIM, animate: true,
    scene: mode === 'tour' ? C.tour!.beats[0].scene : { ...INITIAL_SCENE, caption: 'Tocá cualquier área para ver cómo funciona por dentro.' },
    tour: { ...s.tour, t: 0, beatIndex: 0, playing: mode === 'tour', control: mode === 'tour' ? 'tour' : 'manual' },
  });
}

export function exitToPicker() {
  unload();
  set({ scenarioId: null, scene: INITIAL_SCENE, sim: EMPTY_SIM, openNode: null, panel: null, focus: null });
}

/* ── director ── */

export function seek(t: number, animate = true) {
  const tour = C.tour;
  if (!tour) return;
  C.t = Math.max(0, Math.min(t, tour.end));
  C.holdReleased = -1;
  const i = beatAt(tour, C.t);
  set((s) => ({ scene: tour.beats[i].scene, animate, focus: null, tour: { ...s.tour, t: C.t, beatIndex: i, control: 'tour' } }));
}

export function play() {
  const s = get();
  if (s.tour.control === 'manual') return resume();
  if (C.tour && C.t >= C.tour.end) seek(0);
  patchTour({ playing: true });
}
export const pause = () => patchTour({ playing: false });
export const togglePlay = () => (get().tour.playing ? pause() : play());

export function resume() {
  const tour = C.tour;
  if (!tour) return;
  const i = get().tour.beatIndex;
  const b = tour.beats[i];
  if (b.hold && C.t >= b.t1 - 5) {
    // resuming from an answered hold moves on; skip the beat that would replay the same sim with a preset answer
    const next = tour.beats[i + 1];
    seek(next && next.scene.sim?.sim === b.scene.sim?.sim && Object.keys(get().scene.sim?.choices ?? {}).length ? next.t1 : b.t1);
  } else seek(C.t);
  patchTour({ playing: true });
}

export function back() {
  const tour = C.tour;
  if (!tour) return;
  const i = beatAt(tour, C.t);
  seek(C.t - tour.beats[i].t0 > 1500 || i === 0 ? tour.beats[i].t0 : tour.beats[i - 1].t0);
}

export function jumpChapter(k: number) {
  const tour = C.tour;
  if (!tour) return;
  const ch = tour.chapters[Math.max(0, Math.min(k, tour.chapters.length - 1))];
  seek(ch.t0);
  patchTour({ playing: true });
}

export function nextChapter() {
  const tour = C.tour;
  if (!tour) return;
  const cur = tour.beats[beatAt(tour, C.t)].chapter;
  jumpChapter(cur + 1);
}
export function prevChapter() {
  const tour = C.tour;
  if (!tour) return;
  const b = tour.beats[beatAt(tour, C.t)];
  const ch = tour.chapters[b.chapter];
  jumpChapter(C.t - ch.t0 > 2500 ? b.chapter : b.chapter - 1);
}

export const setSpeed = (speed: number) => patchTour({ speed });

/** Presenter or client touched the canvas: the director stops writing scenes. */
export function takeover() {
  const s = get();
  if (s.tour.control !== 'tour') return;
  C.simT = s.scene.sim ? C.t - s.scene.sim.t0 : null;
  patchTour({ control: 'manual', playing: false });
}

/* ── manual interaction ── */

export function runSim(sim: Id) {
  takeover();
  C.simT = 0;
  const def = C.sc?.sims[sim];
  patchScene({ sim: { sim, choices: {}, t0: 0 }, view: { kind: 'map' }, surfaces: def?.surfaces ?? [], highlight: null, camera: 'all', caption: def?.label ?? null });
  set({ focus: null, openNode: null });
}

export function choose(optionId: Id) {
  const s = get();
  const aw = s.sim.awaiting;
  if (!aw || !s.scene.sim) return;
  takeover();
  patchScene({ sim: { ...s.scene.sim, choices: { ...s.scene.sim.choices, [aw.id]: optionId } } });
}

export function toggleExpand(id: Id) {
  takeover();
  const { expanded } = get().scene;
  const open = expanded.includes(id);
  patchScene({ expanded: open ? expanded.filter((x) => x !== id) : [...expanded, id], camera: open ? 'all' : { nodes: [id] } });
}

export const openNode = (id: Id | null) => set({ openNode: id });
export const setPanel = (panel: ReturnType<typeof get>['panel']) => set((s) => ({ panel: s.panel === panel ? null : panel }));

export function showFocus(kind: 'diagnosis' | 'services', f: Focus) {
  takeover();
  patchScene({ view: { kind: 'map' }, highlight: f.nodes, camera: { nodes: f.nodes, maxZoom: 1 }, expanded: [], caption: null });
  set({ focus: { id: f.id, kind } });
  if (kind === 'diagnosis') toggleVisitList('problems', f.id, true);
}

export function goToFocus(f: Focus) {
  set({ focus: null, panel: null });
  if (f.chapter) {
    const k = C.tour!.chapters.findIndex((c) => c.id === f.chapter);
    jumpChapter(k);
  } else if (f.comparison) startCompare(f.comparison);
}

export function clearFocus() {
  set({ focus: null });
  patchScene({ highlight: null, camera: 'all' });
}

export function startCompare(id: Id, phase: 'before' | 'shift' | 'after' = 'before') {
  takeover();
  const cmp = C.sc!.comparisons.find((c) => c.id === id);
  if (!cmp) return;
  const sim = phase === 'before' ? cmp.beforeSim : phase === 'after' ? cmp.afterSim : null;
  C.simT = 0;
  patchScene({
    view: { kind: 'compare', id, phase }, expanded: [], camera: 'all', highlight: null, surfaces: [], caption: null,
    sim: sim ? { sim, choices: {}, t0: 0 } : null,
  });
}

export function showMap() {
  takeover();
  patchScene({ ...INITIAL_SCENE });
}

/* ── visit record ── */

function newVisit(scenarioId: Id): VisitRecord {
  const now = new Date().toISOString();
  return { schema: 1, id: crypto.randomUUID(), createdAt: now, updatedAt: now, scenarioId, businessName: '', contact: '', problems: [], modules: [], notes: '' };
}

export function updateVisit(p: Partial<Pick<VisitRecord, 'businessName' | 'contact' | 'notes'>>) {
  set((s) => (s.visit ? { visit: { ...s.visit, ...p, updatedAt: new Date().toISOString() } } : {}));
}

export function toggleVisitList(key: 'problems' | 'modules', id: Id, force?: boolean) {
  set((s) => {
    if (!s.visit) return {};
    const has = s.visit[key].includes(id);
    const on = force ?? !has;
    if (on === has) return {};
    const list = on ? [...s.visit[key], id] : s.visit[key].filter((x) => x !== id);
    return { visit: { ...s.visit, [key]: list, updatedAt: new Date().toISOString() } };
  });
}

export function saveVisit() {
  set((s) => (s.visit ? { visits: [s.visit, ...s.visits.filter((v) => v.id !== s.visit!.id)] } : {}));
}

export function startNewVisit() {
  const id = get().scenarioId;
  if (id) set({ visit: newVisit(id) });
}
