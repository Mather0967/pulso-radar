import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/utils/format'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg' | 'icon'

const variants: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-brand-600 via-brand-500 to-brand-600 bg-[length:200%_auto] text-white shadow-[0_10px_28px_-10px_rgba(47,116,255,0.7),inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-right hover:shadow-[0_14px_36px_-10px_rgba(47,116,255,0.9)] active:scale-[0.98]',
  secondary:
    'border border-line/90 bg-gradient-to-b from-ink-800/90 to-ink-850/95 text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_2px_8px_rgba(0,0,0,0.3)] hover:border-brand-500/50 hover:text-white active:scale-[0.98]',
  ghost: 'text-slate-400 hover:bg-ink-800/80 hover:text-white active:scale-[0.98]',
  danger:
    'border border-coral-400/30 bg-coral-500/10 text-coral-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:border-coral-400/60 hover:bg-coral-500/20 active:scale-[0.98]',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-sm gap-2 rounded-xl',
  icon: 'h-9 w-9 rounded-lg',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex select-none items-center justify-center font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
)

Button.displayName = 'Button'
