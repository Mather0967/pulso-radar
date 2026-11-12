import { Clock, MessageSquare, Send, Sparkles } from 'lucide-react'
import type { Product, RecoveryLead, RecoveryStatus } from '@/domain/models'
import { RECOVERY_STATUSES, RECOVERY_STATUS_META } from '@/domain/calculations/recovery'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ProductThumb } from '@/components/ui/ProductThumb'
import { cn, formatDate, money, num, relativeDays } from '@/utils/format'

export function LeadDrawer({
  lead,
  product,
  onClose,
  onStatusChange,
  onFollowUp,
}: {
  lead: RecoveryLead | null
  product: Product | undefined
  onClose: () => void
  onStatusChange: (status: RecoveryStatus) => void
  onFollowUp: () => void
}) {
  return (
    <Modal
      open={Boolean(lead)}
      onClose={onClose}
      title={lead?.customerName ?? ''}
      description={lead ? `${lead.channel} · última interacción ${relativeDays(lead.lastContact)}` : undefined}
      width="lg"
      footer={
        lead ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cerrar
            </Button>
            <Button onClick={onFollowUp}>
              <Send className="h-4 w-4" />
              Simular seguimiento
            </Button>
          </>
        ) : null
      }
    >
      {lead ? (
        <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={lead.status} label={RECOVERY_STATUS_META[lead.status].label} />
              <Badge tone="neutral">{lead.id.toUpperCase()}</Badge>
            </div>

            <div className="rounded-xl border border-line bg-ink-900/60 p-3">
              <p className="kpi-label">Producto consultado</p>
              <div className="mt-2 flex items-center gap-3">
                {product ? (
                  <ProductThumb category={product.category} name={product.name} />
                ) : null}
                <div>
                  <p className="text-sm font-medium text-slate-100">
                    {product?.name ?? 'Sin producto asociado'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {money(lead.estimatedTicket)} · {product?.stock ?? 0} u. en stock
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-line bg-ink-900/60 p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-600">Probabilidad</p>
                <p className="mt-1 font-display text-lg font-semibold text-white">
                  {num(lead.estimatedConversion)}%
                </p>
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-ink-700">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-mint-400"
                    style={{ width: `${lead.estimatedConversion}%` }}
                  />
                </div>
              </div>
              <div className="rounded-xl border border-line bg-ink-900/60 p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-600">Ticket estimado</p>
                <p className="mt-1 font-display text-lg font-semibold text-white">
                  {money(lead.estimatedTicket)}
                </p>
                <p className="mt-1 text-[10px] text-slate-500">Valor hipotético</p>
              </div>
            </div>

            <div className="rounded-xl border border-brand-500/20 bg-brand-500/[0.06] p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-brand-300">
                <Sparkles className="h-3.5 w-3.5" />
                Próxima acción sugerida
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{lead.suggestedAction}</p>
            </div>

            <div>
              <p className="kpi-label mb-2">Cambiar estado</p>
              <div className="flex flex-wrap gap-1.5">
                {RECOVERY_STATUSES.map((status) => (
                  <button
                    key={status}
                    onClick={() => onStatusChange(status)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-[11px] transition',
                      lead.status === status
                        ? 'border-brand-500/50 bg-brand-500/15 text-brand-200'
                        : 'border-line bg-ink-900/60 text-slate-500 hover:text-slate-200',
                    )}
                  >
                    {RECOVERY_STATUS_META[status].label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <p className="kpi-label mb-3 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Historial de la oportunidad
            </p>
            <ol className="relative space-y-3 border-l border-line pl-4">
              {lead.history.map((event, index) => (
                <li key={`${event.at}-${index}`} className="relative">
                  <span
                    className={cn(
                      'absolute -left-[21px] top-1 h-2 w-2 rounded-full ring-4 ring-ink-850',
                      event.kind === 'cliente'
                        ? 'bg-brand-400'
                        : event.kind === 'tienda'
                          ? 'bg-mint-400'
                          : 'bg-slate-500',
                    )}
                  />
                  <p className="text-xs leading-relaxed text-slate-300">{event.label}</p>
                  <p className="mt-0.5 text-[10px] text-slate-600">
                    {formatDate(event.at)} · {event.kind}
                  </p>
                </li>
              ))}
            </ol>

            <div className="mt-5 rounded-xl border border-dashed border-line p-3">
              <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <MessageSquare className="h-3.5 w-3.5" />
                Seguimiento por {lead.channel}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                El envío es simulado. Podés editar el mensaje antes de registrarlo.
              </p>
              <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={onFollowUp}>
                <Send className="h-3.5 w-3.5" />
                Ver mensaje sugerido
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
