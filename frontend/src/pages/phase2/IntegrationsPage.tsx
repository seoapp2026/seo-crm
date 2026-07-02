import { useCallback, useEffect, useState } from 'react'
import { phase2Api } from '../../api/phase2-client'
import { ScopeBar } from '../../components/ScopeBar'
import { ConnectionCard } from '../../components/phase2/ConnectionCard'
import { useApp } from '../../context/AppContext'
import { useProjects } from '../../hooks/useProjects'
import type { GoogleAuth } from '../../types/phase2'

export function IntegrationsPage() {
  const { scopeProject, setScopeProject, toast } = useApp()
  const { projects } = useProjects()
  const [items, setItems] = useState<GoogleAuth[]>([])

  const reload = useCallback(() => {
    phase2Api.integrations.list(scopeProject).then(setItems)
  }, [scopeProject])

  useEffect(() => { reload() }, [reload])

  const effectiveProject = scopeProject === 'all' ? projects[0]?.id : scopeProject

  const connect = async (service: GoogleAuth['service']) => {
    if (!effectiveProject) return toast('Selecciona un proyecto')
    try {
      await phase2Api.integrations.connect(effectiveProject, service)
      toast(`OAuth simulado — ${service.toUpperCase()} conectado`)
      reload()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error')
    }
  }

  const disconnect = async (id: number) => {
    await phase2Api.integrations.disconnect(id)
    toast('Integración desconectada')
    reload()
  }

  return (
    <>
      <ScopeBar projects={projects} value={scopeProject} onChange={setScopeProject} />

      <div className="banner">
        <strong>Integraciones Google (OAuth2).</strong> Los tokens se guardan en <code className="mono">google_auth</code> y alimentan los trabajos de sincronización en segundo plano. Prioridad: Search Console → Analytics → Ads.
      </div>

      {scopeProject === 'all' && (
        <p className="muted" style={{ marginBottom: 16 }}>
          Mostrando integraciones del primer proyecto. Filtra por proyecto para gestionar cada web.
        </p>
      )}

      <div className="grid grid-1 gap-16">
        {items.map((auth) => (
          <ConnectionCard
            key={auth.id}
            auth={auth}
            onConnect={() => connect(auth.service)}
            onDisconnect={() => disconnect(auth.id)}
          />
        ))}
        {!items.length && <div className="empty card card-pad">Sin integraciones para este proyecto.</div>}
      </div>

      <div className="card card-pad" style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 15, marginBottom: 8 }}>Antes de conectar (producción)</h2>
        <ul className="checklist muted">
          <li>Proyecto en Google Cloud con credenciales OAuth (Search Console + Analytics)</li>
          <li>Cuentas del cliente autorizadas en la pantalla de consentimiento</li>
          <li>Developer token de Google Ads — solicitar con antelación (puede tardar semanas)</li>
          <li>URLs de redirección configuradas para tu dominio de producción</li>
        </ul>
      </div>
    </>
  )
}