import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ROUTES } from '../constants'
import { useApp } from '../context/AppContext'

export function Layout() {
  const { topbarAction } = useApp()
  const location = useLocation()
  const routeId = location.pathname.replace(/^\//, '').split('/')[0] || 'dashboard'
  const routeMeta = ROUTES.find((r) => 'id' in r && r.id === routeId) as { crumb?: string; sub?: string } | undefined
  const isKnown = Boolean(routeMeta)

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h1>CRM SEO</h1>
          <span>Gestión de Nichos</span>
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
          Fase 2 · Datos + IA<br />
          GSC · GA4 · Sync · Asistentes
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div>
            <div className="crumb">{isKnown ? routeMeta!.crumb : 'No encontrado'}</div>
            <div className="crumb-sub">{isKnown ? routeMeta!.sub : 'La página que buscas no existe'}</div>
          </div>
          <div>{topbarAction}</div>
        </header>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}