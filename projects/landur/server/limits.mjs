import { DomainError } from './ledger.mjs';

// Límite por sesión para las operaciones caras. Una vista previa de importación toma un
// bloqueo de escritura y hasta 200 inserciones que después revierte, y cada comprobante
// ocupa hasta 1,5 MB: sin esto, un cliente con sesión válida puede amplificarlas.
//
// Se lanza como DomainError (y no como un Error con `status`) para que un 429 esperado no
// se registre como una falla inesperada de la solicitud. Ambas superficies —el servidor
// autónomo y el montaje del portal— traducen `error.status`, así que el texto llega igual.
export function createRateLimiter({ limit, windowMs, maxKeys = 500 }) {
  const hits = new Map();
  return {
    check(key) {
      const now = Date.now();
      // Que la tabla se llene no puede convertirse en un bloqueo general: se descartan las
      // entradas que vencen antes, que son las más antiguas.
      if (hits.size >= maxKeys)
        for (const [name] of [...hits].sort((a, b) => a[1].until - b[1].until).slice(0, Math.ceil(maxKeys / 2)))
          hits.delete(name);
      const current = hits.get(key);
      if (!current || now > current.until) { hits.set(key, { count: 1, until: now + windowMs }); return; }
      if (++current.count > limit)
        throw new DomainError('Demasiadas operaciones seguidas. Esperá un momento e intentá otra vez.', 429);
    }
  };
}
