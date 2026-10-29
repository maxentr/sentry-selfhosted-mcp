export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public responseBody: unknown,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

/** Says what failed and what to fix, with Sentry's own `detail` when it sends one. */
export function errorMessage(method: string, path: string, status: number, body: unknown): string {
  const detail =
    body && typeof body === "object" && "detail" in body ? String(body.detail) : undefined
  const where = `${method} ${path}`
  const hint =
    status === 401
      ? "Auth token invalid or expired: check SENTRY_AUTH_TOKEN."
      : status === 403
        ? "Token lacks a scope for this call (issue:write and comment:write for updates and comments)."
        : status === 404
          ? "Not found: check the ID, short ID, project slug or org slug."
          : status === 429
            ? "Rate limited by Sentry: wait and retry."
            : `Sentry API error ${status}.`
  return [`${hint} (${where})`, detail].filter(Boolean).join(" — ")
}

export class ApiClient {
  private baseUrl: string
  private headers: Record<string, string>
  private timeout: number

  constructor(baseUrl: string, authToken: string, timeout = 20000) {
    this.baseUrl = `${baseUrl}/api/0/`
    this.headers = {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    }
    this.timeout = timeout
  }

  async get<T = unknown>(path: string, params?: Record<string, string | number>): Promise<T> {
    return this.request<T>("GET", path, params)
  }

  async put<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", path, undefined, body)
  }

  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, undefined, body)
  }

  private async request<T>(
    method: string,
    path: string,
    params?: Record<string, string | number>,
    body?: unknown,
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`

    if (params) {
      const searchParams = new URLSearchParams()
      for (const [key, value] of Object.entries(params)) {
        searchParams.set(key, String(value))
      }
      url += `?${searchParams.toString()}`
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url, {
        method,
        headers: this.headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })

      if (!response.ok) {
        const responseBody = await response.json().catch(() => response.statusText)
        throw new ApiError(
          errorMessage(method, path, response.status, responseBody),
          response.status,
          responseBody,
        )
      }

      return (await response.json()) as T
    } catch (error) {
      if (error instanceof ApiError) throw error
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error(`Sentry API request timed out after ${this.timeout}ms`)
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }
}
