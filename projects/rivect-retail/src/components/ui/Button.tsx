import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/utils/format'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg' | 'icon'

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-500 text-white shadow-[0_14px_30px_-14px_rgba(47,116,255,0.9)] hover:bg-brand-400 active:bg-brand-600',
  secondary:
    'border border-line bg-ink-800/80 text-slate-200 hover:border-brand-500/50 hover:text-white',
  ghost: 'text-slate-400 hover:bg-ink-800 hover:text-white',
  danger:
    'border border-coral-400/30 bg-coral-500/10 text-coral-400 hover:border-coral-400/60 hover:bg-coral-500/20',
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
