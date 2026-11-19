// Cliente HTTP del portal: mismo origen, JSON, CSRF en escrituras.

export class ApiError extends Error {
  status: number
  data: any

  constructor(message: string, status: number, data: any = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

let csrfToken = ''

/** Guarda el token CSRF de la sesión (se envía como x-csrf-token en toda escritura). */
export function setCsrf(t: string): void {
  csrfToken = t
}

const WRITE_SAFE = new Set(['GET', 'HEAD'])

export async function api<T = any>(
  path: string,
  opts: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const method = (opts.method ?? 'GET').toUpperCase()
  const headers: Record<string, string> = { Accept: 'application/json' }
  let body: string | undefined
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.body)
  }
  if (!WRITE_SAFE.has(method)) headers['x-csrf-token'] = csrfToken

  let res: Response
  try {
    res = await fetch(path, {
      method,
      headers,
      body,
      credentials: 'same-origin',
      signal: opts.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiError('Sin conexión. Revisá tu red.', 0, null)
  }

  const text = await res.text()
  let data: any = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  if (res.status === 401) {
    window.location.assign('/login')
    throw new ApiError(
      typeof data?.error === 'string' ? data.error : 'Iniciá sesión para continuar.',
      401,
      data,
    )
  }

  if (!res.ok) {
    const message =
      typeof data?.error === 'string' && data.error ? data.error : `Algo salió mal (${res.status}). Probá de nuevo.`
    throw new ApiError(message, res.status, data)
  }

  return data as T
}
