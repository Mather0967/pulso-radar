// Tokens de movimiento compartidos: una sola curva y tres duraciones para toda la demo.
// Las mismas cifras están como variables CSS (--ease-out, --dur-*) en styles/index.css.
export const EASE_OUT = [0.22, 1, 0.36, 1] as const
export const EASE = EASE_OUT

export const DUR = {
  fast: 0.15,
  base: 0.25,
  slow: 0.4,
} as const
