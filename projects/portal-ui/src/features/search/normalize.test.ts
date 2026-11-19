import { describe, it, expect } from 'vitest';
import { matches, normalize } from './normalize';

describe('normalize', () => {
  it('quita acentos y pasa a minúsculas', () => {
    expect(normalize('Administración')).toBe('administracion');
    expect(normalize('  Ñandú  ')).toBe('nandu');
  });
});

describe('matches', () => {
  it('encuentra sin acentos ni mayúsculas', () => {
    expect(matches('Mi cuenta', 'CUENTA')).toBe(true);
    expect(matches('Administración', 'admin')).toBe(true);
    expect(matches('Administración', 'administracion')).toBe(true);
    expect(matches('Calendario', 'año')).toBe(false);
  });

  it('una búsqueda vacía coincide con todo', () => {
    expect(matches('Inicio', '   ')).toBe(true);
  });
});
