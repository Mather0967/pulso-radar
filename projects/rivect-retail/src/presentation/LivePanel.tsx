import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Text } from '@mantine/core'
import { HeartHandshake, MessageCircle, Megaphone, PackageX, ShoppingBag, type LucideIcon } from 'lucide-react'
import { CountUp } from '@/components/reactbits/CountUp'
import { liveEventAt, nextDelayMs, type LiveEvent } from '@/presentation/liveFeed'
import { EASE_OUT, DUR } from '@/theme/motion'

const MANDARIN = '#FF762E'
const WARM = '#F7F5EF'
const MAX_ITEMS = 8
const INITIAL_COUNT = 3

type Kind = LiveEvent['kind']

const KIND_META: Record<Kind, { icon: LucideIcon; color: string }> = {
  pedido: { icon: ShoppingBag, color: MANDARIN },
  mensaje: { icon: MessageCircle, color: '#7DD3FC' },
  stock: { icon: PackageX, color: '#FBBF24' },
  recuperado: { icon: HeartHandshake, color: '#4ADE80' },
  campana: { icon: Megaphone, color: '#C4B5FD' },
}

const timeFmt = new Intl.DateTimeFormat('es-UY', { hour: '2-digit', minute: '2-digit', hour12: false })
const amountFmt = new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0 })

const GLASS: CSSProperties = {
  background: 'rgba(17,34,44,0.55)',
  backdropFilter: 'blur(14px) saturate(140%)',
  WebkitBackdropFilter: 'blur(14px) saturate(140%)',
  border: '1px solid rgba(247,245,239,0.08)',
}

interface FeedItem {
  key: number
  event: LiveEvent
  at: number
  fresh: boolean
}

interface Counts {
  pedidos: number
  mensajes: number
}

function tally(indices: number[]): Counts {
  return indices.reduce<Counts>(
    (acc, i) => {
      const { kind } = liveEventAt(i)
      return {
        pedidos: acc.pedidos + (kind === 'pedido' ? 1 : 0),
        mensajes: acc.mensajes + (kind === 'mensaje' ? 1 : 0),
      }
    },
    { pedidos: 0, mensajes: 0 },
  )
}

/** Punto verde pulsante, reutilizable para indicar "en vivo". */
export function LiveDot({ color = '#4ADE80' }: { color?: string }) {
  const reduce = useReducedMotion()
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: 8, height: 8 }}>
      {!reduce && (
        <motion.span
          aria-hidden
          animate={{ scale: [1, 2.6], opacity: [0.7, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
          style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color }}
        />
      )}
      <span
        style={{
          position: 'relative',
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 10px ${color}`,
        }}
      />
    </span>
  )
}

function StatTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="min-w-0 flex-1">
    <div
      style={{
        flex: 1,
        minWidth: 0,
        padding: '10px 12px',
        borderRadius: 14,
        background: 'rgba(7,11,20,0.5)',
        border: `1px solid ${color}33`,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'rgba(247,245,239,0.55)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
      </Text>
      <div
        style={{
          fontFamily: 'Sora, Inter, sans-serif',
          fontSize: 24,
          fontWeight: 700,
          lineHeight: 1.2,
          color,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <CountUp value={value} separator={false} />
      </div>
    </div>
    </div>
  )
}

/** Panel lateral «EN VIVO»: feed de eventos simulados con contadores animados. */
export function LivePanel({ open }: { open: boolean }) {
  const reduce = useReducedMotion()

  const [items, setItems] = useState<FeedItem[]>(() =>
    Array.from({ length: INITIAL_COUNT }, (_, i) => ({
      key: i,
      event: liveEventAt(i),
      at: Date.now() - (INITIAL_COUNT - i) * 2 * 60_000,
      fresh: false,
    })).reverse(),
  )
  const [counts, setCounts] = useState<Counts>(() =>
    tally(Array.from({ length: INITIAL_COUNT }, (_, i) => i)),
  )

  const nextIndex = useRef(INITIAL_COUNT)
  const timer = useRef<number | null>(null)

  const push = useCallback((index: number) => {
    const event = liveEventAt(index)
    setItems((prev) =>
      [{ key: index, event, at: Date.now(), fresh: true }, ...prev].slice(0, MAX_ITEMS),
    )
    setCounts((c) => ({
      pedidos: c.pedidos + (event.kind === 'pedido' ? 1 : 0),
      mensajes: c.mensajes + (event.kind === 'mensaje' ? 1 : 0),
    }))
  }, [])

  const scheduleNext = useCallback((): void => {
    if (timer.current !== null || document.hidden) return
    const lastShown = nextIndex.current - 1
    timer.current = window.setTimeout(() => {
      timer.current = null
      const index = nextIndex.current
      nextIndex.current = index + 1
      push(index)
      scheduleNext()
    }, nextDelayMs(lastShown))
  }, [push])

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        if (timer.current !== null) {
          window.clearTimeout(timer.current)
          timer.current = null
        }
      } else {
        scheduleNext()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    scheduleNext()
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      if (timer.current !== null) {
        window.clearTimeout(timer.current)
        timer.current = null
      }
    }
  }, [scheduleNext])

  return (
    <motion.aside
      aria-label="Panel en vivo"
      aria-hidden={!open}
      initial={false}
      animate={{ width: open ? 288 : 0, opacity: open ? 1 : 0 }}
      transition={{ duration: reduce ? 0 : 0.45, ease: EASE_OUT }}
      style={{
        flexShrink: 0,
        overflow: 'hidden',
        borderRadius: 20,
        pointerEvents: open ? 'auto' : 'none',
        ...GLASS,
      }}
    >
      <div
        style={{
          width: 288,
          height: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: 16,
          color: WARM,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LiveDot />
          <Text
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: WARM,
            }}
          >
            SIMULACIÓN EN VIVO
          </Text>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <StatTile label="Pedidos hoy" value={counts.pedidos} color={MANDARIN} />
          <StatTile label="Respuestas" value={counts.mensajes} color="#7DD3FC" />
        </div>

        <motion.ul
          layout
          style={{
            flex: 1,
            minHeight: 0,
            margin: 0,
            padding: 0,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            overflow: 'hidden',
          }}
        >
          <AnimatePresence mode="popLayout" initial>
            {items.map((item, index) => (
              <FeedRow key={item.key} item={item} index={index} reduce={!!reduce} />
            ))}
          </AnimatePresence>
        </motion.ul>
      </div>
    </motion.aside>
  )
}

function FeedRow({ item, index, reduce }: { item: FeedItem; index: number; reduce: boolean }) {
  const { event, at, fresh } = item
  const meta = KIND_META[event.kind]
  const Icon = meta.icon
  const base = 'rgba(255,255,255,0.03)'
  const flash = `${MANDARIN}47`
  // Escalonado al montar el feed inicial; las entradas nuevas entran sin demora.
  const delay = reduce || fresh ? 0 : index * 0.08

  return (
    <motion.li
      layout
      initial={
        reduce
          ? { opacity: 0 }
          : { opacity: 0, x: 48, scale: 0.97, backgroundColor: fresh ? flash : base }
      }
      animate={{ opacity: 1, x: 0, scale: 1, backgroundColor: base }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, x: -24, scale: 0.97 }}
      transition={{
        layout: { type: 'spring', stiffness: 400, damping: 35 },
        x: { type: 'spring', stiffness: 380, damping: 30, delay },
        scale: { type: 'spring', stiffness: 380, damping: 30, delay },
        opacity: { duration: DUR.slow, delay },
        backgroundColor: { duration: 1.6, ease: 'easeOut', delay },
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 14,
        border: '1px solid rgba(247,245,239,0.06)',
        listStyle: 'none',
        flexShrink: 0,
      }}
    >
      <span
        aria-hidden
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          borderRadius: 10,
          flexShrink: 0,
          background: `${meta.color}24`,
          color: meta.color,
        }}
      >
        <Icon size={16} />
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: WARM,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {event.title}
        </Text>
        <Text
          style={{
            fontSize: 11,
            color: 'rgba(247,245,239,0.55)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {event.detail}
        </Text>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <Text
          style={{
            fontSize: 11,
            fontFamily: 'ui-monospace, monospace',
            color: 'rgba(247,245,239,0.5)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {timeFmt.format(at)}
        </Text>
        {event.amount !== undefined && (
          <Text style={{ fontSize: 13, fontWeight: 700, color: MANDARIN }}>
            {`$ ${amountFmt.format(event.amount)}`}
          </Text>
        )}
      </div>
    </motion.li>
  )
}
