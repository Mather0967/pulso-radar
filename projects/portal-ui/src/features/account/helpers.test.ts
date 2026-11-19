import { describe, it, expect } from 'vitest';
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  initials,
  passwordChangedMessage,
  passwordErrorMessage,
  sessionDateLabel,
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
    expect(validatePassword({ current: 'x', next: long, confirm: long }).next).toMatch(/no puede tener más de 200/);
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

describe('sessionDateLabel', () => {
  it('formatea la fecha en la zona de Montevideo (UTC-3)', () => {
    // 17:05 UTC = 14:05 en Montevideo
    const label = sessionDateLabel(Date.UTC(2026, 10, 19, 17, 5));
    expect(label).toMatch(/^Iniciada 19\/11\/2026, 14:05$/);
  });

  it('muestra «fecha desconocida» cuando no hay fecha', () => {
    expect(sessionDateLabel(null)).toBe('fecha desconocida');
    expect(sessionDateLabel(undefined)).toBe('fecha desconocida');
    expect(sessionDateLabel(Number.NaN)).toBe('fecha desconocida');
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
