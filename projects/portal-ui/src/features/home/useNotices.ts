import { useSyncExternalStore } from 'react';
import { api } from '@/lib/api';
import type { Notices } from '@/lib/types';

// Un solo almacén compartido por la campana (Layout) y la tarjeta de avisos (Inicio).
// Se actualiza cada 5 min y al volver a la pestaña o a la ventana; pausa con la pestaña oculta.
const REFRESH_MS = 5 * 60 * 1000;
const MIN_GAP_MS = 5000;

interface NoticesState {
  data: Notices | null;
  error: boolean;
  loading: boolean;
}

let state: NoticesState = { data: null, error: false, loading: false };
let lastLoad = 0;
let inFlight: Promise<void> | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function patch(next: Partial<NoticesState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function load(): Promise<void> {
  if (inFlight) return inFlight;
  lastLoad = Date.now();
  patch({ loading: true });
  inFlight = api<Notices>('/api/notices')
    .then((data) => patch({ data, error: false }))
    .catch(() => patch({ error: true }))
    .finally(() => {
      inFlight = null;
      patch({ loading: false });
    });
  return inFlight;
}

function refreshIfVisible() {
  if (document.visibilityState === 'visible' && Date.now() - lastLoad > MIN_GAP_MS) void load();
}

function start() {
  timer = setInterval(() => {
    if (document.visibilityState === 'visible') void load();
  }, REFRESH_MS);
  document.addEventListener('visibilitychange', refreshIfVisible);
  window.addEventListener('focus', refreshIfVisible);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  document.removeEventListener('visibilitychange', refreshIfVisible);
  window.removeEventListener('focus', refreshIfVisible);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    start();
    refreshIfVisible();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}

const getSnapshot = () => state;

export function useNotices(): NoticesState & { refresh: () => void } {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { ...snapshot, refresh: () => void load() };
}
