import { useEffect, useState } from 'react'
import { phase2Api } from '../../api/phase2-client'
import { ScopeBar } from '../../components/ScopeBar'
import { DateRangeFilter, defaultDateRange } from '../../components/phase2/DateRangeFilter'
import { useApp } from '../../context/AppContext'
import { useProjects } from '../../hooks/useProjects'
import type { DateRange, GscDataRow } from '../../types/phase2'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

export function GscDataPage() {
  const { scopeProject, setScopeProject } = useApp()
  const { projects } = useProjects()
  const [rows, setRows] = useState<GscDataRow[]>([])
  const [range, setRange] = useState<DateRange>(defaultDateRange(28))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    phase2Api.gsc.list(scopeProject, range).then((data) => {
      setRows(data)
      setLoading(false)
    })
  }, [scopeProject, range])

  const totals = rows.reduce(
    (acc, r) => ({
      impressions: acc.impressions + r.impressions,
      clicks: acc.clicks + r.clicks,
    }),
    { impressions: 0, clicks: 0 },
  )
  const avgCtr = rows.length ? rows.reduce((s, r) => s + r.ctr, 0) / rows.length : 0
  const avgPos = rows.length ? rows.reduce((s, r) => s + r.position, 0) / rows.length : 0

  return (
    <>
      <ScopeBar projects={projects} value={scopeProject} onChange={setScopeProject} />

      <div className="banner">
        <strong>Datos Search Console.</strong> Histórico diario por URL: impresiones, clicks, CTR y posición. Tabla <code className="mono">gsc_data</code> · sincronización diaria.
      </div>

      <DateRangeFilter value={range} onChange={setRange} />

      <div className="grid grid-4" style={{ margin: '16px 0 22px' }}>
        <div className="stat"><div className="stat-label">Impresiones</div><div className="stat-value" style={{ fontSize: 24 }}>{totals.impressions.toLocaleString('es-ES')}</div></div>
        <div className="stat"><div className="stat-label">Clicks</div><div className="stat-value" style={{ fontSize: 24 }}>{totals.clicks.toLocaleString('es-ES')}</div></div>
        <div className="stat"><div className="stat-label">CTR medio</div><div className="stat-value" style={{ fontSize: 24 }}>{avgCtr.toFixed(1)}%</div></div>
        <div className="stat"><div className="stat-label">Posición media</div><div className="stat-value" style={{ fontSize: 24 }}>{avgPos.toFixed(1)}</div></div>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr><th>Fecha</th><th>URL</th><th>Impresiones</th><th>Clicks</th><th>CTR</th><th>Posición</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="empty">Cargando…</td></tr>
            ) : rows.length ? rows.map((r) => (
              <tr key={r.id}>
                <td className="muted">{fmtDate(r.date)}</td>
                <td className="mono">{r.page_url}</td>
                <td>{r.impressions.toLocaleString('es-ES')}</td>
                <td>{r.clicks.toLocaleString('es-ES')}</td>
                <td>{r.ctr.toFixed(1)}%</td>
                <td>{r.position.toFixed(1)}</td>
              </tr>
            )) : (
              <tr><td colSpan={6} className="empty">Sin datos GSC en este rango. Conecta Search Console.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}