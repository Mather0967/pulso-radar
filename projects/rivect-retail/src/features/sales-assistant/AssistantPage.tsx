import { useMemo, useRef, useState } from 'react'
import { BadgeCheck, MessageSquare, ShoppingBag, Sparkles, TicketCheck, TrendingUp, Users } from 'lucide-react'
import type { AssistantMessage, Product } from '@/domain/models'
import { AnimatedContent } from '@/components/reactbits/AnimatedContent'
import { SectionHeading } from '@/components/ui/Card'
import { StatTile } from '@/components/ui/Metric'
import { Badge } from '@/components/ui/Badge'
import { useSimulationStore } from '@/store/useSimulationStore'
import { createAssistantReply } from '@/services/assistant/engine'
import { ChatPanel } from './ChatPanel'
import { CatalogPanel } from './CatalogPanel'
import { ProductDetailModal } from './ProductDetailModal'
import { money, num, uid } from '@/utils/format'

export function AssistantPage() {
  const products = useSimulationStore((s) => s.products)
  const profile = useSimulationStore((s) => s.storeProfile)
  const assistant = useSimulationStore((s) => s.assistant)
  const context = useSimulationStore((s) => s.assistantContext)
  const sendAssistantMessage = useSimulationStore((s) => s.sendAssistantMessage)
  const applyAssistantReply = useSimulationStore((s) => s.applyAssistantReply)
  const resetAssistant = useSimulationStore((s) => s.resetAssistant)

  const [typing, setTyping] = useState(false)
  const [selected, setSelected] = useState<Product | null>(null)
  const timerRef = useRef<number>()

  const metrics = assistant.metrics
  const highlighted = context.lastProductIds

  const handleSend = (text: string) => {
    if (typing) return
    const message: AssistantMessage = {
      id: uid('msg'),
      role: 'customer',
      text,
      at: new Date().toISOString(),
    }
    sendAssistantMessage(message)
    setTyping(true)

    const reply = createAssistantReply({
      text,
      products,
      profile,
      context,
    })

    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      applyAssistantReply(reply)
      setTyping(false)
    }, 620)
  }

  const metricsTiles = useMemo(
    () => [
      {
        label: 'Conversaciones iniciadas',
        value: metrics.conversationsStarted,
        icon: <MessageSquare className="h-4 w-4" />,
        tone: 'brand' as const,
      },
      {
        label: 'Consultas resueltas',
        value: metrics.queriesResolved,
        icon: <BadgeCheck className="h-4 w-4" />,
        tone: 'mint' as const,
      },
      {
        label: 'Productos consultados',
        value: metrics.productsConsulted,
        icon: <ShoppingBag className="h-4 w-4" />,
        tone: 'neutral' as const,
      },
      {
        label: 'Productos recomendados',
        value: metrics.productsRecommended,
        icon: <Sparkles className="h-4 w-4" />,
        tone: 'violet' as const,
      },
      {
        label: 'Reservas simuladas',
        value: metrics.reservations,
        icon: <TicketCheck className="h-4 w-4" />,
        tone: 'amber' as const,
      },
      {
        label: 'Oportunidades de compra',
        value: metrics.purchaseOpportunities,
        icon: <TrendingUp className="h-4 w-4" />,
        tone: 'coral' as const,
      },
    ],
    [metrics],
  )

  return (
    <div className="space-y-5">
      <AnimatedContent>
        <SectionHeading
          eyebrow="Módulo 02 · Vendedor virtual"
          title="Sales Assistant"
          description="Probá cómo respondería el asistente de Rivect en WhatsApp: entiende categoría, color, talle y presupuesto, consulta el catálogo simulado y sugiere alternativas con stock."
          action={<Badge tone="amber" dot>Conversación simulada</Badge>}
        />
      </AnimatedContent>

      <AnimatedContent delay={0.05}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {metricsTiles.map((tile) => (
            <StatTile
              key={tile.label}
              label={tile.label}
              value={tile.value}
              icon={tile.icon}
              tone={tile.tone}
            />
          ))}
        </div>
      </AnimatedContent>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <AnimatedContent delay={0.1} className="min-w-0">
          <ChatPanel
            messages={assistant.messages}
            products={products}
            typing={typing}
            disabled={typing}
            onSend={handleSend}
            onReset={resetAssistant}
            onSelectProduct={setSelected}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <Users className="h-3.5 w-3.5" />
            Probá: «zapatillas negras talle 42», «¿tienen botines marrones?», «algo más económico» o
            «quiero reservar». Precio promedio de ticket: {money(profile.averageTicket)}.
          </div>
        </AnimatedContent>

        <AnimatedContent delay={0.15} className="min-w-0">
          <CatalogPanel
            products={products}
            highlighted={highlighted}
            onSelect={setSelected}
          />
        </AnimatedContent>
      </div>

      <ProductDetailModal product={selected} onClose={() => setSelected(null)} />

      <div className="panel panel-pad">
        <h2 className="font-display text-sm font-semibold text-white">Cómo interpreta la conversación</h2>
        <div className="mt-3 grid gap-3 text-[11px] leading-relaxed text-slate-500 sm:grid-cols-3">
          <div className="rounded-xl border border-line bg-ink-900/50 p-3">
            <p className="font-medium text-slate-300">1 · Detección de intención</p>
            Reglas de demostración identifican búsqueda, precio, colores, talles, alternativas,
            recomendación y reserva.
          </div>
          <div className="rounded-xl border border-line bg-ink-900/50 p-3">
            <p className="font-medium text-slate-300">2 · Consulta al catálogo</p>
            El motor puntúa productos por categoría, color, talle y rotación, y verifica stock por
            variante.
          </div>
          <div className="rounded-xl border border-line bg-ink-900/50 p-3">
            <p className="font-medium text-slate-300">3 · Respuesta comercial</p>
            Presenta alternativas disponibles, propone complementos y ofrece una reserva simulada con
            trazabilidad en las métricas.
          </div>
        </div>
        <p className="mt-3 text-[10px] text-slate-600">
          {num(products.length)} productos en catálogo · motor determinístico local · sin IA externa
          ni credenciales.
        </p>
      </div>
    </div>
  )
}
