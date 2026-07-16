import { Link, Outlet } from 'react-router-dom'
import { APP } from '../constants'

export function LegalLayout() {
  return (
    <div className="legal-shell">
      <header className="legal-header">
        <Link to="/" className="legal-brand">
          <img src="/logo-120.png" alt="" width={36} height={36} className="legal-logo" />
          <div>
            <strong>{APP.name}</strong>
            <span>{APP.tagline}</span>
          </div>
        </Link>
        <nav className="legal-nav">
          <Link to="/">Home</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Service</Link>
          <Link to="/dashboard">Open app</Link>
        </nav>
      </header>
      <main className="legal-main">
        <Outlet />
      </main>
      <footer className="legal-footer">
        <span>© {new Date().getFullYear()} SEO CRM · Nigeria</span>
        <span>
          Contact:{' '}
          <a href="mailto:seo.app2026@gmail.com">seo.app2026@gmail.com</a>
        </span>
      </footer>
    </div>
  )
}
