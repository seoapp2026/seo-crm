import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
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
  const [searchParams, setSearchParams] = useSearchParams()

  const effectiveProject = scopeProject === 'all' ? projects[0]?.id : scopeProject
  const activeProject = projects.find((p) => p.id === effectiveProject)
  const listProjectId = effectiveProject ?? 'all'

  const reload = useCallback(async () => {
    if (scopeProject === 'all' && !effectiveProject) {
      setItems([])
      return []
    }
    try {
      const rows = await phase2Api.integrations.list(listProjectId)
      setItems(rows)
      return rows
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudieron cargar las integraciones')
      setItems([])
      return []
    }
  }, [scopeProject, effectiveProject, listProjectId, toast])

  useEffect(() => { void reload() }, [reload])

  useEffect(() => {
    const oauthError = searchParams.get('oauth_error') as GoogleAuth['service'] | null
    if (oauthError) {
      const message = searchParams.get('message')
      setSearchParams({}, { replace: true })
      toast(message || `Error al conectar ${oauthError.toUpperCase()}. Inténtalo de nuevo.`)
      return
    }

    const connected = searchParams.get('connected') as GoogleAuth['service'] | null
    if (!connected) return
    setSearchParams({}, { replace: true })
    void reload().then((rows) => {
      const row = rows.find((r) => r.service === connected)
      if (row?.connected) {
        toast(`${connected.toUpperCase()} conectado correctamente`)
      } else {
        toast('OAuth completado pero la integración no quedó conectada. Revisa la configuración del proyecto.')
      }
    })
  }, [searchParams, setSearchParams, toast, reload])

  const connect = async (service: GoogleAuth['service']) => {
    if (!effectiveProject) return toast('Selecciona un proyecto')
    if (service === 'gsc' && !activeProject?.gsc_site_url?.trim()) {
      return toast('Configura la URL de Search Console en Proyectos antes de conectar')
    }
    if (service === 'ga4' && !activeProject?.ga4_property_id?.trim()) {
      return toast('Configura el GA4 Property ID en Proyectos antes de conectar')
    }
    try {
      const res = await phase2Api.integrations.connect(effectiveProject, service)
      window.location.href = res.auth_url
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al iniciar OAuth')
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

      {activeProject && (
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="section-head">
            <h2 style={{ fontSize: 15 }}>Objetivos de este proyecto</h2>
            <Link to="/projects" className="btn btn-sm">Editar en Proyectos</Link>
          </div>
          <p className="t-sub" style={{ marginBottom: 6 }}>
            <strong>GSC:</strong>{' '}
            <span className="mono">{activeProject.gsc_site_url || '— sin configurar —'}</span>
          </p>
          <p className="t-sub">
            <strong>GA4:</strong>{' '}
            <span className="mono">{activeProject.ga4_property_id || '— sin configurar —'}</span>
          </p>
        </div>
      )}

      <div className="grid grid-1 gap-16">
        {items.map((auth) => (
          <ConnectionCard
            key={auth.id}
            auth={auth}
            onConnect={() => connect(auth.service)}
            onDisconnect={() => disconnect(auth.id)}
            connectBlockedReason={
              auth.service === 'gsc' && !activeProject?.gsc_site_url?.trim()
                ? 'Configura la URL de Search Console en Proyectos.'
                : auth.service === 'ga4' && !activeProject?.ga4_property_id?.trim()
                  ? 'Configura el GA4 Property ID en Proyectos.'
                  : null
            }
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