import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { scenes, type Scene } from './scenes'

export interface PresenterState {
  scene: number
  step: number
}

function sceneIndex(list: Scene[], n: number): number {
  const idx = list.findIndex((s) => s.n === n)
  return idx === -1 ? 0 : idx
}

// Avanza o retrocede un paso. Puro: no toca el DOM ni la navegación.
export function advance(state: PresenterState, dir: 1 | -1, list = scenes): PresenterState {
  const si = sceneIndex(list, state.scene)
  const scene = list[si]
  const last = scene.steps.length - 1
  const step = Math.min(Math.max(state.step, 0), last)

  if (dir === 1) {
    if (step < last) return { scene: scene.n, step: step + 1 }
    if (si + 1 < list.length) return { scene: list[si + 1].n, step: 0 }
    return { scene: scene.n, step: last }
  }

  if (step > 0) return { scene: scene.n, step: step - 1 }
  if (si - 1 >= 0) {
    const prev = list[si - 1]
    return { scene: prev.n, step: prev.steps.length - 1 }
  }
  return { scene: scene.n, step: 0 }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as HTMLElement).tagName !== 'string') return false
  const el = target as HTMLElement
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true
}

function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      if (typeof document.exitFullscreen === 'function') {
        void document.exitFullscreen().catch(() => {})
      }
    } else if (typeof document.documentElement.requestFullscreen === 'function') {
      void document.documentElement.requestFullscreen().catch(() => {})
    }
  } catch {
    // Fullscreen no disponible (iframe, navegador sin soporte): se ignora.
  }
}

const MIN_SCENE = 1

export function usePresenter(): {
  scene: Scene
  step: number
  next(): void
  prev(): void
  goTo(n: number): void
  notesOpen: boolean
  toggleNotes(): void
  feedOpen: boolean
  toggleFeed(): void
  exitToExplore(): void
} {
  const params = useParams<{ n: string }>()
  const navigate = useNavigate()

  const rawN = Number(params.n)
  const valid = Number.isInteger(rawN) && rawN >= MIN_SCENE && rawN <= scenes.length
  const n = valid ? rawN : MIN_SCENE
  const scene = scenes[n - 1]

  const [step, setStep] = useState(0)
  const [notesOpen, setNotesOpen] = useState(false)
  const [feedOpen, setFeedOpen] = useState(true)

  // Paso que hay que aplicar cuando cambie la escena por navegación propia.
  const pendingStep = useRef<number | null>(null)

  useEffect(() => {
    if (!valid) {
      navigate(`/escena/${MIN_SCENE}`, { replace: true })
    }
  }, [valid, navigate])

  useEffect(() => {
    const target = pendingStep.current ?? 0
    pendingStep.current = null
    setStep(target)
  }, [n])

  const commit = useCallback(
    (next: PresenterState) => {
      if (next.scene !== n) {
        pendingStep.current = next.step
        navigate(`/escena/${next.scene}`)
      }
      setStep(next.step)
    },
    [n, navigate],
  )

  const next = useCallback(() => commit(advance({ scene: n, step }, 1)), [commit, n, step])
  const prev = useCallback(() => commit(advance({ scene: n, step }, -1)), [commit, n, step])

  const goTo = useCallback(
    (target: number) => {
      if (!Number.isInteger(target) || target < MIN_SCENE || target > scenes.length) return
      if (target === n) return
      commit({ scene: target, step: 0 })
    },
    [commit, n],
  )

  const toggleNotes = useCallback(() => setNotesOpen((v) => !v), [])
  const toggleFeed = useCallback(() => setFeedOpen((v) => !v), [])
  const exitToExplore = useCallback(() => navigate('/overview'), [navigate])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (isTypingTarget(e.target)) return

      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          e.preventDefault()
          next()
          return
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault()
          prev()
          return
        case 'f':
        case 'F':
          toggleFullscreen()
          return
        case 'n':
        case 'N':
          toggleNotes()
          return
        case 'l':
        case 'L':
          toggleFeed()
          return
        case 'Escape':
          exitToExplore()
          return
        default:
          if (/^[1-7]$/.test(e.key)) goTo(Number(e.key))
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [next, prev, goTo, toggleNotes, toggleFeed, exitToExplore])

  const safeStep = Math.min(Math.max(step, 0), scene.steps.length - 1)

  return {
    scene,
    step: safeStep,
    next,
    prev,
    goTo,
    notesOpen,
    toggleNotes,
    feedOpen,
    toggleFeed,
    exitToExplore,
  }
}
