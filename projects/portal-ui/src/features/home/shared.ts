import { useEffect, useState } from 'react';

// Claves de proyecto conocidas por el portal. Cualquier otro id cae en «general».
export type ProjectKey = 'pulso' | 'landur' | 'studio' | 'retail' | 'general';

export const PROJECT_LABEL: Record<ProjectKey, string> = {
  pulso: 'Pulso',
  landur: 'LANDUR',
  studio: 'RIVECT Studio',
  retail: 'Retail',
  general: 'General',
};

// Tonos del punto de cada proyecto (HSL sin función), ver design-brief §3.
export const PROJECT_COLOR: Record<ProjectKey, string> = {
  pulso: '186 52% 56%',
  landur: '255 80% 74%',
  studio: '340 60% 68%',
  retail: '43 80% 62%',
  general: '200 14% 62%',
};

export const toProjectKey = (id: string): ProjectKey =>
  id in PROJECT_LABEL ? (id as ProjectKey) : 'general';

const TZ = 'America/Montevideo';

const dayKey = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

export const todayKey = () => dayKey(new Date());

export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// Las fechas del calendario son solo día: se formatean en UTC mediodía para no correrlas de día.
export function dateText(date: string): string {
  const today = todayKey();
  if (date === today) return 'Hoy';
  if (date === addDays(today, 1)) return 'Mañana';
  return new Intl.DateTimeFormat('es-UY', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${date}T12:00:00Z`));
}

export function dateChip(date: string): { top: string; bottom: string } {
  const today = todayKey();
  const d = new Date(`${date}T12:00:00Z`);
  const bottom = String(d.getUTCDate());
  if (date === today) return { top: 'Hoy', bottom };
  if (date === addDays(today, 1)) return { top: 'Mañana', bottom };
  const top = new Intl.DateTimeFormat('es-UY', { weekday: 'short', timeZone: 'UTC' }).format(d).replace('.', '');
  return { top, bottom };
}

export function timeText(job: { allDay: boolean; start?: string | null; end?: string | null }): string {
  if (job.allDay) return 'Todo el día';
  if (job.start && job.end) return `${job.start}–${job.end}`;
  return job.start ?? '';
}

// Devuelve true solo tras `ms` milisegundos con la condición activa (evita parpadeo de Skeleton).
export function useDelayed(active: boolean, ms = 150): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!active) {
      setOn(false);
      return;
    }
    const t = setTimeout(() => setOn(true), ms);
    return () => clearTimeout(t);
  }, [active, ms]);
  return on;
}
