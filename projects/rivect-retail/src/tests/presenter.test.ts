import { describe, expect, it } from 'vitest'
import { advance, type PresenterState } from '@/presentation/usePresenter'
import { scenes } from '@/presentation/scenes'

describe('scenes', () => {
  it('tiene 7 escenas con n 1..7 y slugs únicos', () => {
    expect(scenes).toHaveLength(7)
    expect(scenes.map((s) => s.n)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(new Set(scenes.map((s) => s.slug)).size).toBe(7)
  })

  it('cada escena tiene al menos 2 pasos y textos no vacíos', () => {
    for (const s of scenes) {
      expect(s.steps.length).toBeGreaterThanOrEqual(2)
      expect(s.label.length).toBeGreaterThan(0)
      expect(s.title.length).toBeGreaterThan(0)
      expect(s.tagline.length).toBeGreaterThan(0)
      expect(s.notes.length).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('advance', () => {
  it('avanza dentro de la escena y luego a la siguiente escena en paso 0', () => {
    const first = scenes[0]
    let state: PresenterState = { scene: 1, step: 0 }
    for (let i = 1; i < first.steps.length; i++) {
      state = advance(state, 1)
      expect(state).toEqual({ scene: 1, step: i })
    }
    state = advance(state, 1)
    expect(state).toEqual({ scene: 2, step: 0 })
  })

  it('retrocede desde el paso 0 a la última escena anterior', () => {
    const prevScene = scenes[1]
    expect(advance({ scene: 3, step: 0 }, -1)).toEqual({
      scene: 2,
      step: prevScene.steps.length - 1,
    })
  })

  it('recorre todo hacia adelante y vuelve al inicio hacia atrás', () => {
    const total = scenes.reduce((acc, s) => acc + s.steps.length, 0)
    let state: PresenterState = { scene: 1, step: 0 }
    for (let i = 0; i < total - 1; i++) state = advance(state, 1)
    expect(state).toEqual({ scene: 7, step: scenes[6].steps.length - 1 })

    for (let i = 0; i < total - 1; i++) state = advance(state, -1)
    expect(state).toEqual({ scene: 1, step: 0 })
  })

  it('se queda clavado en el primer paso de la primera escena', () => {
    expect(advance({ scene: 1, step: 0 }, -1)).toEqual({ scene: 1, step: 0 })
  })

  it('se queda clavado en el último paso de la última escena', () => {
    const last = scenes[6].steps.length - 1
    expect(advance({ scene: 7, step: last }, 1)).toEqual({ scene: 7, step: last })
  })
})
