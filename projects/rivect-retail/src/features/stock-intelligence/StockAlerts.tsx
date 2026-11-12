import { AlertTriangle, ArrowUpRight } from 'lucide-react'
import type { InventoryReport } from '@/domain/models'
import { cn } from '@/utils/format'

const severityStyles = {
  alta: 'border-coral-500/25 bg-coral-500/[0.07]',
  media: 'border-amber-500/25 bg-amber-500/[0.06]',
  baja: 'border-line bg-ink-900/50',
}

export function StockAlerts({
  report,
  onOpenProduct,
}: {
  report: InventoryReport
  onOpenProduct: (productId: string) => void
}) {
  const alerts = report.alerts.slice(0, 8)

  return (
    <div className="space-y-2">
      {alerts.length === 0 ? (
        <p className="rounded-xl border border-mint-500/25 bg-mint-500/[0.06] p-3 text-xs text-mint-300">
          Sin alertas con los umbrales actuales.
        </p>
      ) : (
        alerts.map((alert, index) => (
          <button
            key={`${alert.productId}-${alert.kind}-${index}`}
            onClick={() => onOpenProduct(alert.productId)}
            className={cn(
              'group flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-left transition hover:border-brand-500/40',
              severityStyles[alert.severity],
            )}
          >
            <AlertTriangle
              className={cn(
                'mt-0.5 h-3.5 w-3.5 shrink-0',
                alert.severity === 'alta'
                  ? 'text-coral-400'
                  : alert.severity === 'media'
                    ? 'text-amber-400'
                    : 'text-brand-400',
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium text-slate-200">{alert.productName}</p>
              <p className="text-[10px] text-slate-500">
                {alert.title} · {alert.detail}
              </p>
            </div>
            <ArrowUpRight className="mt-0.5 h-3 w-3 shrink-0 text-slate-600 transition group-hover:text-brand-300" />
          </button>
        ))
      )}
      {report.alerts.length > 8 ? (
        <p className="text-center text-[10px] text-slate-600">
          +{report.alerts.length - 8} alertas adicionales en la tabla
        </p>
      ) : null}
    </div>
  )
}
