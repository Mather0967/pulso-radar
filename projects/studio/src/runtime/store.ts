import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { INITIAL_SCENE } from '../engine/tour';
import type { Id, NodeStatus, Scene, SimTimeline, VisitRecord } from '../engine/types';

export type Panel = null | 'diagnosis' | 'services' | 'visit';

export interface Store {
  scenarioId: Id | null;
  scene: Scene;
  /** false while scrubbing: layout and camera jump instead of gliding. */
  animate: boolean;
  openNode: Id | null;
  panel: Panel;
  /** Focus (diagnosis chip / service) currently shown, with its blurb. */
  focus: { id: Id; kind: 'diagnosis' | 'services' } | null;
  tour: { t: number; playing: boolean; speed: number; control: 'tour' | 'manual'; beatIndex: number };
  sim: {
    nodes: Record<Id, NodeStatus>;
    active: Id[];
    visited: Id[];
    surfaces: Record<Id, unknown>;
    note: string | null;
    awaiting: SimTimeline['awaiting'];
    done: boolean;
  };
  visit: VisitRecord | null;
  visits: VisitRecord[];
}

export const EMPTY_SIM: Store['sim'] = { nodes: {}, active: [], visited: [], surfaces: {}, note: null, awaiting: null, done: false };

export const useStore = create<Store>()(
  persist(
    (): Store => ({
      scenarioId: null,
      scene: INITIAL_SCENE,
      animate: true,
      openNode: null,
      panel: null,
      focus: null,
      tour: { t: 0, playing: false, speed: 1, control: 'tour', beatIndex: 0 },
      sim: EMPTY_SIM,
      visit: null,
      visits: [],
    }),
    {
      name: 'rivect-studio/visits',
      version: 1,
      partialize: (s) => ({ visit: s.visit, visits: s.visits }),
    },
  ),
);

export const set = useStore.setState;
export const get = useStore.getState;
