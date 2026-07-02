import { SYNC_JOB_LABELS } from '../../api/phase2-client'
import type { SyncJob } from '../../types/phase2'

const STATUS: Record<SyncJob['status'], { label: string; cls: string }> = {
  idle: { label: 'En espera', cls: 'b-gray' },
  running: { label: 'Ejecutando…', cls: 'b-blue' },
  success: { label: 'OK', cls: 'b-green' },
  error: { label: 'Error', cls: 'b-amber' },
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
}

interface Props {
  job: SyncJob
  onRun: () => void
  onToggle: (enabled: boolean) => void
  running?: boolean
}

export function SyncJobCard({ job, onRun, onToggle, running }: Props) {
  const st = STATUS[running ? 'running' : job.status]

  return (
    <div className={`sync-card${job.enabled ? '' : ' disabled'}`}>
      <div className="sync-head">
        <div>
          <div className="sync-title">{SYNC_JOB_LABELS[job.job_type]}</div>
          <div className="sync-schedule mono">{job.schedule} · {job.schedule_cron}</div>
        </div>
        <span className={`badge ${st.cls}`}>
          <span className="badge-dot" />
          {st.label}
        </span>
      </div>

      <div className="sync-stats">
        <div><span className="muted">Última ejecución</span><strong>{fmtDate(job.last_run_at)}</strong></div>
        <div><span className="muted">Próxima</span><strong>{fmtDate(job.next_run_at)}</strong></div>
        <div><span className="muted">Registros</span><strong>{job.records_synced.toLocaleString('es-ES')}</strong></div>
      </div>

      {job.last_error && (
        <div className="sync-error">{job.last_error}</div>
      )}

      <div className="sync-actions">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={job.enabled}
            onChange={(e) => onToggle(e.target.checked)}
          />
          Activo
        </label>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={onRun}
          disabled={!job.enabled || running}
        >
          {running ? 'Sincronizando…' : 'Ejecutar ahora'}
        </button>
      </div>
    </div>
  )
}