import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { APP, ROUTES } from '../constants'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function Layout() {
  const { topbarAction } = useApp()
  const { status, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const routeId = location.pathname.replace(/^\//, '').split('/')[0] || 'dashboard'
  const routeMeta = ROUTES.find((r) => 'id' in r && r.id === routeId) as { crumb?: string; sub?: string } | undefined
  const isKnown = Boolean(routeMeta)

  useDocumentTitle(isKnown ? routeMeta!.crumb : 'Página no encontrada')

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h1>{APP.name}</h1>
          <span>{APP.tagline}</span>
        </div>
        <nav className="nav">
          {ROUTES.map((r, i) =>
            'group' in r ? (
              <div key={i} className="nav-group-label">{r.group}</div>
            ) : (
              <NavLink key={r.id} to={`/${r.id}`} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <span>{r.label}</span>
              </NavLink>
            ),
          )}
        </nav>
        <div className="sidebar-foot">
          Datos · Integraciones · IA<br />
          GSC · GA4 · Sincronización
          <div className="sidebar-legal">
            <NavLink to="/privacy">Privacy</NavLink>
            {' · '}
            <NavLink to="/terms">Terms</NavLink>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div>
            <div className="crumb">{isKnown ? routeMeta!.crumb : 'No encontrado'}</div>
            <div className="crumb-sub">{isKnown ? routeMeta!.sub : 'La página que buscas no existe'}</div>
          </div>
          <div className="topbar-actions">
            {status?.auth_required && status.email && (
              <span className="topbar-user muted">{status.email}</span>
            )}
            {status?.auth_required && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={async () => {
                  await logout()
                  navigate('/login', { replace: true })
                }}
              >
                Sign out
              </button>
            )}
            {topbarAction}
          </div>
        </header>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}