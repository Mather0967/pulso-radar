import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { BadgeCheck, RotateCcw, Send, ShieldCheck, UserRound } from 'lucide-react'
import type { AssistantMessage, Product } from '@/domain/models'
import { ProductThumb } from '@/components/ui/ProductThumb'
import { money, formatTime } from '@/utils/format'
import { EASE_OUT, DUR } from '@/theme/motion'

/** Pausa de «escribiendo…» antes de que aparezca el texto de una respuesta nueva. */
const THINKING_MS = 650
/** Intervalo entre avances del tipeo y cantidad de avances para todo el texto (~0,8 s). */
const TICK_MS = 16
const TICKS_PER_TEXT = 48

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

/** Tres puntos que rebotan suavemente. Sin movimiento si `animated` es false. */
function TypingDots({ animated }: { animated: boolean }) {
  return (
    <span className="flex items-center gap-1.5" role="status" aria-label="El asistente está escribiendo">
      {[0, 1, 2].map((dot) =>
        animated ? (
          <motion.span
            key={dot}
            className="h-1.5 w-1.5 rounded-full bg-brand-400"
            animate={{ y: [0, -4, 0], opacity: [0.45, 1, 0.45] }}
            transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut', delay: dot * 0.15 }}
          />
        ) : (
          <span key={dot} className="h-1.5 w-1.5 rounded-full bg-brand-400 opacity-70" />
        ),
      )}
    </span>
  )
}

/**
 * Texto de una respuesta del asistente: primero muestra los puntos, después se va
 * escribiendo. Tocarlo completa el texto. Al terminar renderiza exactamente `text`.
 */
function RevealingText({
  id,
  text,
  animate,
  onDone,
}: {
  id: string
  text: string
  animate: boolean
  onDone: (id: string) => void
}) {
  const reduce = useReducedMotion()
  const [phase, setPhase] = useState<'thinking' | 'typing' | 'done'>(
    animate && !reduce ? 'thinking' : 'done',
  )
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (phase !== 'thinking') return
    const timer = window.setTimeout(() => setPhase('typing'), THINKING_MS)
    return () => window.clearTimeout(timer)
  }, [phase])

  useEffect(() => {
    if (phase !== 'typing') return
    const step = Math.max(1, Math.ceil(text.length / TICKS_PER_TEXT))
    const timer = window.setInterval(() => {
      setCount((current) => Math.min(text.length, current + step))
    }, TICK_MS)
    return () => window.clearInterval(timer)
  }, [phase, text])

  useEffect(() => {
    if (phase === 'typing' && count >= text.length) setPhase('done')
  }, [phase, count, text.length])

  useEffect(() => {
    if (phase === 'done') onDone(id)
  }, [phase, id, onDone])

  if (phase === 'thinking') {
    return (
      <div className="flex h-4 items-center">
        <TypingDots animated />
      </div>
    )
  }

  const finish = () => setPhase('done')

  return (
    <div
      className={`whitespace-pre-line ${phase === 'typing' ? 'cursor-pointer' : ''}`}
      onClick={phase === 'typing' ? finish : undefined}
      title={phase === 'typing' ? 'Tocá para ver todo el mensaje' : undefined}
    >
      <RichText text={phase === 'done' ? text : text.slice(0, count)} />
      {phase === 'typing' ? (
        <motion.span
          aria-hidden="true"
          className="ml-0.5 inline-block h-3 w-[2px] translate-y-0.5 bg-brand-400"
          animate={{ opacity: [1, 0.15, 1] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
        />
      ) : null}
    </div>
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
  const reduce = useReducedMotion()
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const pinnedRef = useRef(true)

  // Mensajes que ya estaban al montar se muestran completos; los nuevos se animan.
  const [initialIds] = useState(() => new Set(messages.map((m) => m.id)))
  // Mensajes cuyo texto ya terminó de aparecer (habilita chips, productos y respuestas rápidas).
  const [settled, setSettled] = useState(() => new Set(initialIds))

  const markSettled = useCallback((id: string) => {
    setSettled((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
  }, [])

  const handleScroll = () => {
    const node = scrollRef.current
    if (node) pinnedRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 48
  }

  useEffect(() => {
    pinnedRef.current = true
    const node = scrollRef.current
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' })
  }, [messages.length, typing])

  // El texto que se va escribiendo crece: mantener el fondo visible mientras el usuario esté abajo.
  useEffect(() => {
    const content = contentRef.current
    const node = scrollRef.current
    if (!content || !node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      if (pinnedRef.current) node.scrollTop = node.scrollHeight
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const value = input.trim()
    if (!value || disabled) return
    onSend(value)
    setInput('')
  }

  const lastMessage = messages[messages.length - 1]
  const quickReplies =
    lastMessage?.role === 'assistant' && !typing && settled.has(lastMessage.id)
      ? lastMessage.quickReplies ?? []
      : []

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
            <p className="text-[11px] text-mint-400">en línea · respuesta simulada</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full border border-line px-2 py-0.5 text-[11px] text-slate-400 sm:inline">
            WhatsApp demo
          </span>
          <button
            onClick={onReset}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-ink-800 hover:text-white"
            title="Reiniciar conversación"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 space-y-3 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(255,118,46,0.06),transparent_55%)] px-4 py-4"
      >
        <div ref={contentRef} className="space-y-3">
          {messages.map((message) => {
            const isCustomer = message.role === 'customer'
            const isNew = !initialIds.has(message.id)
            const ready = !isNew || settled.has(message.id)
            const messageProducts = ready
              ? (message.products ?? [])
                  .map((ref) => ({
                    ref,
                    product: products.find((p) => p.id === ref.productId),
                  }))
                  .filter((entry): entry is { ref: typeof entry.ref; product: Product } => Boolean(entry.product))
              : []

            return (
              <motion.div
                key={message.id}
                initial={isNew && !reduce ? { opacity: 0, y: 12, x: isCustomer ? 16 : -16 } : false}
                animate={{ opacity: 1, y: 0, x: 0 }}
                transition={{ duration: DUR.slow, ease: EASE_OUT }}
                className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[86%] ${isCustomer ? 'items-end' : 'items-start'}`}>
                  <div
                    className={
                      isCustomer
                        ? 'rounded-2xl rounded-br-sm bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-2.5 text-[13px] leading-relaxed text-white shadow-[0_10px_26px_-10px_rgba(255,118,46,0.7),inset_0_1px_0_rgba(255,255,255,0.2)]'
                        : 'rounded-2xl rounded-bl-sm border border-line/80 bg-gradient-to-b from-ink-800/95 to-ink-850/95 px-4 py-2.5 text-[13px] leading-relaxed text-slate-200 shadow-sm'
                    }
                  >
                    {isCustomer ? (
                      <p className="whitespace-pre-line">
                        <RichText text={message.text} />
                      </p>
                    ) : (
                      <RevealingText
                        id={message.id}
                        text={message.text}
                        animate={isNew}
                        onDone={markSettled}
                      />
                    )}
                    {ready ? (
                      <p
                        className={`mt-1 text-right text-[11px] ${
                          isCustomer ? 'text-white/70' : 'text-slate-400'
                        }`}
                      >
                        {formatTime(message.at)}
                        {isCustomer ? ' ✓✓' : ''}
                      </p>
                    ) : null}
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
                          <span className="rounded-full border border-line bg-ink-800/80 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 group-hover/prod:border-brand-500/30 group-hover/prod:text-brand-300">
                            {ref.reason}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {ready && !isCustomer && message.meta?.handoff ? (
                    <p className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-200">
                      <UserRound className="h-3 w-3" />
                      Derivado a una persona · con el contexto de la charla
                    </p>
                  ) : null}

                  {ready && !isCustomer && message.meta?.detected?.length ? (
                    <p className="mt-1 pl-1 text-[11px] text-slate-400">
                      {message.meta.detected.join(' · ')}
                    </p>
                  ) : null}
                </div>
              </motion.div>
            )
          })}

          <AnimatePresence initial={false}>
            {typing ? (
              <motion.div
                key="typing"
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="flex justify-start"
              >
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-line/80 bg-ink-800/95 px-4 py-3 shadow-sm">
                  <TypingDots animated={!reduce} />
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {quickReplies.length > 0 ? (
          <motion.div
            key="quick-replies"
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-wrap gap-1.5 border-t border-line/60 bg-ink-900/60 px-3.5 py-2.5"
          >
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
          </motion.div>
        ) : null}
      </AnimatePresence>

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
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-[0_4px_16px_rgba(255,118,46,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all hover:from-brand-500 hover:to-brand-400 active:scale-95 disabled:opacity-40"
            aria-label="Enviar mensaje"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-400/75">
          <ShieldCheck className="h-3 w-3" />
          Conversación simulada: no se envía ningún mensaje real ni se reserva stock.
        </p>
      </form>
    </div>
  )
}
