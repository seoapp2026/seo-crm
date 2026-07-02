import { useEffect, useState } from 'react'
import { phase2Api } from '../../api/phase2-client'
import { Badge } from '../../components/Badge'
import { ScopeBar } from '../../components/ScopeBar'
import { useApp } from '../../context/AppContext'
import { useProjects } from '../../hooks/useProjects'
import type { AdsKeyword } from '../../types/phase2'

const COMPETITION: Record<AdsKeyword['competition'], { label: string; cls: string }> = {
  LOW: { label: 'Baja', cls: 'b-green' },
  MEDIUM: { label: 'Media', cls: 'b-amber' },
  HIGH: { label: 'Alta', cls: 'b-blue' },
}

export function AdsKeywordsPage() {
  const { scopeProject, setScopeProject } = useApp()
  const { projects } = useProjects()
  const [items, setItems] = useState<AdsKeyword[]>([])

  useEffect(() => {
    phase2Api.adsKeywords.list(scopeProject).then(setItems)
  }, [scopeProject])

  return (
    <>
      <ScopeBar projects={projects} value={scopeProject} onChange={setScopeProject} />

      <div className="banner">
        <strong>Google Ads Keyword Planner.</strong> Volumen de búsqueda, competencia y CPC estimado. Tabla <code className="mono">ads_keywords</code> · sincronización semanal. <em>Requiere developer token aprobado.</em>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr><th>Keyword</th><th>Volumen/mes</th><th>Competencia</th><th>CPC bajo</th><th>CPC alto</th><th>Última sync</th></tr>
          </thead>
          <tbody>
            {items.length ? items.map((k) => {
              const c = COMPETITION[k.competition]
              return (
                <tr key={k.id}>
                  <td className="t-title">{k.term}</td>
                  <td>{k.volume.toLocaleString('es-ES')}</td>
                  <td><Badge label={c.label} cls={c.cls} /></td>
                  <td>{k.cpc_low.toFixed(2)} €</td>
                  <td>{k.cpc_high.toFixed(2)} €</td>
                  <td className="muted">{new Date(k.synced_at).toLocaleDateString('es-ES')}</td>
                </tr>
              )
            }) : (
              <tr><td colSpan={6} className="empty">Sin datos de Ads. Conecta Keyword Planner cuando el developer token esté aprobado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}