// Normalización para el buscador: ignora mayúsculas y acentos («Administración» = «administracion»).

export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** true si `needle` aparece en `haystack` sin distinguir acentos ni mayúsculas. Vacío coincide con todo. */
export function matches(haystack: string, needle: string): boolean {
  const query = normalize(needle);
  if (!query) return true;
  return normalize(haystack).includes(query);
}
