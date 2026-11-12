import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { tooltipProps } from './chartTheme'

export function Donut({
  data,
  height = 220,
  centerLabel,
  centerValue,
  formatter,
}: {
  data: { name: string; value: number; color: string }[]
  height?: number
  centerLabel?: string
  centerValue?: string
  formatter?: (value: number) => string
}) {
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="88%"
            paddingAngle={2}
            stroke="none"
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} fillOpacity={0.92} />
            ))}
          </Pie>
          <Tooltip
            {...tooltipProps}
            formatter={(value: number, name: string) => [
              formatter ? formatter(value) : value,
              name,
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
      {centerValue ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-lg font-semibold text-white">{centerValue}</span>
          {centerLabel ? (
            <span className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-slate-500">
              {centerLabel}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
