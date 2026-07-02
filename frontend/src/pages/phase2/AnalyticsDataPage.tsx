import { useEffect, useState } from 'react'
import { phase2Api } from '../../api/phase2-client'
import { ScopeBar } from '../../components/ScopeBar'
import { DateRangeFilter, defaultDateRange } from '../../components/phase2/DateRangeFilter'
import { useApp } from '../../context/AppContext'
import { useProjects } from '../../hooks/useProjects'
import type { AnalyticsDataRow, DateRange } from '../../types/phase2'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function AnalyticsDataPage() {
  const { scopeProject, setScopeProject } = useApp()
  const { projects } = useProjects()
  const [rows, setRows] = useState<AnalyticsDataRow[]>([])
  const [range, setRange] = useState<DateRange>(defaultDateRange(28))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    phase2Api.analytics.list(scopeProject, range).then((data) => {
      setRows(data)
      setLoading(false)
    })
  }, [scopeProject, range])

  const totals = rows.reduce(
    (acc, r) => ({ sessions: acc.sessions + r.sessions, users: acc.users + r.users }),
    { sessions: 0, users: 0 },
  )
  const avgBounce = rows.length ? rows.reduce((s, r) => s + r.bounce_rate, 0) / rows.length : 0
  const avgEng = rows.length ? rows.reduce((s, r) => s + r.avg_engagement_time, 0) / rows.length : 0

  return (
    <>
      <ScopeBar projects={projects} value={scopeProject} onChange={setScopeProject} />

      <div className="banner">
        <strong>Datos Google Analytics 4.</strong> Sesiones, usuarios, tasa de rebote y tiempo de engagement por página. Tabla <code className="mono">analytics_data</code>.
      </div>

      <DateRangeFilter value={range} onChange={setRange} />

      <div className="grid grid-4" style={{ margin: '16px 0 22px' }}>
        <div className="stat"><div className="stat-label">Sesiones</div><div className="stat-value" style={{ fontSize: 24 }}>{totals.sessions.toLocaleString('es-ES')}</div></div>
        <div className="stat"><div className="stat-label">Usuarios</div><div className="stat-value" style={{ fontSize: 24 }}>{totals.users.toLocaleString('es-ES')}</div></div>
        <div className="stat"><div className="stat-label">Rebote medio</div><div className="stat-value" style={{ fontSize: 24 }}>{avgBounce.toFixed(0)}%</div></div>
        <div className="stat"><div className="stat-label">Engagement medio</div><div className="stat-value" style={{ fontSize: 24 }}>{fmtTime(Math.round(avgEng))}</div></div>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr><th>Fecha</th><th>Página</th><th>Sesiones</th><th>Usuarios</th><th>Rebote</th><th>Engagement</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="empty">Cargando…</td></tr>
            ) : rows.length ? rows.map((r) => (
              <tr key={r.id}>
                <td className="muted">{fmtDate(r.date)}</td>
                <td className="mono">{r.page_path}</td>
                <td>{r.sessions}</td>
                <td>{r.users}</td>
                <td>{r.bounce_rate}%</td>
                <td>{fmtTime(r.avg_engagement_time)}</td>
              </tr>
            )) : (
              <tr><td colSpan={6} className="empty">Sin datos Analytics en este rango. Conecta GA4.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}