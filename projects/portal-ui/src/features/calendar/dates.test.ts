import { describe, expect, it } from 'vitest';
import {
  addDays,
  formatDayHeading,
  formatTitle,
  monthGrid,
  monthStart,
  parseIso,
  parseRoute,
  rangeFor,
  routeFor,
  toIso,
  weekStart,
} from './dates';

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

describe('monthGrid', () => {
  it('always returns 6 weeks (42 days) starting on Monday', () => {
    for (const [y, m] of [[2026, 11], [2026, 2], [2027, 2], [2028, 2], [2026, 8]] as const) {
      const grid = monthGrid(d(y, m, 15));
      expect(grid).toHaveLength(42);
      expect(grid[0].getDay()).toBe(1);
    }
  });

  it('covers the whole month, padding with other-month days', () => {
    // Noviembre 2026 empieza en domingo: la cuadrícula arranca el lunes 26 de octubre.
    const grid = monthGrid(d(2026, 11, 1));
    expect(toIso(grid[0])).toBe('2026-10-26');
    expect(toIso(grid[41])).toBe('2026-12-06');
    expect(toIso(grid[41])).toBe(toIso(addDays(monthStart(d(2026, 11, 1)), 41)));
  });

  it('uses a 6th week when the month needs it', () => {
    // Agosto 2026 empieza en sábado: necesita seis semanas.
    const grid = monthGrid(d(2026, 8, 1));
    expect(toIso(grid[35])).toBe('2026-08-31');
    expect(toIso(grid[41])).toBe('2026-09-06');
  });
});

describe('leap years', () => {
  it('parses and rolls Feb 29 2028 correctly', () => {
    expect(parseIso('2028-02-29')).not.toBeNull();
    expect(parseIso('2027-02-29')).toBeNull();
    expect(toIso(addDays(d(2028, 2, 28), 1))).toBe('2028-02-29');
    expect(toIso(addDays(d(2028, 2, 29), 1))).toBe('2028-03-01');
  });

  it('builds the month grid for February 2028', () => {
    const grid = monthGrid(d(2028, 2, 1));
    expect(grid.map(toIso)).toContain('2028-02-29');
    expect(grid).toHaveLength(42);
  });
});

describe('weekStart', () => {
  it('returns the Monday of the week, including for Sundays', () => {
    expect(toIso(weekStart(d(2026, 11, 19)))).toBe('2026-11-16'); // jueves
    expect(toIso(weekStart(d(2026, 11, 22)))).toBe('2026-11-16'); // domingo
    expect(toIso(weekStart(d(2026, 11, 16)))).toBe('2026-11-16'); // lunes
    expect(weekStart(d(2026, 11, 22)).getDay()).toBe(1);
  });
});

describe('rangeFor', () => {
  it('month range spans the 42-day grid', () => {
    expect(rangeFor('month', d(2026, 11, 1))).toEqual({ from: '2026-10-26', to: '2026-12-06' });
  });

  it('week range is Monday through Sunday', () => {
    expect(rangeFor('week', d(2026, 11, 19))).toEqual({ from: '2026-11-16', to: '2026-11-22' });
  });

  it('agenda range runs 7 days back and 60 ahead of now', () => {
    expect(rangeFor('agenda', d(2026, 11, 19), d(2026, 11, 19))).toEqual({ from: '2026-11-12', to: '2027-01-18' });
  });
});

describe('formatTitle', () => {
  it('formats months with only the first letter capitalized', () => {
    expect(formatTitle('month', d(2026, 11, 1))).toBe('Noviembre de 2026');
    expect(formatTitle('month', d(2026, 9, 1))).toBe('Septiembre de 2026');
  });

  it('formats weeks inside one month', () => {
    expect(formatTitle('week', d(2026, 11, 19))).toBe('16 al 22 de noviembre de 2026');
  });

  it('formats weeks across months and years', () => {
    expect(formatTitle('week', d(2026, 10, 28))).toBe('26 de octubre al 1 de noviembre de 2026');
    expect(formatTitle('week', d(2026, 12, 30))).toBe('28 de diciembre de 2026 al 3 de enero de 2027');
  });

  it('formats the agenda title and day headings', () => {
    expect(formatTitle('agenda', d(2026, 11, 1))).toBe('Próximos 60 días');
    expect(formatDayHeading(d(2026, 11, 18))).toBe('Miércoles 18 de noviembre de 2026');
  });
});

describe('routes', () => {
  it('round-trips month, week and agenda hashes', () => {
    expect(routeFor('month', d(2026, 11, 19))).toBe('#/mes/2026-11');
    expect(routeFor('week', d(2026, 11, 19))).toBe('#/semana/2026-11-16');
    expect(routeFor('agenda', d(2026, 11, 19))).toBe('#/agenda');
    expect(parseRoute('#/mes/2026-11')?.view).toBe('month');
    expect(parseRoute('#/semana/2028-02-29')?.cursor && toIso(parseRoute('#/semana/2028-02-29')!.cursor!)).toBe('2028-02-29');
    expect(parseRoute('#/mes/2026-13')).toBeNull();
    expect(parseRoute('#/semana/2027-02-29')).toBeNull();
    expect(parseRoute('')).toBeNull();
  });
});
