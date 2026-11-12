import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { axisProps, CHART, gridProps, tooltipProps } from './chartTheme'

export function CoverageBars({
  data,
  threshold,
  height = 260,
}: {
  data: { name: string; coverage: number; atRisk: boolean }[]
  threshold: number
  height?: number
}) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid {...gridProps} vertical horizontal={false} />
          <XAxis
            type="number"
            {...axisProps}
            tickFormatter={(v: number) => `${v} d`}
            domain={[0, 'dataMax']}
          />
          <YAxis type="category" dataKey="name" {...axisProps} width={150} />
          <Tooltip
            {...tooltipProps}
            formatter={(value: number) => [`${value} días`, 'Cobertura']}
          />
          <ReferenceLine
            x={threshold}
            stroke={CHART.amber}
            strokeDasharray="4 4"
            label={{ value: `Umbral ${threshold} d`, fill: CHART.amber, fontSize: 10, position: 'insideTopRight' }}
          />
          <Bar dataKey="coverage" radius={[0, 6, 6, 0]} barSize={14}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.atRisk ? CHART.coral : CHART.brand} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
