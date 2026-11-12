import { ArrowUpRight } from 'lucide-react'
import type { Product, RecoveryLead } from '@/domain/models'
import { RECOVERY_STATUS_META } from '@/domain/calculations/recovery'
import { StatusBadge } from '@/components/ui/Badge'
import { ProductThumb } from '@/components/ui/ProductThumb'
import { money, num, relativeDays } from '@/utils/format'

export function LeadTable({
  leads,
  products,
  onOpen,
}: {
  leads: RecoveryLead[]
  products: Product[]
  onOpen: (lead: RecoveryLead) => void
}) {
  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
        <p className="text-sm text-slate-300">No hay oportunidades con estos filtros.</p>
        <p className="text-xs text-slate-500">Probá con otro estado o limpiá la búsqueda.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="hidden grid-cols-[1.4fr_1.3fr_0.8fr_0.6fr_0.9fr_auto] gap-3 border-b border-line px-4 py-2.5 text-[10px] uppercase tracking-[0.14em] text-slate-600 lg:grid">
        <span>Cliente</span>
        <span>Producto consultado</span>
        <span>Ticket est.</span>
        <span>Prob.</span>
        <span>Estado</span>
        <span className="text-right">Acción</span>
      </div>
      <ul className="divide-y divide-line/60">
        {leads.map((lead) => {
          const product = products.find((p) => p.id === lead.productId)
          return (
            <li key={lead.id}>
              <button
                onClick={() => onOpen(lead)}
                className="grid w-full grid-cols-1 gap-2 px-4 py-3 text-left transition hover:bg-ink-800/50 lg:grid-cols-[1.4fr_1.3fr_0.8fr_0.6fr_0.9fr_auto] lg:items-center lg:gap-3"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-ink-800 text-[11px] font-semibold text-brand-200">
                    {lead.customerName
                      .split(' ')
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join('')}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-slate-200">{lead.customerName}</p>
                    <p className="text-[10px] text-slate-500">
                      {lead.channel} · {relativeDays(lead.lastContact)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {product ? (
                    <ProductThumb category={product.category} name={product.name} size="sm" />
                  ) : null}
                  <div className="min-w-0">
                    <p className="truncate text-[11px] text-slate-300">
                      {product?.name ?? 'Producto sin referencia'}
                    </p>
                    <p className="text-[10px] text-slate-600">{product?.sku}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between lg:block">
                  <span className="text-[10px] text-slate-600 lg:hidden">Ticket</span>
                  <span className="text-xs text-slate-200">{money(lead.estimatedTicket)}</span>
                </div>

                <div className="flex items-center justify-between lg:block">
                  <span className="text-[10px] text-slate-600 lg:hidden">Probabilidad</span>
                  <div className="flex items-center gap-1.5">
                    <div className="h-1 w-10 overflow-hidden rounded-full bg-ink-700">
                      <div
                        className="h-full rounded-full bg-brand-400"
                        style={{ width: `${lead.estimatedConversion}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400">{num(lead.estimatedConversion)}%</span>
                  </div>
                </div>

                <div>
                  <StatusBadge
                    status={lead.status}
                    label={RECOVERY_STATUS_META[lead.status].label}
                  />
                </div>

                <div className="flex items-center justify-between gap-2 lg:justify-end">
                  <span className="truncate text-[10px] text-slate-500 lg:hidden">
                    {lead.suggestedAction}
                  </span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-slate-500">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
