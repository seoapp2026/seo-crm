import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authApi, type AuthStatus } from '../api/auth'

interface AuthContextValue {
  status: AuthStatus | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const next = await authApi.me()
    setStatus(next)
  }, [])

  useEffect(() => {
    void refresh().finally(() => setLoading(false))
  }, [refresh])

  const login = useCallback(async (email: string, password: string) => {
    const next = await authApi.login(email, password)
    setStatus(next)
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout()
    setStatus({ authenticated: false, email: null, auth_required: status?.auth_required ?? true })
  }, [status?.auth_required])

  const value = useMemo(
    () => ({ status, loading, login, logout, refresh }),
    [status, loading, login, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}