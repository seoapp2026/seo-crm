import type { PerformanceStatus, PerformanceTrend } from '../../types/phase2'

const TREND: Record<PerformanceTrend, { label: string; cls: string; arrow: string }> = {
  up: { label: 'Subiendo', cls: 'b-green', arrow: '↑' },
  down: { label: 'Bajando', cls: 'b-amber', arrow: '↓' },
  stable: { label: 'Estable', cls: 'b-gray', arrow: '→' },
}

const STATUS: Record<PerformanceStatus, { label: string; cls: string }> = {
  winning: { label: 'Ganadora', cls: 'b-green' },
  declining: { label: 'En caída', cls: 'b-amber' },
  needs_work: { label: 'Necesita trabajo', cls: 'b-blue' },
  stable: { label: 'Estable', cls: 'b-gray' },
}

export function TrendBadge({ trend, pct }: { trend: PerformanceTrend; pct: number }) {
  const t = TREND[trend]
  return (
    <span className={`badge ${t.cls}`}>
      <span className="badge-dot" />
      {t.arrow} {Math.abs(pct)}%
    </span>
  )
}

export function StatusBadge({ status }: { status: PerformanceStatus }) {
  const s = STATUS[status]
  return (
    <span className={`badge ${s.cls}`}>
      <span className="badge-dot" />
      {s.label}
    </span>
  )
}