import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="login-shell">
        <div className="login-card card card-pad muted">Comprobando sesión…</div>
      </div>
    )
  }

  if (status?.auth_required && !status.authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}