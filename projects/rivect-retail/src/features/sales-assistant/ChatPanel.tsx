import { useEffect, useRef, useState, type FormEvent } from 'react'
import { BadgeCheck, RotateCcw, Send, ShieldCheck } from 'lucide-react'
import type { AssistantMessage, Product } from '@/domain/models'
import { ProductThumb } from '@/components/ui/ProductThumb'
import { money, formatTime } from '@/utils/format'

function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*[^*]+\*)/g).map((part, index) =>
        part.startsWith('*') && part.endsWith('*') && part.length > 2 ? (
          <strong key={index} className="font-semibold text-white">
            {part.slice(1, -1)}
          </strong>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  )
}

export function ChatPanel({
  messages,
  products,
  typing,
  disabled,
  onSend,
  onReset,
  onSelectProduct,
}: {
  messages: AssistantMessage[]
  products: Product[]
  typing: boolean
  disabled: boolean
  onSend: (text: string) => void
  onReset: () => void
  onSelectProduct: (product: Product) => void
}) {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' })
  }, [messages.length, typing])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const value = input.trim()
    if (!value || disabled) return
    onSend(value)
    setInput('')
  }

  const lastMessage = messages[messages.length - 1]
  const quickReplies =
    lastMessage?.role === 'assistant' && !typing ? lastMessage.quickReplies ?? [] : []

  return (
    <div className="panel flex h-[640px] flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-ink-900/70 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-semibold text-white">
            R
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-ink-900 bg-mint-400" />
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-white">
              Asistente Rivect
              <BadgeCheck className="h-3.5 w-3.5 text-brand-400" />
            </p>
            <p className="text-[10px] text-mint-400">en línea · respuesta simulada</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full border border-line px-2 py-0.5 text-[10px] text-slate-500 sm:inline">
            WhatsApp demo
          </span>
          <button
            onClick={onReset}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-ink-800 hover:text-white"
            title="Reiniciar conversación"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(47,116,255,0.06),transparent_55%)] px-4 py-4"
      >
        {messages.map((message) => {
          const isCustomer = message.role === 'customer'
          const messageProducts = (message.products ?? [])
            .map((ref) => ({
              ref,
              product: products.find((p) => p.id === ref.productId),
            }))
            .filter((entry): entry is { ref: typeof entry.ref; product: Product } => Boolean(entry.product))

          return (
            <div key={message.id} className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[86%] ${isCustomer ? 'items-end' : 'items-start'}`}>
                <div
                  className={
                    isCustomer
                      ? 'rounded-2xl rounded-br-sm bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-2.5 text-[13px] leading-relaxed text-white shadow-[0_10px_26px_-10px_rgba(47,116,255,0.7),inset_0_1px_0_rgba(255,255,255,0.2)]'
                      : 'rounded-2xl rounded-bl-sm border border-line/80 bg-gradient-to-b from-ink-800/95 to-ink-850/95 px-4 py-2.5 text-[13px] leading-relaxed text-slate-200 shadow-sm'
                  }
                >
                  <p className="whitespace-pre-line">
                    <RichText text={message.text} />
                  </p>
                  <p
                    className={`mt-1 text-right text-[9px] ${
                      isCustomer ? 'text-white/70' : 'text-slate-500'
                    }`}
                  >
                    {formatTime(message.at)}
                    {isCustomer ? ' ✓✓' : ''}
                  </p>
                </div>

                {messageProducts.length > 0 ? (
                  <div className="mt-2 space-y-1.5">
                    {messageProducts.map(({ ref, product }) => (
                      <button
                        key={`${message.id}-${product.id}`}
                        onClick={() => onSelectProduct(product)}
                        className="group/prod flex w-full items-center gap-2.5 rounded-xl border border-line/80 bg-ink-900/85 p-2.5 text-left transition-all hover:border-brand-500/50 hover:bg-ink-850 hover:shadow-md"
                      >
                        <ProductThumb category={product.category} name={product.name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-slate-100 group-hover/prod:text-brand-200">
                            {product.name}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {money(product.price)}
                            {ref.variant ? ` · ${ref.variant}` : ''}
                          </p>
                        </div>
                        <span className="rounded-full border border-line bg-ink-800/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400 group-hover/prod:border-brand-500/30 group-hover/prod:text-brand-300">
                          {ref.reason}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}

                {!isCustomer && message.meta?.detected?.length ? (
                  <p className="mt-1 pl-1 text-[9px] text-slate-500">
                    {message.meta.detected.join(' · ')}
                  </p>
                ) : null}
              </div>
            </div>
          )
        })}

        {typing ? (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-line/80 bg-ink-800/95 px-4 py-3 shadow-sm">
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400"
                  style={{ animationDelay: `${dot * 140}ms` }}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {quickReplies.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 border-t border-line/60 bg-ink-900/60 px-3.5 py-2.5">
          {quickReplies.map((reply) => (
            <button
              key={reply}
              onClick={() => onSend(reply)}
              disabled={disabled}
              className="rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-200 shadow-sm transition-all hover:scale-105 hover:border-brand-500/60 hover:bg-brand-500/20 hover:text-white disabled:opacity-50"
            >
              {reply}
            </button>
          ))}
        </div>
      ) : null}

      <form onSubmit={submit} className="border-t border-line bg-ink-900/80 p-3">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Escribí como si fueras el cliente…"
            className="input h-10 py-0"
            disabled={disabled}
            aria-label="Mensaje para el asistente"
          />
          <button
            type="submit"
            disabled={disabled || input.trim().length === 0}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-[0_4px_16px_rgba(47,116,255,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all hover:from-brand-500 hover:to-brand-400 active:scale-95 disabled:opacity-40"
            aria-label="Enviar mensaje"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 flex items-center gap-1 text-[10px] text-slate-600">
          <ShieldCheck className="h-3 w-3" />
          Conversación simulada: no se envía ningún mensaje real ni se reserva stock.
        </p>
      </form>
    </div>
  )
}
