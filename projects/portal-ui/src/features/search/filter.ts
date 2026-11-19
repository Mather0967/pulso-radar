import { normalize } from './normalize';

/**
 * Filtro de cmdk: coincidencia por SUBCADENA sobre value + keywords, sin acentos ni mayúsculas.
 * Devuelve 1 si coincide y 0 si no. Sin búsqueda, todo coincide.
 */
export function substringFilter(value: string, search: string, keywords?: string[]): number {
  const query = normalize(search);
  if (!query) return 1;
  const haystack = normalize([value, ...(keywords ?? [])].join(' '));
  return haystack.includes(query) ? 1 : 0;
}
