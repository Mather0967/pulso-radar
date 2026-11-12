import { useMemo, useState } from 'react'
import { AlertTriangle, Boxes, Coins, PackageX, Search, SlidersHorizontal, TrendingDown } from 'lucide-react'
import type { InventoryItem } from '@/domain/models'
import { AnimatedContent } from '@/components/reactbits/AnimatedContent'
import { Badge } from '@/components/ui/Badge'
import { Panel, PanelHeader, SectionHeading } from '@/components/ui/Card'
import { StatTile } from '@/components/ui/Metric'
import { NumberField } from '@/components/ui/Field'
import { CoverageBars } from '@/components/charts/CoverageBars'
import { Donut } from '@/components/charts/Donut'
import { useSimulationStore } from '@/store/useSimulationStore'
import { buildInventory, sortInventory, type InventorySortKey } from '@/services/inventory/inventoryService'
import { CHART } from '@/components/charts/chartTheme'
import { money, num } from '@/utils/format'
import { StockTable } from './StockTable'
import { StockAlerts } from './StockAlerts'
import { StockProductModal } from './StockProductModal'

const CATEGORY_COLORS = [CHART.brand, CHART.mint, CHART.amber, CHART.violet, CHART.coral, '#38bdf8']

export function StockPage() {
  const products = useSimulationStore((s) => s.products)
  const thresholds = useSimulationStore((s) => s.thresholds)
  const setThresholds = useSimulationStore((s) => s.setThresholds)

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Todas')
  const [onlyAlerts, setOnlyAlerts] = useState(false)
  const [sortKey, setSortKey] = useState<InventorySortKey>('capital')
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const report = useMemo(() => buildInventory(products, thresholds), [products, thresholds])
  const categories = useMemo(
    () => ['Todas', ...Array.from(new Set(products.map((p) => p.category)))],
    [products],
  )

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const items = report.items.filter((item) => {
      const matchesCategory = category === 'Todas' || item.product.category === category
      const matchesQuery =
        normalized.length === 0 ||
        `${item.product.name} ${item.product.sku} ${item.product.tags.join(' ')}`
          .toLowerCase()
          .includes(normalized)
      const matchesAlerts = !onlyAlerts || item.alerts.length > 0
      return matchesCategory && matchesQuery && matchesAlerts
    })
    return sortInventory(items, sortKey, direction)
  }, [report.items, category, query, onlyAlerts, sortKey, direction])

  const selected = report.items.find((item) => item.product.id === selectedId) ?? null

  const coverageData = useMemo(
    () =>
      report.items
        .filter((item) => item.coverageDays !== null)
        .sort((a, b) => (a.coverageDays ?? 0) - (b.coverageDays ?? 0))
        .slice(0, 8)
        .map((item) => ({
          name:
            item.product.name.length > 20
              ? `${item.product.name.slice(0, 19)}…`
              : item.product.name,
          coverage: Math.round(item.coverageDays ?? 0),
          atRisk: item.stockoutRisk,
        })),
    [report.items],
  )

  const capitalData = report.byCategory.map((entry, index) => ({
    name: entry.category,
    value: Math.round(entry.capital),
    color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
  }))

  const handleSort = (key: InventorySortKey) => {
    if (key === sortKey) {
      setDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setDirection(key === 'name' ? 'asc' : 'desc')
    }
  }

  const handleOpen = (item: InventoryItem) => setSelectedId(item.product.id)

  return (
    <div className="space-y-5">
      <AnimatedContent>
        <SectionHeading
          eyebrow="Módulo 04 · Inventario"
          title="Stock Intelligence"
          description="Análisis automático del catálogo: cobertura de stock, riesgo de agotamiento, capital inmovilizado y oportunidades de promoción en productos de baja rotación."
          action={<Badge tone="brand" dot>Productos simulados</Badge>}
        />
      </AnimatedContent>

      <AnimatedContent delay={0.05}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Capital inmovilizado"
            value={report.totals.inventoryCapital}
            prefix="$ "
            icon={<Coins className="h-4 w-4" />}
            tone="amber"
            hint={`${num(report.totals.stockUnits)} unidades en stock`}
          />
          <StatTile
            label="Riesgo de agotamiento"
            value={report.totals.atRisk}
            suffix=" productos"
            icon={<AlertTriangle className="h-4 w-4" />}
            tone="coral"
            hint={`Cobertura menor a ${thresholds.coverageThreshold} días`}
          />
          <StatTile
            label="Baja rotación"
            value={report.totals.lowRotation}
            suffix=" productos"
            icon={<TrendingDown className="h-4 w-4" />}
            hint={`${num(report.totals.outOfStock)} sin stock`}
          />
          <StatTile
            label="Oportunidades de promoción"
            value={report.totals.promoOpportunities}
            suffix=" productos"
            icon={<Boxes className="h-4 w-4" />}
            tone="mint"
            hint={`Cobertura promedio ${num(report.totals.averageCoverageDays, 0)} días`}
          />
        </div>
      </AnimatedContent>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <AnimatedContent delay={0.1} className="min-w-0">
          <Panel className="panel-pad h-full">
            <PanelHeader
              title="Cobertura de stock más baja"
              subtitle="Días de inventario según el ritmo de venta de los últimos 30 días."
              icon={<PackageX className="h-4 w-4" />}
              action={<Badge tone="amber">Umbral {thresholds.coverageThreshold} d</Badge>}
            />
            <div className="mt-4">
              <CoverageBars data={coverageData} threshold={thresholds.coverageThreshold} height={250} />
            </div>
          </Panel>
        </AnimatedContent>

        <AnimatedContent delay={0.15} className="min-w-0">
          <Panel className="panel-pad h-full">
            <PanelHeader
              title="Capital por categoría"
              subtitle="Distribución del dinero inmovilizado en stock."
              icon={<Coins className="h-4 w-4" />}
            />
            <div className="mt-2 grid items-center gap-2 sm:grid-cols-2">
              <Donut
                data={capitalData}
                height={190}
                centerLabel="capital total"
                centerValue={money(report.totals.inventoryCapital)}
                formatter={(value) => money(value)}
              />
              <ul className="space-y-1.5">
                {capitalData.map((entry) => (
                  <li key={entry.name} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
                      {entry.name}
                    </span>
                    <span className="text-slate-300">{money(entry.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Panel>
        </AnimatedContent>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <AnimatedContent delay={0.2} className="min-w-0">
          <Panel className="overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <PanelHeader
                  title="Catálogo analizado"
                  subtitle={`${filtered.length} productos · ordenado por ${
                    sortKey === 'coverage' ? 'cobertura' : sortKey
                  }`}
                />
                <label className="flex items-center gap-2 text-[11px] text-slate-400">
                  <input
                    type="checkbox"
                    checked={onlyAlerts}
                    onChange={(event) => setOnlyAlerts(event.target.checked)}
                    className="h-3.5 w-3.5 accent-brand-500"
                  />
                  Solo con alertas
                </label>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar producto, SKU o etiqueta"
                    className="input h-9 py-0 pl-8 text-xs"
                    aria-label="Buscar productos"
                  />
                </div>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="input h-9 py-0 text-xs sm:w-44"
                  aria-label="Filtrar por categoría"
                >
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <StockTable
              items={filtered}
              sortKey={sortKey}
              direction={direction}
              onSort={handleSort}
              onOpen={handleOpen}
            />
          </Panel>
        </AnimatedContent>

        <AnimatedContent delay={0.25} className="min-w-0">
          <div className="space-y-4">
            <Panel className="panel-pad">
              <PanelHeader
                title="Umbrales del análisis"
                subtitle="Ajustá cuándo consideramos riesgo o exceso."
                icon={<SlidersHorizontal className="h-4 w-4" />}
              />
              <div className="mt-3 space-y-3">
                <NumberField
                  label="Días de cobertura para riesgo"
                  value={thresholds.coverageThreshold}
                  onChange={(value) => setThresholds({ coverageThreshold: Math.max(1, value) })}
                  suffix="días"
                />
                <NumberField
                  label="Días sin venta para capital inmovilizado"
                  value={thresholds.deadStockDays}
                  onChange={(value) => setThresholds({ deadStockDays: Math.max(1, value) })}
                  suffix="días"
                />
                <NumberField
                  label="Cobertura de exceso"
                  value={thresholds.excessThreshold}
                  onChange={(value) => setThresholds({ excessThreshold: Math.max(1, value) })}
                  suffix="días"
                />
              </div>
            </Panel>

            <Panel className="panel-pad">
              <PanelHeader
                title="Alertas generadas"
                subtitle="Cada alerta explica el dato que la origina."
                icon={<AlertTriangle className="h-4 w-4" />}
              />
              <div className="mt-3">
                <StockAlerts report={report} onOpenProduct={setSelectedId} />
              </div>
            </Panel>
          </div>
        </AnimatedContent>
      </div>

      <StockProductModal item={selected} onClose={() => setSelectedId(null)} />
    </div>
  )
}
