import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { Badge } from '../components/Badge'
import { Modal } from '../components/Modal'
import { ScopeBar } from '../components/ScopeBar'
import { PAGE_STATES, PAGE_TYPES } from '../constants'
import { useApp } from '../context/AppContext'
import { useProjects } from '../hooks/useProjects'
import type { Niche, Page, PageState, PageType } from '../types'

const CONTENT_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  borrador: { label: 'Borrador', cls: 'b-gray' },
  revisado: { label: 'Revisado', cls: 'b-blue' },
  listo_export: { label: 'Listo Exportar', cls: 'b-green' },
}

export function PagesPage() {
  const { scopeProject, setScopeProject, setTopbarAction, toast } = useApp()
  const { projects } = useProjects()
  const [items, setItems] = useState<Page[]>([])
  const [niches, setNiches] = useState<Niche[]>([])
  const [editing, setEditing] = useState<Page | null>(null)
  const [open, setOpen] = useState(false)
  const [modalTab, setModalTab] = useState<'basic' | 'seo' | 'wp' | 'content'>('basic')
  const [htmlViewMode, setHtmlViewMode] = useState<'code' | 'preview'>('code')
  const [maquetando, setMaquetando] = useState(false)

  const [form, setForm] = useState({
    title: '',
    niche_id: 0,
    project_id: 0,
    parent_page_id: null as number | null,
    type: 'TSG' as PageType,
    state: 'borrador' as PageState,
    objective: '',
    breadcrumb_label: '',
    h1: '',
    outline_json: '',
    seo_title: '',
    seo_description: '',
    wp_category: '',
    wp_tags_json: '',
    content_html: '',
    content_status: 'borrador',
    schema_json: '',
    export_ready: false,
  })

  const reload = async () => {
    const [pages, nicheList] = await Promise.all([api.pages.list(scopeProject), api.niches.list(scopeProject)])
    setItems(pages)
    setNiches(nicheList)
  }

  useEffect(() => { reload() }, [scopeProject])

  const openNew = () => {
    const n = niches[0]
    setEditing(null)
    setForm({
      title: '',
      niche_id: n?.id || 0,
      project_id: n?.project_id || projects[0]?.id || 0,
      parent_page_id: null,
      type: 'TSG',
      state: 'borrador',
      objective: '',
      breadcrumb_label: '',
      h1: '',
      outline_json: '',
      seo_title: '',
      seo_description: '',
      wp_category: '',
      wp_tags_json: '',
      content_html: '',
      content_status: 'borrador',
      schema_json: '',
      export_ready: false,
    })
    setModalTab('basic')
    setOpen(true)
  }

  useEffect(() => {
    setTopbarAction(
      <button className="btn btn-primary" onClick={openNew}>
        + Nueva página
      </button>,
    )
    return () => setTopbarAction(null)
  }, [niches, projects, setTopbarAction])

  const openEdit = (p: Page) => {
    setEditing(p)
    setForm({
      title: p.title,
      niche_id: p.niche_id,
      project_id: p.project_id,
      parent_page_id: p.parent_page_id || null,
      type: p.type,
      state: p.state,
      objective: p.objective || '',
      breadcrumb_label: p.breadcrumb_label || '',
      h1: p.h1 || '',
      outline_json: p.outline_json || '',
      seo_title: p.seo_title || '',
      seo_description: p.seo_description || '',
      wp_category: p.wp_category || '',
      wp_tags_json: p.wp_tags_json || '',
      content_html: p.content_html || '',
      content_status: p.content_status || 'borrador',
      schema_json: p.schema_json || '',
      export_ready: Boolean(p.export_ready),
    })
    setModalTab('basic')
    setOpen(true)
  }

  const save = async () => {
    if (!form.title.trim()) return toast('El título es obligatorio')
    try {
      const payload = {
        ...form,
        parent_page_id: form.parent_page_id || null,
        breadcrumb_label: form.breadcrumb_label.trim() || null,
        h1: form.h1.trim() || null,
        outline_json: form.outline_json.trim() || null,
        seo_title: form.seo_title.trim() || null,
        seo_description: form.seo_description.trim() || null,
        wp_category: form.wp_category.trim() || null,
        wp_tags_json: form.wp_tags_json.trim() || null,
        content_html: form.content_html || null,
        schema_json: form.schema_json.trim() || null,
      }
      if (editing) await api.pages.update(editing.id, payload)
      else await api.pages.create(payload)
      setOpen(false)
      reload()
      toast('Página y datos SEO guardados correctamente')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al guardar la página')
    }
  }

  const nicheName = (id: number) => niches.find((n) => n.id === id)?.name || '—'
  const parentCandidates = items.filter((p) => !editing || p.id !== editing.id)

  return (
    <>
      <ScopeBar projects={projects} value={scopeProject} onChange={setScopeProject} />
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Título / SEO</th>
              <th>Jerarquía / Silo</th>
              <th>Nicho</th>
              <th>Tipo</th>
              <th>Estado CRM</th>
              <th>Contenido</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => {
              const statusCfg = CONTENT_STATUS_LABELS[p.content_status || 'borrador'] || CONTENT_STATUS_LABELS.borrador
              return (
                <tr key={p.id}>
                  <td>
                    <div className="t-title">{p.title}</div>
                    {p.h1 && <div className="t-sub muted">H1: {p.h1}</div>}
                    {p.seo_title && <div className="t-sub" style={{ color: '#0369a1' }}>SEO: {p.seo_title}</div>}
                  </td>
                  <td>
                    {p.parent_title ? (
                      <span className="badge" style={{ background: '#f3e8ff', color: '#6b21a8' }}>
                        ↳ {p.parent_title}
                      </span>
                    ) : (
                      <span className="muted">— Pilar —</span>
                    )}
                  </td>
                  <td>{nicheName(p.niche_id)}</td>
                  <td><span className={`pill-type pt-${p.type}`}>{p.type}</span></td>
                  <td><Badge label={PAGE_STATES[p.state].label} cls={PAGE_STATES[p.state].cls} /></td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <Badge label={statusCfg.label} cls={statusCfg.cls} />
                      {p.export_ready && (
                        <span className="badge" style={{ fontSize: 10, background: '#dcfce7', color: '#15803d' }}>
                          ✓ Export Ready
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-sm btn-ghost" onClick={() => openEdit(p)}>
                        Editar
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={async () => {
                          try {
                            await api.pages.remove(p.id)
                            reload()
                            toast('Página eliminada')
                          } catch (e) {
                            toast(e instanceof Error ? e.message : 'No se pudo eliminar la página')
                          }
                        }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 24 }} className="muted">
                  No hay páginas registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        title={editing ? `Editar — ${editing.title}` : 'Nueva página'}
        open={open}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={save}>
              Guardar página
            </button>
          </>
        }
      >
        <div className="assistant-tabs" style={{ marginBottom: 16 }}>
          <button
            type="button"
            className={`assistant-tab${modalTab === 'basic' ? ' active' : ''}`}
            onClick={() => setModalTab('basic')}
          >
            1. Básico y Silo
          </button>
          <button
            type="button"
            className={`assistant-tab${modalTab === 'seo' ? ' active' : ''}`}
            onClick={() => setModalTab('seo')}
          >
            2. SEO & Rank Math
          </button>
          <button
            type="button"
            className={`assistant-tab${modalTab === 'wp' ? ' active' : ''}`}
            onClick={() => setModalTab('wp')}
          >
            3. Taxonomía WP
          </button>
          <button
            type="button"
            className={`assistant-tab${modalTab === 'content' ? ' active' : ''}`}
            onClick={() => setModalTab('content')}
          >
            4. HTML & Outline
          </button>
        </div>

        {modalTab === 'basic' && (
          <>
            <div className="field">
              <label>Título de la página *</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>

            <div className="field">
              <label>Página Padre (Estructura Silo / Cluster)</label>
              <select
                value={form.parent_page_id || 0}
                onChange={(e) => setForm({ ...form, parent_page_id: Number(e.target.value) || null })}
              >
                <option value={0}>— Ninguna (Es una página Pilar raíz) —</option>
                {parentCandidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({c.type})
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Nicho</label>
              <select
                value={form.niche_id}
                onChange={(e) => {
                  const niche = niches.find((n) => n.id === Number(e.target.value))
                  setForm({ ...form, niche_id: Number(e.target.value), project_id: niche?.project_id || form.project_id })
                }}
              >
                {niches.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
              </select>
            </div>

            <div className="field-row">
              <div className="field">
                <label>Tipo de página</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as PageType })}>
                  {Object.entries(PAGE_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Estado CRM</label>
                <select value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value as PageState })}>
                  {Object.entries(PAGE_STATES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>

            <div className="field">
              <label>Objetivo de la página</label>
              <textarea value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} rows={2} />
            </div>
          </>
        )}

        {modalTab === 'seo' && (
          <>
            <div className="field">
              <label>H1 Explícito</label>
              <input
                value={form.h1}
                onChange={(e) => setForm({ ...form, h1: e.target.value })}
                placeholder="ej. Las 7 Mejores Aspiradoras Sin Cable de 2026"
              />
            </div>

            <div className="field">
              <label>SEO Title (Rank Math / Meta Title)</label>
              <input
                value={form.seo_title}
                onChange={(e) => setForm({ ...form, seo_title: e.target.value })}
                placeholder="ej. Mejores Aspiradoras Sin Cable (2026) — Guía y Opiniones"
              />
            </div>

            <div className="field">
              <label>SEO Meta Description (Rank Math)</label>
              <textarea
                value={form.seo_description}
                onChange={(e) => setForm({ ...form, seo_description: e.target.value })}
                rows={3}
                placeholder="ej. Análisis comparativo de las mejores aspiradoras sin cable. Opiniones reales, potencia, autonomía y precios."
              />
            </div>

            <div className="field">
              <label>Etiqueta Breadcrumb (Miga de pan)</label>
              <input
                value={form.breadcrumb_label}
                onChange={(e) => setForm({ ...form, breadcrumb_label: e.target.value })}
                placeholder="ej. Sin Cable"
              />
            </div>
          </>
        )}

        {modalTab === 'wp' && (
          <>
            <div className="field">
              <label>Categoría WordPress</label>
              <input
                value={form.wp_category}
                onChange={(e) => setForm({ ...form, wp_category: e.target.value })}
                placeholder="ej. Aspiradoras o Hogar > Limpieza"
              />
            </div>

            <div className="field">
              <label>Etiquetas WordPress (JSON o lista)</label>
              <input
                value={form.wp_tags_json}
                onChange={(e) => setForm({ ...form, wp_tags_json: e.target.value })}
                placeholder='ej. ["sin cable", "bateria", "2026"]'
                className="mono"
              />
            </div>

            <div className="field-row">
              <div className="field">
                <label>Estado de Redacción / Maquetación</label>
                <select
                  value={form.content_status}
                  onChange={(e) => setForm({ ...form, content_status: e.target.value })}
                >
                  <option value="borrador">Borrador (en redacción)</option>
                  <option value="revisado">Revisado (supervisado)</option>
                  <option value="listo_export">Listo para Exportar a WP</option>
                </select>
              </div>
              <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 24 }}>
                <input
                  type="checkbox"
                  id="export_ready"
                  checked={form.export_ready}
                  onChange={(e) => setForm({ ...form, export_ready: e.target.checked })}
                />
                <label htmlFor="export_ready" style={{ margin: 0, cursor: 'pointer' }}>
                  Marcar como lista para exportar
                </label>
              </div>
            </div>

            <div className="field">
              <label>Schema / Datos Estructurados (JSON-LD)</label>
              <textarea
                value={form.schema_json}
                onChange={(e) => setForm({ ...form, schema_json: e.target.value })}
                rows={3}
                placeholder='ej. {"@context": "https://schema.org", "@type": "Article"}'
                className="mono"
              />
            </div>
          </>
        )}

        {modalTab === 'content' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className={`btn btn-sm${htmlViewMode === 'code' ? ' btn-primary' : ' btn-ghost'}`}
                  onClick={() => setHtmlViewMode('code')}
                >
                  Editor Código
                </button>
                <button
                  type="button"
                  className={`btn btn-sm${htmlViewMode === 'preview' ? ' btn-primary' : ' btn-ghost'}`}
                  onClick={() => setHtmlViewMode('preview')}
                >
                  Vista Previa
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {editing && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ background: '#4f46e5', color: '#fff', border: 'none' }}
                    disabled={maquetando}
                    onClick={async () => {
                      setMaquetando(true)
                      try {
                        const res = await api.ai.maquetar({
                          page_id: editing.id,
                          save_to_page: true,
                        })
                        setForm((prev) => ({
                          ...prev,
                          content_html: res.content_html,
                          content_status: 'revisado',
                        }))
                        toast('Maquetación generada con éxito y aplicada')
                      } catch (e) {
                        toast(e instanceof Error ? e.message : 'Error al maquetar')
                      } finally {
                        setMaquetando(false)
                      }
                    }}
                  >
                    {maquetando ? 'Generando...' : '⚡ Generar Maquetación IA'}
                  </button>
                )}
                {form.content_html && (
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(form.content_html)
                      toast('HTML copiado al portapapeles')
                    }}
                  >
                    Copiar HTML
                  </button>
                )}
              </div>
            </div>

            <div className="field">
              <label>Estructura / Outline JSON (H2/H3)</label>
              <textarea
                value={form.outline_json}
                onChange={(e) => setForm({ ...form, outline_json: e.target.value })}
                rows={3}
                placeholder='ej. [{"tag": "h2", "text": "Top 3 Aspiradoras"}, {"tag": "h3", "text": "Dyson V15"}]'
                className="mono"
              />
            </div>

            <div className="field">
              <label>Contenido HTML Final (Maquetado listo para WP)</label>
              {htmlViewMode === 'code' ? (
                <textarea
                  value={form.content_html}
                  onChange={(e) => setForm({ ...form, content_html: e.target.value })}
                  rows={12}
                  placeholder="<article><section class='intro'>...</section></article>"
                  className="mono"
                />
              ) : (
                <div
                  style={{
                    border: '1px solid var(--c-border, #e2e8f0)',
                    borderRadius: 6,
                    padding: 16,
                    minHeight: 250,
                    maxHeight: 400,
                    overflowY: 'auto',
                    background: '#fff',
                  }}
                  dangerouslySetInnerHTML={{ __html: form.content_html || '<p class="muted">No hay HTML para previsualizar.</p>' }}
                />
              )}
            </div>
          </>
        )}
      </Modal>
    </>
  )
}