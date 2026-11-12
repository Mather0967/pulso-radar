import type { ReactNode } from 'react'
import { cn } from '@/utils/format'

interface BaseProps {
  label: string
  hint?: ReactNode
  error?: string
  className?: string
}

export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  suffix,
  prefix,
  hint,
  error,
  className,
  disabled,
}: BaseProps & {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  prefix?: string
  disabled?: boolean
}) {
  return (
    <label className={cn('block', className)}>
      <span className="field-label">{label}</span>
      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[11px] font-medium text-slate-500">
            {prefix}
          </span>
        ) : null}
        <input
          type="number"
          className={cn('input', prefix ? 'pl-7' : '', suffix ? 'pr-12' : '', error && 'input-error')}
          value={Number.isFinite(value) ? value : ''}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(event) => {
            const next = event.target.value === '' ? 0 : Number(event.target.value)
            if (Number.isNaN(next)) return
            const clamped = Math.min(max ?? Number.MAX_SAFE_INTEGER, Math.max(min, next))
            onChange(clamped)
          }}
        />
        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[11px] font-medium text-slate-500">
            {suffix}
          </span>
        ) : null}
      </div>
      {error ? (
        <span className="mt-1 block text-[11px] text-coral-400">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[11px] text-slate-600">{hint}</span>
      ) : null}
    </label>
  )
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  error,
  className,
}: BaseProps & {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <label className={cn('block', className)}>
      <span className="field-label">{label}</span>
      <input
        className={cn('input', error && 'input-error')}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? (
        <span className="mt-1 block text-[11px] text-coral-400">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[11px] text-slate-600">{hint}</span>
      ) : null}
    </label>
  )
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  hint,
  className,
}: BaseProps & {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className={cn('block', className)}>
      <span className="field-label">{label}</span>
      <select className="input appearance-none" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-ink-900">
            {option.label}
          </option>
        ))}
      </select>
      {hint ? <span className="mt-1 block text-[11px] text-slate-600">{hint}</span> : null}
    </label>
  )
}

export function RangeField({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  suffix = '%',
  hint,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  suffix?: string
  hint?: ReactNode
}) {
  const progress = max > min ? ((value - min) / (max - min)) * 100 : 0
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="field-label mb-0">{label}</span>
        <span className="font-display text-sm font-semibold text-white">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-700 accent-brand-500"
        style={{
          background: `linear-gradient(90deg, #2f74ff ${progress}%, #111a2e ${progress}%)`,
        }}
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {hint ? <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600">{hint}</p> : null}
    </div>
  )
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-3 text-sm text-slate-300"
    >
      <span>{label}</span>
      <span
        className={cn(
          'relative h-5 w-9 rounded-full transition-colors',
          checked ? 'bg-brand-500' : 'bg-ink-600',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5',
          )}
        />
      </span>
    </button>
  )
}
