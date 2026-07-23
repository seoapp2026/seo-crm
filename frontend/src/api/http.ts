export async function parseApiError(res: Response): Promise<string> {
  try {
    const body = await res.json()
    if (typeof body?.detail === 'string') return body.detail
    if (Array.isArray(body?.detail)) {
      return body.detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join(', ') || res.statusText
    }
  } catch {
    /* ignore */
  }
  return res.statusText || 'Error del servidor'
}

export function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
}