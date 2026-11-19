import { useEffect, useRef, type RefObject } from 'react'

/**
 * Foco que sigue el cursor: fija --mx / --my (px relativos al elemento) en pointermove.
 * Con (hover: none) o movimiento reducido no hace nada. Limpia listeners al desmontar.
 */
export function useSpotlight<T extends HTMLElement = HTMLElement>(): RefObject<T> {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    if (window.matchMedia('(hover: none)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    let frame = 0
    let pending: { x: number; y: number } | null = null

    const flush = () => {
      frame = 0
      if (!pending) return
      el.style.setProperty('--mx', `${pending.x}px`)
      el.style.setProperty('--my', `${pending.y}px`)
    }

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      pending = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      if (!frame) frame = window.requestAnimationFrame(flush)
    }

    const onLeave = () => {
      if (frame) window.cancelAnimationFrame(frame)
      frame = 0
      pending = null
      el.style.removeProperty('--mx')
      el.style.removeProperty('--my')
    }

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return ref
}
