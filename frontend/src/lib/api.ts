/** Shape of the backend's RFC 9457 error body (see GlobalExceptionHandler). */
export interface ProblemDetail {
  title?: string
  status?: number
  detail?: string
  /** Per-field validation messages, present on 400 responses. */
  errors?: Record<string, string>
}

export class ApiError extends Error {
  readonly status: number
  readonly problem?: ProblemDetail

  constructor(status: number, problem?: ProblemDetail) {
    super(problem?.detail ?? problem?.title ?? `Request failed (${status})`)
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
  }
}

/**
 * Thin typed wrapper around fetch for the backend API. Paths are relative to /api,
 * which Vite (dev) and nginx (Docker) both forward to Spring Boot, so no base URL or CORS is involved.
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })

  if (!response.ok) {
    const problem = await response.json().catch(() => undefined)
    throw new ApiError(response.status, problem as ProblemDetail | undefined)
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T)
}
