import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { APP } from '../constants'
import { useAuth } from '../context/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function LoginPage() {
  useDocumentTitle('Iniciar sesión')
  const { status, loading, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const redirectTo = (location.state as { from?: string } | null)?.from || '/dashboard'

  if (!loading && status?.authenticated) {
    return <Navigate to={redirectTo} replace />
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email.trim(), password)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card card card-pad">
        <Link to="/" className="login-brand">
          <img src="/logo-120.png" alt="" width="36" height="36" className="legal-logo" />
          <div>
            <strong>{APP.name}</strong>
            <span>Acceso interno autorizado</span>
          </div>
        </Link>

        <h1 style={{ fontSize: 22, margin: '18px 0 8px' }}>Iniciar sesión</h1>
        <p className="muted" style={{ marginBottom: 18 }}>
          Solo usuarios autorizados pueden acceder al panel y a las integraciones Google.
        </p>

        <form onSubmit={onSubmit} className="login-form">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="sync-error">{error}</div>}
          <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: '100%' }}>
            {submitting ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>
          <Link to="/">Volver al inicio</Link>
        </p>
      </div>
    </div>
  )
}