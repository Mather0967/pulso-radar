import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSpotlight } from './useSpotlight'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function Probe() {
  const ref = useSpotlight<HTMLDivElement>()
  return createElement('div', { ref, 'data-testid': 'probe' })
}

function stubMatchMedia(matching: string[]) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: matching.includes(query),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

describe('useSpotlight', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    // requestAnimationFrame síncrono para que el test no dependa de timers.
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.restoreAllMocks()
  })

  it('fija --mx y --my relativos al elemento en pointermove', () => {
    stubMatchMedia([])
    act(() => root.render(createElement(Probe)))
    const el = container.querySelector<HTMLElement>('[data-testid="probe"]')!
    el.dispatchEvent(new MouseEvent('pointermove', { clientX: 30, clientY: 40 }))
    expect(el.style.getPropertyValue('--mx')).toBe('30px')
    expect(el.style.getPropertyValue('--my')).toBe('40px')
  })

  it('quita las variables al salir el puntero', () => {
    stubMatchMedia([])
    act(() => root.render(createElement(Probe)))
    const el = container.querySelector<HTMLElement>('[data-testid="probe"]')!
    el.dispatchEvent(new MouseEvent('pointermove', { clientX: 5, clientY: 6 }))
    el.dispatchEvent(new MouseEvent('pointerleave'))
    expect(el.style.getPropertyValue('--mx')).toBe('')
    expect(el.style.getPropertyValue('--my')).toBe('')
  })

  it('no hace nada con (hover: none)', () => {
    stubMatchMedia(['(hover: none)'])
    act(() => root.render(createElement(Probe)))
    const el = container.querySelector<HTMLElement>('[data-testid="probe"]')!
    el.dispatchEvent(new MouseEvent('pointermove', { clientX: 30, clientY: 40 }))
    expect(el.style.getPropertyValue('--mx')).toBe('')
  })

  it('no hace nada con movimiento reducido', () => {
    stubMatchMedia(['(prefers-reduced-motion: reduce)'])
    act(() => root.render(createElement(Probe)))
    const el = container.querySelector<HTMLElement>('[data-testid="probe"]')!
    el.dispatchEvent(new MouseEvent('pointermove', { clientX: 30, clientY: 40 }))
    expect(el.style.getPropertyValue('--mx')).toBe('')
  })
})
