import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { Badge } from '../components/Badge'
import { Modal } from '../components/Modal'
import { ScopeBar } from '../components/ScopeBar'
import { INTENTS, PAGE_TYPES } from '../constants'
import { useApp } from '../context/AppContext'
import { useProjects } from '../hooks/useProjects'
import type { ClusterItem, Intent, Keyword, Niche, Page, PageType } from '../types'

export function KeywordsPage() {
  const { scopeProject, setScopeProject, setTopbarAction, toast } = useApp()
  const { projects } = useProjects()
  const [items, setItems] = useState<Keyword[]>([])
  const [pages, setPages] = useState<Page[]>([])
  const [niches, setNiches] = useState<Niche[]>([])
  const [editing, setEditing] = useState<Keyword | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    term: '',
    page_id: 0,
    niche_id: 0,
    project_id: 0,
    intent: 'informacional' as Intent,
    note: '',
    is_primary: false,
  })

  // Auto-Tagging & Clustering state
  const [autoTagging, setAutoTagging] = useState(false)
  const [clusteringModalOpen, setClusteringModalOpen] = useState(false)
  const [clusteringLoading, setClusteringLoading] = useState(false)
  const [clusters, setClusters] = useState<ClusterItem[]>([])
  const [selectedClusterIds, setSelectedClusterIds] = useState<string[]>([])
  const [clusterEdits, setClusterEdits] = useState<
    Record<string, { title: string; h1: string; type: PageType; niche_id: number; parent_page_id?: number | null }>
  >({})
  const [applyingClusters, setApplyingClusters] = useState(false)

  const effectiveProject = scopeProject === 'all' ? projects[0]?.id : scopeProject

  const reload = async () => {
    const [kws, pgs, ncs] = await Promise.all([
      api.keywords.list(scopeProject),
      api.pages.list(scopeProject),
      api.niches.list(scopeProject),
    ])
    setItems(kws)
    setPages(pgs)
    setNiches(ncs)
  }

  useEffect(() => { reload() }, [scopeProject])

  const handleAutoTagIntent = async () => {
    if (!effectiveProject) return toast('Selecciona un proyecto')
    setAutoTagging(true)
    try {
      const res = await api.keywords.autoTagIntent({ project_id: effectiveProject })
      toast(
        `✓ ${res.updated_count} keywords etiquetadas (${res.informational_count} info, ${res.commercial_count} com, ${res.transactional_count} trans)`,
      )
      await reload()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al auto-etiquetar intención')
    } finally {
      setAutoTagging(false)
    }
  }

  const handleSuggestClusters = async () => {
    if (!effectiveProject) return toast('Selecciona un proyecto')
    setClusteringLoading(true)
    try {
      const res = await api.keywords.suggestClusters({ project_id: effectiveProject })
      setClusters(res.clusters)
      setSelectedClusterIds(res.clusters.map((c) => c.cluster_id))
      const edits: Record<string, { title: string; h1: string; type: PageType; niche_id: number; parent_page_id?: number | null }> = {}
      res.clusters.forEach((c) => {
        edits[c.cluster_id] = {
          title: c.suggested_title,
          h1: c.suggested_h1,
          type: c.suggested_type,
          niche_id: niches[0]?.id || 0,
          parent_page_id: null,
        }
      })
      setClusterEdits(edits)
      setClusteringModalOpen(true)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al generar sugerencias de clustering')
    } finally {
      setClusteringLoading(false)
    }
  }

  const handleApplyClusters = async () => {
    if (!effectiveProject) return
    const selectedClusters = clusters.filter((c) => selectedClusterIds.includes(c.cluster_id))
    if (selectedClusters.length === 0) return toast('Selecciona al menos un cluster')
    setApplyingClusters(true)
    try {
      const payload = {
        project_id: effectiveProject,
        clusters: selectedClusters.map((c) => {
          const edit = clusterEdits[c.cluster_id]
          return {
            cluster_name: c.cluster_name,
            focus_keyword_id: c.keyword_ids[0],
            keyword_ids: c.keyword_ids,
            existing_page_id: c.existing_page_id,
            title: edit?.title || c.suggested_title,
            h1: edit?.h1 || c.suggested_h1,
            type: edit?.type || c.suggested_type,
            niche_id: edit?.niche_id || niches[0]?.id || 0,
            parent_page_id: edit?.parent_page_id || undefined,
          }
        }),
      }
      const res = await api.keywords.applyClusters(payload)
      toast(`✓ ${res.created_pages_count} páginas creadas, ${res.linked_keywords_count} keywords asignadas`)
      setClusteringModalOpen(false)
      await reload()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al aplicar clusters')
    } finally {
      setApplyingClusters(false)
    }
  }

  useEffect(() => {
    setTopbarAction(
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={handleAutoTagIntent}
          disabled={autoTagging || items.length === 0}
        >
          {autoTagging ? 'Etiquetando...' : '⚡ Auto-Etiquetar Intención'}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={handleSuggestClusters}
          disabled={clusteringLoading || items.length === 0}
        >
          {clusteringLoading ? 'Analizando...' : '🧠 Auto-Clustering IA'}
        </button>
        <button
          className="btn btn-sm btn-primary"
          onClick={() => {
            const pg = pages[0]
            setEditing(null)
            setForm({
              term: '',
              page_id: pg?.id || 0,
              niche_id: pg?.niche_id || 0,
              project_id: pg?.project_id || 0,
              intent: 'informacional',
              note: '',
              is_primary: false,
            })
            setOpen(true)
          }}
        >
          + Nueva keyword
        </button>
      </div>,
    )
    return () => setTopbarAction(null)
  }, [pages, items, autoTagging, clusteringLoading, setTopbarAction])

  const save = async () => {
    if (!form.term.trim()) return toast('El término es obligatorio')
    try {
      const saved = editing
        ? await api.keywords.update(editing.id, form)
        : await api.keywords.create(form)
      setOpen(false)
      reload()
      if (saved.cannibalized) {
        const others = (saved.cannibalized_on || []).join(', ')
        toast(
          others
            ? `Canibalización: «${saved.term}» también está en ${others}`
            : `Canibalización: «${saved.term}» está en más de una página`,
        )
      } else {
        toast('Keyword guardada')
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error')
    }
  }

  const pageTitle = (id: number) => pages.find((p) => p.id === id)?.title || '—'

  const clashPages = [...new Set(
    items
      .filter((k) =>
        form.term.trim()
        && k.term.trim().toLowerCase() === form.term.trim().toLowerCase()
        && k.id !== editing?.id,
      )
      .map((k) => pageTitle(k.page_id)),
  )]

  return (
    <>
      <ScopeBar projects={projects} value={scopeProject} onChange={setScopeProject} />
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Término</th>
              <th>Página</th>
              <th>Intención</th>
              <th>Rol SEO</th>
              <th>Canibalización</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((k) => (
              <tr key={k.id}>
                <td className="t-title">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {k.is_primary && (
                      <span title="Keyword Principal (Focus)" style={{ color: '#eab308' }}>
                        ★
                      </span>
                    )}
                    <span>{k.term}</span>
                  </div>
                </td>
                <td>{pageTitle(k.page_id)}</td>
                <td><Badge label={INTENTS[k.intent].label} cls={INTENTS[k.intent].cls} /></td>
                <td>
                  {k.is_primary ? (
                    <span className="badge" style={{ background: '#fef9c3', color: '#854d0e', fontWeight: 600 }}>
                      Principal (Focus)
                    </span>
                  ) : (
                    <span className="muted" style={{ fontSize: 12 }}>
                      Secundaria
                    </span>
                  )}
                </td>
                <td>{k.cannibalized ? <Badge label="Canibalización" cls="b-amber" /> : '—'}</td>
                <td>
                  <div className="row-actions">
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => {
                        setEditing(k)
                        setForm({
                          term: k.term,
                          page_id: k.page_id,
                          niche_id: k.niche_id,
                          project_id: k.project_id,
                          intent: k.intent,
                          note: k.note || '',
                          is_primary: Boolean(k.is_primary),
                        })
                        setOpen(true)
                      }}
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={async () => {
                        await api.keywords.remove(k.id)
                        reload()
                        toast('Eliminado')
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 24 }} className="muted">
                  No hay keywords registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        title={editing ? 'Editar keyword' : 'Nueva keyword'}
        open={open}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={save}>
              Guardar
            </button>
          </>
        }
      >
        <div className="field">
          <label>Término *</label>
          <input value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} />
        </div>

        {clashPages.length > 0 && (
          <p className="sync-error" style={{ marginTop: 0 }}>
            Este término ya está asignado a: {clashPages.join(', ')}. Si guardas, se marcará como canibalización.
          </p>
        )}

        <div className="field">
          <label>Página de destino</label>
          <select
            value={form.page_id}
            onChange={(e) => {
              const pg = pages.find((p) => p.id === Number(e.target.value))
              setForm({
                ...form,
                page_id: Number(e.target.value),
                niche_id: pg?.niche_id || 0,
                project_id: pg?.project_id || 0,
              })
            }}
          >
            {pages.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>

        <div className="field">
          <label>Intención de búsqueda</label>
          <select
            value={form.intent}
            onChange={(e) => setForm({ ...form, intent: e.target.value as Intent })}
          >
            {Object.entries(INTENTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
          <input
            type="checkbox"
            id="is_primary"
            checked={form.is_primary}
            onChange={(e) => setForm({ ...form, is_primary: e.target.checked })}
          />
          <label htmlFor="is_primary" style={{ margin: 0, cursor: 'pointer', fontWeight: 600 }}>
            ⭐ Keyword Principal de la página (Focus Keyword para Rank Math)
          </label>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: -4, marginBottom: 12 }}>
          Si marcas esta opción, reemplazará cualquier otra keyword principal asignada previamente a esta página.
        </p>

        <div className="field">
          <label>Nota / Comentario</label>
          <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </div>
      </Modal>

      {/* CLUSTERING IA MODAL */}
      {clusteringModalOpen && (
        <div className="modal-backdrop" onClick={() => setClusteringModalOpen(false)}>
          <div
            className="modal-box"
            style={{ maxWidth: 860, width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17 }}>🧠 Auto-Clustering IA de Palabras Clave</h3>
                <p className="t-sub" style={{ margin: '4px 0 0 0' }}>
                  Se han agrupado <strong>{items.length} keywords</strong> en <strong>{clusters.length} clusters temáticos</strong>.
                  Revisa los títulos sugeridos y marca los que quieras convertir en páginas.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => setClusteringModalOpen(false)}
                style={{ fontSize: 18, lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', margin: '16px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {clusters.map((c) => {
                const isSelected = selectedClusterIds.includes(c.cluster_id)
                const edit = clusterEdits[c.cluster_id] || {
                  title: c.suggested_title,
                  h1: c.suggested_h1,
                  type: c.suggested_type,
                  niche_id: niches[0]?.id || 0,
                  parent_page_id: null,
                }

                return (
                  <div
                    key={c.cluster_id}
                    style={{
                      border: `1px solid ${isSelected ? '#3b82f6' : '#e2e8f0'}`,
                      borderRadius: 8,
                      padding: 14,
                      background: isSelected ? '#f0f9ff' : '#fff',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0 }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedClusterIds((prev) => [...prev, c.cluster_id])
                            } else {
                              setSelectedClusterIds((prev) => prev.filter((id) => id !== c.cluster_id))
                            }
                          }}
                        />
                        <strong style={{ fontSize: 15, color: '#0f172a' }}>{c.cluster_name}</strong>
                      </label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Badge label={INTENTS[c.intent]?.label || c.intent} cls={INTENTS[c.intent]?.cls || 'b-blue'} />
                        <span className="badge" style={{ background: '#e0e7ff', color: '#3730a3' }}>
                          {c.keyword_ids.length} keywords
                        </span>
                      </div>
                    </div>

                    <div style={{ fontSize: 13, marginBottom: 8 }}>
                      <span style={{ fontWeight: 600, color: '#854d0e' }}>★ Focus KW:</span> {c.focus_keyword}
                      {c.secondary_keywords.length > 0 && (
                        <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
                          (Secundarias: {c.secondary_keywords.slice(0, 3).join(', ')}{c.secondary_keywords.length > 3 ? '...' : ''})
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', gap: 10, marginTop: 10, paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                            Título de la Página
                          </label>
                          <input
                            type="text"
                            value={edit.title}
                            onChange={(e) => {
                              setClusterEdits((prev) => ({
                                ...prev,
                                [c.cluster_id]: { ...edit, title: e.target.value },
                              }))
                            }}
                            style={{ fontSize: 12 }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                            H1 Explícito
                          </label>
                          <input
                            type="text"
                            value={edit.h1}
                            onChange={(e) => {
                              setClusterEdits((prev) => ({
                                ...prev,
                                [c.cluster_id]: { ...edit, h1: e.target.value },
                              }))
                            }}
                            style={{ fontSize: 12 }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                            Tipo de Página
                          </label>
                          <select
                            value={edit.type}
                            onChange={(e) => {
                              setClusterEdits((prev) => ({
                                ...prev,
                                [c.cluster_id]: { ...edit, type: e.target.value as PageType },
                              }))
                            }}
                            style={{ fontSize: 12 }}
                          >
                            {Object.entries(PAGE_TYPES).map(([k, v]) => (
                              <option key={k} value={k}>{v.label}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                            Nicho
                          </label>
                          <select
                            value={edit.niche_id}
                            onChange={(e) => {
                              setClusterEdits((prev) => ({
                                ...prev,
                                [c.cluster_id]: { ...edit, niche_id: Number(e.target.value) },
                              }))
                            }}
                            style={{ fontSize: 12 }}
                          >
                            {niches.map((n) => (
                              <option key={n.id} value={n.id}>{n.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="muted" style={{ fontSize: 13 }}>
                {selectedClusterIds.length} clusters seleccionados para crear / actualizar páginas
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn" onClick={() => setClusteringModalOpen(false)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleApplyClusters}
                  disabled={applyingClusters || selectedClusterIds.length === 0}
                >
                  {applyingClusters ? 'Aplicando clusters...' : `✓ Crear Páginas y Asignar Keywords (${selectedClusterIds.length})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}