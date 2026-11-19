import { describe, it, expect } from 'vitest';
import { substringFilter } from './filter';

describe('substringFilter', () => {
  it('«cal» encuentra Calendario y no Inicio ni Mi cuenta', () => {
    const calendar = substringFilter('nav-calendar', 'cal', ['Calendario', 'trabajos', 'agenda']);
    const home = substringFilter('nav-home', 'cal', ['Inicio', 'página principal']);
    const account = substringFilter('nav-account', 'cal', ['Mi cuenta', 'contraseña', 'sesiones', 'perfil']);
    expect(calendar).toBe(1);
    expect(home).toBe(0);
    expect(account).toBe(0);
  });

  it('ignora acentos y mayúsculas', () => {
    expect(substringFilter('nav-home', 'PAGINA', ['Inicio', 'página principal'])).toBe(1);
    expect(substringFilter('nav-admin', 'administracion', ['Administración'])).toBe(1);
  });

  it('exige subcadena, no coincidencia difusa', () => {
    expect(substringFilter('nav-home', 'ihp', ['Inicio'])).toBe(0);
  });

  it('sin búsqueda todo coincide', () => {
    expect(substringFilter('nav-home', '  ', ['Inicio'])).toBe(1);
  });
});
