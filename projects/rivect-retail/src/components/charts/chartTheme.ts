import { useReducedMotion } from 'framer-motion'

export const CHART = {
  brand: '#ff762e',
  brandLight: '#ffb88a',
  mint: '#4ade9f',
  amber: '#f7bd54',
  coral: '#ff7a7a',
  violet: '#a78bfa',
  grid: '#1a2337',
  axisText: '#64748b',
  surface: '#0b1120',
}

export const axisProps = {
  stroke: '#1a2337',
  tick: { fill: CHART.axisText, fontSize: 11 },
  tickLine: false,
  axisLine: false,
}

export const gridProps = {
  stroke: CHART.grid,
  strokeDasharray: '3 6',
  vertical: false,
}

export const tooltipProps = {
  contentStyle: {
    background: CHART.surface,
    border: '1px solid #1a2337',
    borderRadius: 12,
    fontSize: 12,
    color: '#e2e8f0',
    boxShadow: '0 18px 40px -22px rgba(0,0,0,0.9)',
    padding: '10px 12px',
  },
  labelStyle: { color: '#94a3b8', fontSize: 11, marginBottom: 4 },
  itemStyle: { color: '#e2e8f0', fontSize: 12 },
  cursor: { fill: 'rgba(255,118,46,0.06)' },
  animationDuration: 160,
}

export const SERIES_COLORS = [CHART.brand, CHART.mint, CHART.amber, CHART.violet, CHART.coral]

/** Duración de la entrada de las series (ms). */
export const CHART_ANIMATION_MS = 800

/** Props de animación de Recharts; se apagan con "reducir movimiento". */
export function useChartMotion() {
  const reduce = useReducedMotion()
  return {
    isAnimationActive: !reduce,
    animationDuration: CHART_ANIMATION_MS,
    animationEasing: 'ease-out' as const,
  }
}
