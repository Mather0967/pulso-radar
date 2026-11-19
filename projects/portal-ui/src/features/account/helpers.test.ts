import { describe, it, expect } from 'vitest';
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  initials,
  passwordChangedMessage,
  passwordErrorMessage,
  sessionFullDate,
  sessionRelativeLabel,
  sessionTitle,
  validatePassword,
} from './helpers';

const valid = 'contraseña-nueva-123';

describe('validatePassword', () => {
  it('acepta una contraseña nueva válida, distinta y confirmada', () => {
    expect(validatePassword({ current: 'vieja-clave-1', next: valid, confirm: valid })).toEqual({});
  });

  it('exige la contraseña actual', () => {
    expect(validatePassword({ current: '', next: valid, confirm: valid }).current).toBeTruthy();
  });

  it(`rechaza menos de ${PASSWORD_MIN} caracteres`, () => {
    const short = 'a'.repeat(PASSWORD_MIN - 1);
    expect(validatePassword({ current: 'x', next: short, confirm: short }).next).toMatch(/al menos 12/);
  });

  it('acepta exactamente el mínimo y el máximo', () => {
    const min = 'a'.repeat(PASSWORD_MIN);
    const max = 'b'.repeat(PASSWORD_MAX);
    expect(validatePassword({ current: 'x', next: min, confirm: min })).toEqual({});
    expect(validatePassword({ current: 'x', next: max, confirm: max })).toEqual({});
  });

  it(`rechaza más de ${PASSWORD_MAX} caracteres`, () => {
    const long = 'c'.repeat(PASSWORD_MAX + 1);
    expect(validatePassword({ current: 'x', next: long, confirm: long }).next).toMatch(/no puede superar los 200 caracteres/);
  });

  it('rechaza una nueva igual a la actual', () => {
    const same = 'misma-clave-larga';
    expect(validatePassword({ current: same, next: same, confirm: same }).next).toBe('La nueva contraseña debe ser distinta.');
  });

  it('exige que la confirmación sea igual', () => {
    expect(validatePassword({ current: 'x', next: valid, confirm: valid + '!' }).confirm).toBe('Las contraseñas no coinciden.');
  });
});

describe('passwordErrorMessage', () => {
  it('traduce los códigos del servidor', () => {
    expect(passwordErrorMessage({ status: 403 })).toBe('La contraseña actual no es correcta.');
    expect(passwordErrorMessage({ status: 429 })).toMatch(/demasiados intentos/);
    expect(passwordErrorMessage({ status: 400, message: 'Muy corta.' })).toBe('Muy corta.');
    expect(passwordErrorMessage(new Error('x'))).toBe('No pudimos cambiar la contraseña. Probá de nuevo.');
  });
});

describe('passwordChangedMessage', () => {
  it('informa la cantidad de sesiones cerradas', () => {
    expect(passwordChangedMessage(3)).toBe('Contraseña cambiada. Se cerraron 3 sesiones más.');
    expect(passwordChangedMessage(1)).toBe('Contraseña cambiada. Se cerró 1 sesión más.');
  });
});

describe('sessionFullDate', () => {
  it('formatea la fecha completa en la zona de Montevideo (UTC-3)', () => {
    // 17:05 UTC = 14:05 en Montevideo
    expect(sessionFullDate(Date.UTC(2026, 10, 19, 17, 5))).toMatch(/^19\/11\/2026, 14:05$/);
  });

  it('devuelve null sin fecha', () => {
    expect(sessionFullDate(null)).toBeNull();
    expect(sessionFullDate(Number.NaN)).toBeNull();
  });
});

describe('sessionRelativeLabel', () => {
  const now = Date.UTC(2026, 10, 19, 17, 0); // 14:00 en Montevideo
  const minutesAgo = (m: number) => now - m * 60_000;

  it('usa minutos, horas y «un momento»', () => {
    expect(sessionRelativeLabel(minutesAgo(0.5), now)).toBe('Iniciada hace un momento');
    expect(sessionRelativeLabel(minutesAgo(3), now)).toBe('Iniciada hace 3 min');
    expect(sessionRelativeLabel(minutesAgo(120), now)).toBe('Iniciada hace 2 h');
  });

  it('dice «ayer» cuando fue el día anterior en Montevideo', () => {
    // 01:00 UTC del 19 = 22:00 del 18 en Montevideo; ahora es 14:00 del 19 (diferencia 13 h)
    expect(sessionRelativeLabel(Date.UTC(2026, 10, 19, 1, 0), now)).toBe('Iniciada ayer');
  });

  it('usa días y, después de una semana, la fecha corta', () => {
    expect(sessionRelativeLabel(now - 4 * 86_400_000, now)).toBe('Iniciada hace 4 días');
    expect(sessionRelativeLabel(now - 30 * 86_400_000, now)).toBe('Iniciada el 20/10/2026');
  });

  it('«fecha desconocida» sin dato', () => {
    expect(sessionRelativeLabel(null, now)).toBe('fecha desconocida');
  });
});

describe('sessionTitle', () => {
  it('usa el resumen del navegador o «Sesión anterior»', () => {
    expect(sessionTitle('Chrome en macOS')).toBe('Chrome en macOS');
    expect(sessionTitle(null)).toBe('Sesión anterior');
    expect(sessionTitle('   ')).toBe('Sesión anterior');
  });
});

describe('initials', () => {
  it('toma las iniciales de las dos primeras palabras', () => {
    expect(initials('ana lucía pérez')).toBe('AL');
    expect(initials('Admin')).toBe('A');
    expect(initials('')).toBe('?');
  });
});
