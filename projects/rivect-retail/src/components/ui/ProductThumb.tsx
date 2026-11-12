import { Backpack, Footprints, Shirt, Sparkles, Watch } from 'lucide-react'
import { cn } from '@/utils/format'

const CATEGORY_STYLES: Record<string, { gradient: string; icon: typeof Footprints }> = {
  Zapatillas: {
    gradient: 'from-brand-500/30 via-brand-700/20 to-ink-900',
    icon: Footprints,
  },
  Botines: { gradient: 'from-amber-500/25 via-ink-700/40 to-ink-900', icon: Footprints },
  Sandalias: { gradient: 'from-mint-500/20 via-ink-700/40 to-ink-900', icon: Footprints },
  Zapatos: { gradient: 'from-violet-500/25 via-ink-700/40 to-ink-900', icon: Footprints },
  Accesorios: { gradient: 'from-sky-500/20 via-ink-700/40 to-ink-900', icon: Backpack },
  Indumentaria: { gradient: 'from-rose-500/20 via-ink-700/40 to-ink-900', icon: Shirt },
}

export function ProductThumb({
  category,
  name,
  className,
  size = 'md',
}: {
  category: string
  name: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const style = CATEGORY_STYLES[category] ?? {
    gradient: 'from-brand-500/20 via-ink-700/40 to-ink-900',
    icon: Sparkles,
  }
  const Icon = style.icon
  const dimensions = size === 'sm' ? 'h-10 w-10 rounded-lg' : size === 'lg' ? 'h-24 w-24 rounded-2xl' : 'h-14 w-14 rounded-xl'
  const iconSize = size === 'sm' ? 'h-5 w-5' : size === 'lg' ? 'h-9 w-9' : 'h-6 w-6'

  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden border border-line/80 bg-gradient-to-br',
        style.gradient,
        dimensions,
        className,
      )}
      title={name}
    >
      <div className="absolute inset-0 opacity-[0.12] grid-bg" />
      <Icon className={cn('relative text-white/80', iconSize)} strokeWidth={1.4} />
    </div>
  )
}

export function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const style = CATEGORY_STYLES[category] ?? { icon: Watch }
  const Icon = style.icon
  return <Icon className={className} />
}
