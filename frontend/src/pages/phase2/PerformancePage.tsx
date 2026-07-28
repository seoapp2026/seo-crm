import { useEffect, useState } from 'react'
import { phase2Api } from '../../api/phase2-client'
import { ScopeBar } from '../../components/ScopeBar'
import { Sparkline } from '../../components/phase2/Sparkline'
import { StatusBadge, TrendBadge } from '../../components/phase2/TrendBadge'
import { useApp } from '../../context/AppContext'
import { useProjects } from '../../hooks/useProjects'
import type { PerformanceSummary } from '../../types/phase2'

export function PerformancePage() {
  const { scopeProject, setScopeProject } = useApp()
  const { projects } = useProjects()
  const [summary, setSummary] = useState<PerformanceSummary | null>(null)
  const [filter, setFilter] = useState<'all' | 'winning' | 'declining' | 'needs_work' | 'stable'>('all')

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(null)
    setSummary(null)
    phase2Api.performance.summary(scopeProject)
      .then(setSummary)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar rendimiento'))
  }, [scopeProject])

  if (error) return <p className="sync-error">{error}</p>
  if (!summary) return <p className="muted">Cargando rendimiento…</p>

  const pages = filter === 'all' ? summary.pages : summary.pages.filter((p) => p.status === filter)

  return (
    <>
      <ScopeBar projects={projects} value={scopeProject} onChange={setScopeProject} />

      <div className="banner">
        <strong>Panel de rendimiento.</strong> Datos históricos de GSC y Analytics sincronizados en segundo plano. Las páginas ganadoras, en caída y las que necesitan trabajo se calculan sobre los últimos 28 días.
      </div>

      <div className="grid grid-4" style={{ marginBottom: 22 }}>
        {[
          ['Clicks (28d)', summary.total_clicks_28d.toLocaleString('es-ES')],
          ['Impresiones (28d)', summary.total_impressions_28d.toLocaleString('es-ES')],
          ['Sesiones (28d)', summary.total_sessions_28d.toLocaleString('es-ES')],
          ['Posición media', summary.avg_position_28d.toFixed(1)],
        ].map(([label, value]) => (
          <div key={label as string} className="stat">
            <div className="stat-label">{label as string}</div>
            <div className="stat-value" style={{ fontSize: 26 }}>{value as string}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-4" style={{ marginBottom: 22 }}>
        {[
          ['Ganadoras', summary.winning, 'b-green'],
          ['En caída', summary.declining, 'b-amber'],
          ['Necesitan trabajo', summary.needs_work, 'b-blue'],
          ['Estables', summary.stable, 'b-gray'],
        ].map(([label, count, cls]) => {
          const key = label === 'Ganadoras' ? 'winning'
            : label === 'En caída' ? 'declining'
              : label === 'Necesitan trabajo' ? 'needs_work'
                : 'stable'
          return (
          <button
            key={label as string}
            type="button"
            className={`perf-pill ${cls}${filter === key ? ' active' : ''}`}
            onClick={() => setFilter((f) => f === key ? 'all' : key)}
          >
            <span className="perf-pill-count">{count as number}</span>
            <span>{label as string}</span>
          </button>
          )
        })}
      </div>

      <div className="card">
        <div className="card-pad section-head">
          <h2>Páginas por rendimiento</h2>
          <span className="muted">{pages.length} páginas</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Página</th>
              <th>Estado</th>
              <th>Tendencia</th>
              <th>Clicks</th>
              <th>CTR</th>
              <th>Posición</th>
              <th>Sesiones</th>
              <th>Rebote</th>
              <th>14d</th>
            </tr>
          </thead>
          <tbody>
            {pages.length ? pages.map((p) => (
              <tr key={p.page_id}>
                <td>
                  <div className="t-title">{p.page_title}</div>
                  <div className="t-sub mono">{p.page_url}</div>
                </td>
                <td><StatusBadge status={p.status} /></td>
                <td><TrendBadge trend={p.trend} pct={p.trend_pct} /></td>
                <td>{p.clicks_28d.toLocaleString('es-ES')}</td>
                <td>{p.ctr_28d.toFixed(1)}%</td>
                <td>{p.position_28d.toFixed(1)}</td>
                <td>{p.sessions_28d.toLocaleString('es-ES')}</td>
                <td>{p.bounce_rate_28d}%</td>
                <td><Sparkline values={p.sparkline_clicks} /></td>
              </tr>
            )) : (
              <tr><td colSpan={9} className="empty">Sin datos para este proyecto. Conecta GSC y Analytics.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}