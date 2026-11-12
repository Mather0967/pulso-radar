import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { axisProps, gridProps, tooltipProps } from './chartTheme'

interface Series {
  key: string
  label: string
  color: string
}

export function CompareBars({
  data,
  series,
  height = 220,
  formatter,
  stacked = false,
  layout = 'horizontal',
  colors,
}: {
  data: Record<string, string | number>[]
  series: Series[]
  height?: number
  formatter?: (value: number) => string
  stacked?: boolean
  layout?: 'horizontal' | 'vertical'
  /** Colores por índice de dato (para barras con significado propio). */
  colors?: string[]
}) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={data} layout={layout} barGap={6} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid {...gridProps} />
          {layout === 'horizontal' ? (
            <>
              <XAxis dataKey="name" {...axisProps} />
              <YAxis
                {...axisProps}
                tickFormatter={(value: number) => (formatter ? formatter(value) : String(value))}
                width={56}
              />
            </>
          ) : (
            <>
              <XAxis type="number" {...axisProps} hide />
              <YAxis type="category" dataKey="name" {...axisProps} width={120} />
            </>
          )}
          <Tooltip
            {...tooltipProps}
            formatter={(value: number, name: string) => [
              formatter ? formatter(value) : value,
              series.find((s) => s.key === name)?.label ?? name,
            ]}
          />
          {series.map((item) => (
            <Bar
              key={item.key}
              dataKey={item.key}
              name={item.key}
              radius={[6, 6, 0, 0]}
              stackId={stacked ? 'stack' : undefined}
              maxBarSize={layout === 'horizontal' ? 54 : 22}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`${item.key}-${index}`}
                  fill={colors?.[index] ?? item.color}
                  fillOpacity={0.9}
                />
              ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
