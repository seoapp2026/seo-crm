import { Link, useLocation } from 'react-router-dom'
import { APP } from '../constants'

export function NotFoundPage() {
  const { pathname } = useLocation()

  return (
    <div className="not-found">
      <div className="not-found-code">404</div>
      <h1>Página no encontrada</h1>
      <p className="muted">
        No existe ninguna ruta para <code className="mono">{pathname}</code> en {APP.name}.
      </p>
      <div className="not-found-actions">
        <Link to="/" className="btn btn-ghost">Home</Link>
        <Link to="/dashboard" className="btn btn-primary">Ir al panel</Link>
        <Link to="/projects" className="btn">Ver proyectos</Link>
      </div>
    </div>
  )
}