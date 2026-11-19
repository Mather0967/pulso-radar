import type { CSSProperties } from 'react';

/** Avatar con iniciales sobre degradado mandarín/pizarra (como en el portal anterior). */
export const AVATAR_STYLE: CSSProperties = {
  background: 'linear-gradient(135deg, rgba(255,118,46,.38), #405c6b)',
  color: '#f7f5ef',
  border: '1px solid rgba(255,255,255,.12)',
};

/** Entrada escalonada: 60 ms por fila, como máximo 12 pasos. */
export function staggerStyle(index: number): CSSProperties {
  return { '--d': `${Math.min(index, 11) * 0.06}s` } as CSSProperties;
}
