import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { phase2Api } from '../api/phase2-client'
import { Badge } from '../components/Badge'
import { ScopeBar } from '../components/ScopeBar'
import { NICHE_STATES, PAGE_STATES } from '../constants'
import { useApp } from '../context/AppContext'
import { useProjects } from '../hooks/useProjects'
import type { DashboardStats } from '../types'
import type { PerformanceSummary } from '../types/phase2'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function DashboardPage() {
  const { scopeProject, setScopeProject } = useApp()
  const { projects } = useProjects()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [perf, setPerf] = useState<PerformanceSummary | null>(null)

  useEffect(() => {
    api.dashboard(scopeProject).then(setStats).catch(() => setStats(null))
    phase2Api.performance.summary(scopeProject).then(setPerf).catch(() => setPerf(null))
  }, [scopeProject])

  if (!stats) return <p className="muted">Cargando panel...</p>

  const maxN = Math.max(1, ...stats.niche_by_state.map((x) => x.count))

  return (
    <>
      <ScopeBar projects={projects} value={scopeProject} onChange={setScopeProject} />

      <div className="dash-help-card">
        <div>
          <h2>¿Cómo se usa este CRM?</h2>
          <p>
            Proyecto → nicho → página → keywords. Luego Google (OAuth + sync), IA supervisada y export a WordPress.
            Option 2: <Link to="/research">Análisis SEO</Link> (caps de coste) y{' '}
            <Link to="/products">Productos</Link> (hechos reales para IA).
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to="/research" className="btn btn-primary">
            Análisis SEO
          </Link>
          <Link to="/help" className="btn">
            Ayuda / guía
          </Link>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 22 }}>
        {[
          ['Proyectos', stats.projects],
          ['Nichos', stats.niches],
          ['Páginas', stats.pages],
          ['Keywords', stats.keywords],
        ].map(([label, value]) => (
          <div key={label as string} className="stat">
            <div className="stat-label">{label as string}</div>
            <div className="stat-value">{value as number}</div>
          </div>
        ))}
      </div>

      {perf && perf.pages.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 22 }}>
          <div className="section-head">
            <h2>Rendimiento (28 días)</h2>
            <Link to="/performance" className="dash-phase2-link">Ver panel completo →</Link>
          </div>
          <div className="grid grid-4">
            <div><span className="muted">Clicks GSC</span><div style={{ fontSize: 22, fontWeight: 700 }}>{perf.total_clicks_28d.toLocaleString('es-ES')}</div></div>
            <div><span className="muted">Ganadoras</span><div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-ink)' }}>{perf.winning}</div></div>
            <div><span className="muted">En caída</span><div style={{ fontSize: 22, fontWeight: 700, color: 'var(--warn)' }}>{perf.declining}</div></div>
            <div><span className="muted">Necesitan trabajo</span><div style={{ fontSize: 22, fontWeight: 700, color: '#2c5d86' }}>{perf.needs_work}</div></div>
          </div>
        </div>
      )}

      <div className="grid grid-2" style={{ marginBottom: 22 }}>
        <div className="card card-pad">
          <div className="section-head"><h2>Nichos por estado</h2></div>
          {stats.niche_by_state.map((s) => (
            <div key={s.state} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>{NICHE_STATES[s.state]?.label || s.state}</span>
                <span className="muted">{s.count}</span>
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(s.count / maxN) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="card card-pad">
          <div className="section-head"><h2>Alertas SEO</h2></div>
          <p style={{ marginBottom: 8 }}>
            <strong>{stats.orphan_pages.length}</strong> páginas huérfanas (sin enlaces entrantes)
          </p>
          <p>
            <strong>{stats.cannibalized_terms.length}</strong> términos en canibalización
            {stats.cannibalized_terms.length > 0 && (
              <span className="muted"> — {stats.cannibalized_terms.join(', ')}</span>
            )}
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-pad section-head"><h2>Páginas recientes</h2></div>
        <table>
          <thead>
            <tr><th>Título</th><th>Tipo</th><th>Estado</th><th>Fecha</th></tr>
          </thead>
          <tbody>
            {stats.recent_pages.map((p) => (
              <tr key={p.id}>
                <td className="t-title">{p.title}</td>
                <td><span className={`pill-type pt-${p.type}`}>{p.type}</span></td>
                <td><Badge label={PAGE_STATES[p.state].label} cls={PAGE_STATES[p.state].cls} /></td>
                <td className="muted">{fmtDate(p.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}