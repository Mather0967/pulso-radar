import { useState } from 'react'
import {
  clampProfileField,
  PROFILE_LIMITS,
  type LimitedProfileField,
} from '@/domain/calculations/simulator'

/**
 * Conecta un NumberField con los límites del simulador: el valor fuera de rango
 * se ajusta y queda un mensaje visible bajo el campo hasta el próximo cambio.
 */
export function useFieldLimits() {
  const [messages, setMessages] = useState<Partial<Record<string, string>>>({})

  const bind = (
    field: LimitedProfileField,
    onValue: (value: number) => void,
    key: string = field,
  ) => ({
    min: PROFILE_LIMITS[field].min,
    max: PROFILE_LIMITS[field].max,
    clamp: false,
    error: messages[key],
    onChange: (raw: number) => {
      const { value, message } = clampProfileField(field, raw)
      setMessages((current) => ({ ...current, [key]: message }))
      onValue(value)
    },
  })

  return { bind }
}
