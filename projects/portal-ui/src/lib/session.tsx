import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError, api, setCsrf } from '@/lib/api'
import type { User } from '@/lib/types'

type MeResponse = { user: User; csrf: string }

export type SessionValue = {
  user: User
  csrf: string
  isAdmin: boolean
  /** Vuelve a leer GET /auth/me. Lanza error si falla. */
  refresh: () => Promise<void>
}

const SessionContext = createContext<SessionValue | null>(null)

function SessionSkeleton() {
  return (
    <div role="status" aria-label="Cargando" className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6">
      <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
      <div className="h-4 w-40 animate-pulse rounded-sm bg-muted" />
    </div>
  )
}

function SessionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <p role="alert" className="max-w-sm text-sm text-muted-foreground">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex h-11 items-center rounded-sm border border-input px-4 text-sm font-medium text-foreground hover:bg-accent md:h-9"
      >
        Reintentar
      </button>
    </div>
  )
}

/** Carga la sesión (GET /auth/me) antes de renderizar cualquier ruta. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchMe = useCallback(async () => {
    const data = await api<MeResponse>('/auth/me')
    setCsrf(data.csrf)
    setMe(data)
  }, [])

  const load = useCallback(() => {
    setError(null)
    fetchMe().catch((err: unknown) => {
      // 401: api() ya redirigió a /login; no mostramos nada más.
      if (err instanceof ApiError && err.status === 401) return
      setError(err instanceof Error ? err.message : 'No pudimos cargar tu sesión.')
    })
  }, [fetchMe])

  useEffect(() => {
    load()
  }, [load])

  const value = useMemo<SessionValue | null>(() => {
    if (!me) return null
    return {
      user: me.user,
      csrf: me.csrf,
      isAdmin: me.user.role === 'admin',
      refresh: fetchMe,
    }
  }, [me, fetchMe])

  if (!value) {
    return error ? <SessionError message={error} onRetry={load} /> : <SessionSkeleton />
  }

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession debe usarse dentro de <SessionProvider>.')
  return ctx
}
