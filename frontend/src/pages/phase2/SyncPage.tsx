import { useCallback, useEffect, useState } from 'react'
import { phase2Api } from '../../api/phase2-client'
import { ScopeBar } from '../../components/ScopeBar'
import { SyncJobCard } from '../../components/phase2/SyncJobCard'
import { useApp } from '../../context/AppContext'
import { useProjects } from '../../hooks/useProjects'
import type { SyncJob } from '../../types/phase2'

export function SyncPage() {
  const { scopeProject, setScopeProject, toast } = useApp()
  const { projects } = useProjects()
  const [jobs, setJobs] = useState<SyncJob[]>([])
  const [runningId, setRunningId] = useState<number | null>(null)

  const reload = useCallback(() => {
    phase2Api.sync.list(scopeProject).then(setJobs)
  }, [scopeProject])

  useEffect(() => { reload() }, [reload])

  const runJob = async (id: number) => {
    setRunningId(id)
    try {
      await phase2Api.sync.runNow(id)
      toast('Sincronización completada')
      reload()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error de sincronización')
      reload()
    } finally {
      setRunningId(null)
    }
  }

  const toggleJob = async (id: number, enabled: boolean) => {
    await phase2Api.sync.toggle(id, enabled)
    reload()
    toast(enabled ? 'Trabajo activado' : 'Trabajo pausado')
  }

  return (
    <>
      <ScopeBar projects={projects} value={scopeProject} onChange={setScopeProject} />

      <div className="banner">
        <strong>Sincronización en segundo plano.</strong> Trabajos programados (cron/APScheduler) que extraen datos de Google y los guardan en tablas históricas. Patrón de adaptadores modular — Ahrefs, Semrush y GBP podrán conectarse después.
      </div>

      <div className="sync-flow card card-pad" style={{ marginBottom: 22 }}>
        <div className="sync-flow-steps">
          <span>OAuth2 · <code className="mono">google_auth</code></span>
          <span className="sync-arrow">→</span>
          <span>Jobs programados</span>
          <span className="sync-arrow">→</span>
          <span>Adaptadores (GSC / GA4 / Ads)</span>
          <span className="sync-arrow">→</span>
          <span>Tablas históricas</span>
          <span className="sync-arrow">→</span>
          <span>Panel + Asistentes IA</span>
        </div>
      </div>

      <div className="grid grid-1 gap-16">
        {jobs.map((job) => (
          <SyncJobCard
            key={job.id}
            job={job}
            running={runningId === job.id}
            onRun={() => runJob(job.id)}
            onToggle={(enabled) => toggleJob(job.id, enabled)}
          />
        ))}
        {!jobs.length && <div className="empty card card-pad">Sin trabajos para este proyecto.</div>}
      </div>
    </>
  )
}