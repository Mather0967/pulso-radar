import { useEffect, useState } from 'react'
import { Send, ShieldCheck } from 'lucide-react'
import type { RecoveryLead } from '@/domain/models'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

export function FollowUpModal({
  lead,
  message,
  open,
  onClose,
  onSend,
}: {
  lead: RecoveryLead | null
  message: string
  open: boolean
  onClose: () => void
  onSend: (message: string) => void
}) {
  const [draft, setDraft] = useState(message)

  useEffect(() => {
    if (open) setDraft(message)
  }, [open, message])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Vista previa del seguimiento"
      description={`Canal: ${lead?.channel ?? '—'} · mensaje no enviado`}
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              onSend(draft)
              onClose()
            }}
            disabled={draft.trim().length === 0}
          >
            <Send className="h-4 w-4" />
            Simular envío
          </Button>
        </>
      }
    >
      <div className="rounded-2xl border border-line bg-[linear-gradient(180deg,rgba(47,116,255,0.06),transparent)] p-4">
        <div className="flex items-center gap-2 border-b border-line/70 pb-2">
          <span className="h-2 w-2 rounded-full bg-mint-400" />
          <p className="text-[11px] text-slate-400">
            Para <span className="text-slate-200">{lead?.customerName}</span> · {lead?.channel}
          </p>
        </div>
        <div className="mt-3 max-w-[92%] rounded-2xl rounded-bl-md border border-line bg-ink-800/90 p-3 text-[13px] leading-relaxed text-slate-200">
          <p className="whitespace-pre-line">{draft}</p>
        </div>
      </div>

      <label className="mt-4 block">
        <span className="field-label">Mensaje editable</span>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={4}
          className="input resize-none text-[13px] leading-relaxed"
        />
      </label>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-ink-900/60 p-3 text-[11px] leading-relaxed text-slate-500">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-400" />
        En la demo ningún mensaje sale del navegador. El envío simulado queda registrado en el
        historial de la oportunidad y actualiza su estado.
      </div>
    </Modal>
  )
}
