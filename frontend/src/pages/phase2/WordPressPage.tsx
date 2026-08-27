import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api/client'
import { phase2Api } from '../../api/phase2-client'
import { ScopeBar } from '../../components/ScopeBar'
import { useApp } from '../../context/AppContext'
import { useProjects } from '../../hooks/useProjects'
import type { Project } from '../../types'
import type { WpExportBundle, WpExportItem, WpPushResponse } from '../../types/phase2'

export function WordPressPage() {
  const { scopeProject, setScopeProject, setTopbarAction, toast } = useApp()
  const { projects, reload } = useProjects()
  const [bundle, setBundle] = useState<WpExportBundle | null>(null)
  const [loading, setLoading] = useState(false)
  const [filterOnlyReady, setFilterOnlyReady] = useState(false)
  const [selectedPageIds, setSelectedPageIds] = useState<number[]>([])

  // Modal states
  const [htmlModalItem, setHtmlModalItem] = useState<WpExportItem | null>(null)
  const [credsModalOpen, setCredsModalOpen] = useState(false)
  const [pushModalOpen, setPushModalOpen] = useState(false)

  // WP Credentials state
  const [wpUrl, setWpUrl] = useState('')
  const [wpUsername, setWpUsername] = useState('')
  const [wpAppPassword, setWpAppPassword] = useState('')
  const [testingConn, setTestingConn] = useState(false)
  const [connResult, setConnResult] = useState<{ success: boolean; message: string } | null>(null)

  // Push execution state
  const [pushType, setPushType] = useState<'pages' | 'posts'>('pages')
  const [pushStatus, setPushStatus] = useState<'draft' | 'publish'>('draft')
  const [pushing, setPushing] = useState(false)
  const [pushResults, setPushResults] = useState<WpPushResponse | null>(null)

  const effectiveProject = scopeProject === 'all' ? projects[0]?.id : scopeProject
  const currentProjectObj: Project | undefined = projects.find((p) => p.id === effectiveProject)

  useEffect(() => {
    if (currentProjectObj) {
      setWpUrl(currentProjectObj.wp_url || '')
      setWpUsername(currentProjectObj.wp_username || '')
      setWpAppPassword(currentProjectObj.wp_app_password || '')
      setConnResult(null)
    }
  }, [currentProjectObj])

  const loadBundle = useCallback(async () => {
    if (!effectiveProject) return
    setLoading(true)
    try {
      const data = await phase2Api.wordpress.export(effectiveProject)
      setBundle(data)
      setSelectedPageIds(data.pages.filter((p) => p.export_ready).map((p) => p.page_id))
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al cargar páginas exportables')
    } finally {
      setLoading(false)
    }
  }, [effectiveProject, toast])

  useEffect(() => {
    if (effectiveProject) {
      void loadBundle()
    }
  }, [effectiveProject, loadBundle])

  useEffect(() => {
    setTopbarAction(
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => setCredsModalOpen(true)}
        >
          ⚙️ Credenciales WP
        </button>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={() => {
            if (!bundle || bundle.pages.length === 0) return toast('No hay páginas para push')
            setPushResults(null)
            setPushModalOpen(true)
          }}
          disabled={!bundle || bundle.pages.length === 0}
        >
          🚀 Push REST API
        </button>
      </div>,
    )
    return () => setTopbarAction(null)
  }, [bundle, setTopbarAction, toast])

  const handleTestConnection = async () => {
    if (!wpUrl || !wpUsername || !wpAppPassword) {
      return toast('Introduce URL, usuario y contraseña de aplicación')
    }
    setTestingConn(true)
    setConnResult(null)
    try {
      const res = await phase2Api.wordpress.testConnection({
        wp_url: wpUrl,
        wp_username: wpUsername,
        wp_app_password: wpAppPassword,
      })
      setConnResult({ success: res.success, message: res.message })
      toast(res.success ? 'Conexión a WordPress exitosa' : 'Fallo de conexión')
    } catch (e) {
      setConnResult({
        success: false,
        message: e instanceof Error ? e.message : 'Error desconocido al conectar',
      })
    } finally {
      setTestingConn(false)
    }
  }

  const handleSaveCredentials = async () => {
    if (!effectiveProject) return
    try {
      await api.projects.update(effectiveProject, {
        wp_url: wpUrl,
        wp_username: wpUsername,
        wp_app_password: wpAppPassword,
      })
      await reload()
      toast('Credenciales de WordPress guardadas en el proyecto')
      setCredsModalOpen(false)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al guardar credenciales')
    }
  }

  const handleExecutePush = async () => {
    if (!effectiveProject) return
    setPushing(true)
    setPushResults(null)
    try {
      const res = await phase2Api.wordpress.push({
        project_id: effectiveProject,
        page_ids: selectedPageIds.length > 0 ? selectedPageIds : undefined,
        post_type: pushType,
        post_status: pushStatus,
        wp_url: wpUrl || undefined,
        wp_username: wpUsername || undefined,
        wp_app_password: wpAppPassword || undefined,
      })
      setPushResults(res)
      toast(`Push completado: ${res.success_count} creadas, ${res.error_count} errores`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al ejecutar push a WordPress')
    } finally {
      setPushing(false)
    }
  }

  const displayedPages = bundle?.pages.filter((p) => (filterOnlyReady ? p.export_ready : true)) || []

  const toggleSelectAll = () => {
    if (selectedPageIds.length === displayedPages.length) {
      setSelectedPageIds([])
    } else {
      setSelectedPageIds(displayedPages.map((p) => p.page_id))
    }
  }

  const togglePageSelect = (pageId: number) => {
    setSelectedPageIds((prev) =>
      prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId],
    )
  }

  const hasWpConfigured = Boolean(currentProjectObj?.wp_url && currentProjectObj?.wp_username)

  return (
    <>
      <ScopeBar projects={projects} value={scopeProject} onChange={setScopeProject} />

      <div className="banner">
        <strong>Puente & Exportador WordPress Multi-formato.</strong> Exporta tus páginas listas para{' '}
        <strong>WP All Import</strong>, <strong>Rank Math SEO</strong>, archivos HTML maquetados para Divi o{' '}
        <strong>Push Directo por REST API</strong> sin salir del CRM.
      </div>

      {effectiveProject && (
        <div
          className="card"
          style={{
            marginBottom: 20,
            padding: '16px 20px',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>{currentProjectObj?.name || 'Proyecto'}</h3>
              {hasWpConfigured ? (
                <span className="badge" style={{ background: '#dcfce7', color: '#166534' }}>
                  ✓ Conectado: {currentProjectObj?.wp_url}
                </span>
              ) : (
                <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>
                  ⚠️ WP REST no configurado
                </span>
              )}
            </div>
            <p className="t-sub" style={{ margin: '4px 0 0 0' }}>
              Total páginas: <strong>{bundle?.pages.length || 0}</strong> · Listas para exportar:{' '}
              <strong>{bundle?.pages.filter((p) => p.export_ready).length || 0}</strong> · Con HTML Maquetado:{' '}
              <strong>{bundle?.pages.filter((p) => Boolean(p.content_html)).length || 0}</strong>
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <a
              href={phase2Api.wordpress.getCsvDownloadUrl(effectiveProject)}
              className="btn btn-sm"
              download
            >
              📥 Descargar CSV (WP All Import)
            </a>
            <a
              href={phase2Api.wordpress.getZipDownloadUrl(effectiveProject)}
              className="btn btn-sm"
              style={{ background: '#f1f5f9', borderColor: '#cbd5e1' }}
              download
            >
              📦 Descargar ZIP Completo (HTML + CSV)
            </a>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => {
                setPushResults(null)
                setPushModalOpen(true)
              }}
              disabled={!bundle || bundle.pages.length === 0}
            >
              🚀 Enviar por WP REST API
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card card-pad" style={{ textAlign: 'center', color: '#64748b' }}>
          Cargando estructura exportable del proyecto...
        </div>
      ) : bundle && bundle.pages.length > 0 ? (
        <div className="card">
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={filterOnlyReady}
                  onChange={(e) => setFilterOnlyReady(e.target.checked)}
                />
                Mostrar solo páginas marcadas como <strong>Export Ready</strong>
              </label>
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              {selectedPageIds.length} seleccionadas para acción masiva
            </div>
          </div>

          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: 36, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={displayedPages.length > 0 && selectedPageIds.length === displayedPages.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>Página & H1</th>
                <th>Silo / Jerarquía</th>
                <th>Focus Keyword</th>
                <th>Categoría / Tags</th>
                <th>Estado & Maquetación</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {displayedPages.map((p) => {
                const isSelected = selectedPageIds.includes(p.page_id)
                const hasHtml = Boolean(p.content_html)
                return (
                  <tr key={p.page_id} style={{ background: isSelected ? '#f8fafc' : undefined }}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => togglePageSelect(p.page_id)}
                      />
                    </td>
                    <td>
                      <div className="t-title">{p.title}</div>
                      <div className="t-sub" style={{ fontSize: 12, color: '#0369a1' }}>
                        H1: {p.h1 || p.title}
                      </div>
                      <div className="mono muted" style={{ fontSize: 11 }}>
                        {p.slug}
                      </div>
                    </td>
                    <td>
                      {p.parent_title ? (
                        <span className="badge" style={{ background: '#f3e8ff', color: '#6b21a8' }}>
                          ↳ {p.parent_title}
                        </span>
                      ) : (
                        <span className="badge" style={{ background: '#f1f5f9', color: '#475569' }}>
                          Pilar (Raíz)
                        </span>
                      )}
                    </td>
                    <td>
                      {p.focus_keyword ? (
                        <div style={{ fontWeight: 600, color: '#854d0e', fontSize: 13 }}>
                          ★ {p.focus_keyword}
                        </div>
                      ) : (
                        <span className="muted" style={{ fontSize: 12 }}>—</span>
                      )}
                      {p.secondary_keywords && p.secondary_keywords.length > 0 && (
                        <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                          +{p.secondary_keywords.length} secundarias
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{p.wp_category || p.niche_name || '—'}</div>
                      {p.wp_tags && p.wp_tags.length > 0 && (
                        <div className="muted" style={{ fontSize: 11 }}>
                          {p.wp_tags.slice(0, 3).join(', ')}
                          {p.wp_tags.length > 3 ? '...' : ''}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <span
                          className="badge"
                          style={{
                            background: p.export_ready ? '#dcfce7' : '#f1f5f9',
                            color: p.export_ready ? '#166534' : '#475569',
                          }}
                        >
                          {p.export_ready ? '✓ Listo Export' : 'Borrador'}
                        </span>
                        {hasHtml ? (
                          <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                            ⚡ HTML OK
                          </span>
                        ) : (
                          <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>
                            Sin HTML
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => setHtmlModalItem(p)}
                      >
                        👁️ Ver HTML
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty card card-pad">
          No hay páginas en este proyecto. Ve a la sección <strong>Páginas</strong> para crearlas.
        </div>
      )}

      {/* HTML PREVIEW MODAL */}
      {htmlModalItem && (
        <div className="modal-backdrop" onClick={() => setHtmlModalItem(null)}>
          <div
            className="modal-box"
            style={{ maxWidth: 840, width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>Código HTML para WordPress — {htmlModalItem.title}</h3>
                <p className="t-sub" style={{ margin: '2px 0 0 0' }}>Slug: {htmlModalItem.slug}</p>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => setHtmlModalItem(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', margin: '16px 0' }}>
              <textarea
                readOnly
                value={htmlModalItem.content_html || '<!-- Sin contenido HTML maquetado generado aún -->'}
                rows={16}
                className="mono"
                style={{ width: '100%', fontSize: 12, background: '#f8fafc' }}
              />
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  navigator.clipboard.writeText(htmlModalItem.content_html || '')
                  toast('HTML copiado al portapapeles')
                }}
              >
                📋 Copiar HTML
              </button>
              <button type="button" className="btn" onClick={() => setHtmlModalItem(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREDENTIALS CONFIG MODAL */}
      {credsModalOpen && (
        <div className="modal-backdrop" onClick={() => setCredsModalOpen(false)}>
          <div
            className="modal-box"
            style={{ maxWidth: 540, width: '95%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <h3 style={{ margin: 0, fontSize: 17 }}>Configurar Conexión WordPress REST API</h3>
              <p className="t-sub" style={{ margin: '4px 0 0 0' }}>
                Usa una <strong>Contraseña de Aplicación</strong> de WordPress (Usuarios → Tu Perfil → Contraseñas de aplicación).
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: '16px 0' }}>
              <div className="field">
                <label>URL del Sitio WordPress</label>
                <input
                  type="url"
                  placeholder="https://tudominio.com"
                  value={wpUrl}
                  onChange={(e) => setWpUrl(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Usuario / Administrador WordPress</label>
                <input
                  type="text"
                  placeholder="admin_wp"
                  value={wpUsername}
                  onChange={(e) => setWpUsername(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Contraseña de Aplicación (Application Password)</label>
                <input
                  type="password"
                  placeholder="xxxx yyyy zzzz wwww"
                  value={wpAppPassword}
                  onChange={(e) => setWpAppPassword(e.target.value)}
                />
              </div>

              {connResult && (
                <div
                  style={{
                    padding: 10,
                    borderRadius: 6,
                    fontSize: 13,
                    background: connResult.success ? '#dcfce7' : '#fee2e2',
                    color: connResult.success ? '#166534' : '#991b1b',
                    border: `1px solid ${connResult.success ? '#bbf7d0' : '#fecaca'}`,
                  }}
                >
                  {connResult.success ? '✓ ' : '✕ '} {connResult.message}
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleTestConnection}
                disabled={testingConn}
              >
                {testingConn ? 'Probando...' : '🔌 Probar Conexión'}
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn" onClick={() => setCredsModalOpen(false)}>
                  Cancelar
                </button>
                <button type="button" className="btn btn-primary" onClick={handleSaveCredentials}>
                  Guardar en Proyecto
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PUSH EXECUTION MODAL */}
      {pushModalOpen && (
        <div className="modal-backdrop" onClick={() => setPushModalOpen(false)}>
          <div
            className="modal-box"
            style={{ maxWidth: 640, width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <h3 style={{ margin: 0, fontSize: 17 }}>Publicar / Enviar a WordPress vía REST API</h3>
              <p className="t-sub" style={{ margin: '4px 0 0 0' }}>
                Destino: <strong>{wpUrl || currentProjectObj?.wp_url || '(Sin URL configurada)'}</strong>
              </p>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', margin: '16px 0' }}>
              {!pushResults ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="field">
                    <label>Tipo de Contenido en WordPress</label>
                    <select
                      value={pushType}
                      onChange={(e) => setPushType(e.target.value as 'pages' | 'posts')}
                    >
                      <option value="pages">Páginas (Pages)</option>
                      <option value="posts">Entradas del Blog (Posts)</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>Estado Inicial en WordPress</label>
                    <select
                      value={pushStatus}
                      onChange={(e) => setPushStatus(e.target.value as 'draft' | 'publish')}
                    >
                      <option value="draft">Borrador (Draft) — Recomendado para revisión final</option>
                      <option value="publish">Publicar directamente (Publish)</option>
                    </select>
                  </div>

                  <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      Se enviarán {selectedPageIds.length > 0 ? selectedPageIds.length : (bundle?.pages.length || 0)} páginas:
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      Se transferirán los títulos, slugs, contenido HTML maquetado y los campos de Rank Math SEO (Title, Meta Description, Focus Keyword).
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 6,
                      background: pushResults.error_count === 0 ? '#dcfce7' : '#fef3c7',
                      color: pushResults.error_count === 0 ? '#166534' : '#92400e',
                    }}
                  >
                    <strong>Resumen del Push:</strong> {pushResults.success_count} páginas enviadas con éxito,{' '}
                    {pushResults.error_count} errores.
                  </div>

                  <table style={{ width: '100%', fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Página</th>
                        <th>Estado</th>
                        <th>Detalles</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pushResults.items.map((it) => (
                        <tr key={it.page_id}>
                          <td><strong>{it.title}</strong></td>
                          <td>
                            <span
                              className="badge"
                              style={{
                                background: it.status === 'success' ? '#dcfce7' : '#fee2e2',
                                color: it.status === 'success' ? '#166534' : '#991b1b',
                              }}
                            >
                              {it.status === 'success' ? '✓ Éxito' : '✕ Error'}
                            </span>
                          </td>
                          <td>
                            {it.wp_url ? (
                              <a href={it.wp_url} target="_blank" rel="noreferrer" style={{ color: '#0284c7' }}>
                                Ver en WP →
                              </a>
                            ) : (
                              <span className="muted">{it.message}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn" onClick={() => setPushModalOpen(false)}>
                {pushResults ? 'Cerrar' : 'Cancelar'}
              </button>
              {!pushResults && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleExecutePush}
                  disabled={pushing}
                >
                  {pushing ? 'Enviando a WordPress...' : '🚀 Confirmar y Enviar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}