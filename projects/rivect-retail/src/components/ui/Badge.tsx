import type { ReactNode } from 'react'
import { cn } from '@/utils/format'

export type Tone = 'brand' | 'mint' | 'amber' | 'coral' | 'neutral' | 'violet'

const tones: Record<Tone, string> = {
  brand: 'border-brand-500/30 bg-brand-500/10 text-brand-300',
  mint: 'border-mint-500/30 bg-mint-500/10 text-mint-400',
  amber: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  coral: 'border-coral-500/30 bg-coral-500/10 text-coral-400',
  neutral: 'border-line bg-ink-800/80 text-slate-400',
  violet: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
}

export function Badge({
  children,
  tone = 'neutral',
  className,
  dot = false,
}: {
  children: ReactNode
  tone?: Tone
  className?: string
  dot?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
        tones[tone],
        className,
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  )
}

const statusTones: Record<string, Tone> = {
  'consulta-nueva': 'brand',
  interesado: 'mint',
  'pendiente-respuesta': 'amber',
  'seguimiento-pendiente': 'amber',
  recuperado: 'violet',
  'compra-realizada': 'mint',
  'no-interesado': 'neutral',
}

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <Badge tone={statusTones[status] ?? 'neutral'} dot>
      {label}
    </Badge>
  )
}
