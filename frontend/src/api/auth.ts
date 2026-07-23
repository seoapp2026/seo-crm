import { API_BASE } from './base'
import { apiFetch, parseApiError } from './http'

export interface AuthStatus {
  authenticated: boolean
  email: string | null
  auth_required: boolean
}

export const authApi = {
  me: async (): Promise<AuthStatus> => {
    const res = await apiFetch(`${API_BASE}/auth/me`)
    if (!res.ok) {
      return { authenticated: false, email: null, auth_required: true }
    }
    return res.json()
  },
  login: async (email: string, password: string): Promise<AuthStatus> => {
    const res = await apiFetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) throw new Error(await parseApiError(res))
    return res.json()
  },
  logout: async (): Promise<void> => {
    const res = await apiFetch(`${API_BASE}/auth/logout`, { method: 'POST' })
    if (!res.ok) throw new Error(await parseApiError(res))
  },
}