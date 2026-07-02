import { useCallback, useEffect, useState } from 'react'
import { phase2Api } from '../../api/phase2-client'
import { ScopeBar } from '../../components/ScopeBar'
import { PAGE_TYPES } from '../../constants'
import { useApp } from '../../context/AppContext'
import { useProjects } from '../../hooks/useProjects'
import type { WpExportBundle } from '../../types/phase2'

export function WordPressPage() {
  const { scopeProject, setScopeProject, setTopbarAction, toast } = useApp()
  const { projects } = useProjects()
  const [bundle, setBundle] = useState<WpExportBundle | null>(null)
  const [loading, setLoading] = useState(false)
  const [jsonPreview, setJsonPreview] = useState('')

  const effectiveProject = scopeProject === 'all' ? projects[0]?.id : scopeProject

  const exportBundle = useCallback(async () => {
    if (!effectiveProject) return toast('Selecciona un proyecto')
    setLoading(true)
    try {
      const data = await phase2Api.wordpress.export(effectiveProject)
      setBundle(data)
      setJsonPreview(JSON.stringify(data, null, 2))
      toast('Estructura WP generada — revisa antes de importar')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [effectiveProject, toast])

  useEffect(() => {
    setTopbarAction(
      <button type="button" className="btn btn-primary" onClick={exportBundle} disabled={loading}>
        {loading ? 'Generando…' : 'Generar export WP'}
      </button>,
    )
    return () => setTopbarAction(null)
  }, [loading, exportBundle, setTopbarAction])

  const copyJson = () => {
    navigator.clipboard.writeText(jsonPreview)
    toast('JSON copiado al portapapeles')
  }

  const downloadJson = () => {
    const blob = new Blob([jsonPreview], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `wp-export-${effectiveProject}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast('Descarga iniciada')
  }

  return (
    <>
      <ScopeBar projects={projects} value={scopeProject} onChange={setScopeProject} />

      <div className="banner">
        <strong>Puente WordPress.</strong> Exporta estructura lista para WP: título, slug, meta, H1, tipo y estado. <em>Publicación siempre manual</em> — el CRM no publica por sí solo.
      </div>

      {bundle ? (
        <>
          <div className="grid grid-2" style={{ marginBottom: 22 }}>
            <div className="stat">
              <div className="stat-label">Proyecto</div>
              <div className="stat-value" style={{ fontSize: 20 }}>{bundle.project_name}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Páginas exportadas</div>
              <div className="stat-value" style={{ fontSize: 20 }}>{bundle.pages.length}</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 22 }}>
            <table>
              <thead>
                <tr><th>Título</th><th>Slug</th><th>Tipo</th><th>Estado</th><th>Meta title</th></tr>
              </thead>
              <tbody>
                {bundle.pages.map((p) => (
                  <tr key={p.page_id}>
                    <td>
                      <div className="t-title">{p.title}</div>
                      <div className="t-sub">H1: {p.h1}</div>
                    </td>
                    <td className="mono">{p.slug}</td>
                    <td><span className={`pill-type pt-${p.content_type}`}>{PAGE_TYPES[p.content_type]?.label || p.content_type}</span></td>
                    <td>{p.status}</td>
                    <td className="t-sub">{p.meta_title}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card card-pad">
            <div className="section-head">
              <h2>JSON para importación</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-sm" onClick={copyJson}>Copiar</button>
                <button type="button" className="btn btn-sm btn-primary" onClick={downloadJson}>Descargar .json</button>
              </div>
            </div>
            <pre className="wp-json-preview">{jsonPreview}</pre>
          </div>
        </>
      ) : (
        <div className="empty card card-pad">
          Pulsa <strong>Generar export WP</strong> para crear la estructura exportable del proyecto activo.
        </div>
      )}
    </>
  )
}