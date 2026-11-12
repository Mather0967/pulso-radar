export const CHART = {
  brand: '#2f74ff',
  brandLight: '#8ab5ff',
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
  cursor: { fill: 'rgba(47,116,255,0.06)' },
}

export const SERIES_COLORS = [CHART.brand, CHART.mint, CHART.amber, CHART.violet, CHART.coral]
