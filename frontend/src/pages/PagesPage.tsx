import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import { phase2Api } from '../api/phase2-client'
import { Badge } from '../components/Badge'
import { Modal } from '../components/Modal'
import { ScopeBar } from '../components/ScopeBar'
import { PAGE_STATES, PAGE_TYPES } from '../constants'
import { useApp } from '../context/AppContext'
import { useProjects } from '../hooks/useProjects'
import type { Niche, Page, PageBulkUpdateItem, PageState, PageType } from '../types'
import type { StructureImportResponse } from '../types/phase2'

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
  const [viewMode, setViewMode] = useState<'normal' | 'grid'>('normal')

  // Normal Modal State
  const [editing, setEditing] = useState<Page | null>(null)
  const [open, setOpen] = useState(false)
  const [modalTab, setModalTab] = useState<'basic' | 'seo' | 'wp' | 'content'>('basic')
  const [htmlViewMode, setHtmlViewMode] = useState<'code' | 'preview'>('code')
  const [maquetando, setMaquetando] = useState(false)
  const [briefLoading, setBriefLoading] = useState(false)

  // Bulk Edit Grid State
  const [gridEdits, setGridEdits] = useState<Record<number, PageBulkUpdateItem>>({})
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [savingGrid, setSavingGrid] = useState(false)
  const [syncingRankMath, setSyncingRankMath] = useState(false)

  // Light Structure Import State
  const [structureModalOpen, setStructureModalOpen] = useState(false)
  const [structureCsv, setStructureCsv] = useState(
`title,slug,niche_name,parent_slug,page_type,h1,seo_title,seo_description,focus_keyword
Cafeteras Espresso,/cafeteras-espresso,Cafeteras,,TSG,Guía Completa de Cafeteras Espresso,Mejores Cafeteras Espresso 2026,Comparativa y análisis,cafeteras espresso
Cafeteras Superautomáticas,/cafeteras-espresso/superautomaticas,Cafeteras,/cafeteras-espresso,TSR,Mejores Cafeteras Superautomáticas,Cafeteras Superautomáticas Top,Guía de compra,cafeteras superautomaticas
Cafeteras Manuales,/cafeteras-espresso/manuales,Cafeteras,/cafeteras-espresso,TSR,Cafeteras Manuales para Baristas,Cafeteras Manuales Profesionales,Análisis detallado,cafeteras manuales
Robot Aspirador Conga,/aspiradoras/conga,Aspiradoras,,TSA,Análisis Cecotec Conga,Opiniones Cecotec Conga 2026,Review con pros y contras,robot aspirador conga`
  )
  const [importingStructure, setImportingStructure] = useState(false)
  const [structureImportResult, setStructureImportResult] = useState<StructureImportResponse | null>(null)

  const effectiveProject = scopeProject === 'all' ? projects[0]?.id : scopeProject

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
    brief_text: '',
    schema_json: '',
    export_ready: false,
  })

  const reload = useCallback(async () => {
    const [pages, nicheList] = await Promise.all([
      api.pages.list(scopeProject),
      api.niches.list(scopeProject),
    ])
    setItems(pages)
    setNiches(nicheList)
    setGridEdits({})
    setSelectedIds([])
  }, [scopeProject])

  useEffect(() => { reload() }, [reload])

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
      brief_text: '',
      schema_json: '',
      export_ready: false,
    })
    setModalTab('basic')
    setOpen(true)
  }

  const handleSaveGridChanges = useCallback(async () => {
    if (!effectiveProject) return toast('Selecciona un proyecto')
    const editsToSave = Object.values(gridEdits)
    if (editsToSave.length === 0) return toast('No hay cambios pendientes de guardar')

    setSavingGrid(true)
    try {
      const res = await api.pages.bulkUpdate({
        project_id: effectiveProject,
        pages: editsToSave,
      })
      toast(`✓ ${res.updated_count} páginas actualizadas correctamente`)
      await reload()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al guardar cambios masivos')
    } finally {
      setSavingGrid(false)
    }
  }, [effectiveProject, gridEdits, reload, toast])

  const handleBulkSyncRankMath = async () => {
    if (!effectiveProject) return toast('Selecciona un proyecto')
    setSyncingRankMath(true)
    try {
      const targetIds = selectedIds.length > 0 ? selectedIds : undefined
      const res = await phase2Api.rankMath.bulkSyncMetas({
        project_id: effectiveProject,
        page_ids: targetIds,
        overwrite_existing: false,
      })
      toast(
        `✓ Rank Math optimizado: ${res.updated_titles_count} títulos y ${res.updated_descriptions_count} descripciones generadas`,
      )
      await reload()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al sincronizar metas Rank Math')
    } finally {
      setSyncingRankMath(false)
    }
  }

  const handleBulkMarkExportReady = async () => {
    if (!effectiveProject) return
    if (selectedIds.length === 0) return toast('Selecciona al menos una página')
    setSavingGrid(true)
    try {
      await api.pages.bulkUpdate({
        project_id: effectiveProject,
        pages: selectedIds.map((id) => ({ id, export_ready: true })),
      })
      toast(`✓ ${selectedIds.length} páginas marcadas como Export Ready`)
      await reload()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al actualizar páginas')
    } finally {
      setSavingGrid(false)
    }
  }

  // Keyboard shortcut Cmd+S / Ctrl+S to save grid
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        if (viewMode === 'grid' && Object.keys(gridEdits).length > 0) {
          e.preventDefault()
          void handleSaveGridChanges()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [viewMode, gridEdits, handleSaveGridChanges])

  const handleImportStructure = async () => {
    if (!effectiveProject) return toast('Selecciona un proyecto')
    if (!structureCsv.trim()) return toast('Pega el contenido CSV de la estructura')
    setImportingStructure(true)
    try {
      const res = await phase2Api.projects.importStructure({
        project_id: effectiveProject,
        csv_content: structureCsv,
      })
      setStructureImportResult(res)
      toast(`✓ Estructura importada: ${res.pages_created} páginas creadas, ${res.silos_linked} silos vinculados`)
      await reload()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al importar estructura')
    } finally {
      setImportingStructure(false)
    }
  }

  useEffect(() => {
    setTopbarAction(
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={() => {
            setStructureImportResult(null)
            setStructureModalOpen(true)
          }}
        >
          📥 Importar Estructura (CSV)
        </button>
        <button
          type="button"
          className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setViewMode((prev) => (prev === 'normal' ? 'grid' : 'normal'))}
        >
          {viewMode === 'grid' ? '📋 Vista Clásica' : '📊 Vista Cuadrícula / Edición Masiva'}
        </button>
        <button className="btn btn-sm btn-primary" onClick={openNew}>
          + Nueva página
        </button>
      </div>,
    )
    return () => setTopbarAction(null)
  }, [viewMode, niches, projects, setTopbarAction])

  const updateGridField = (page: Page, field: keyof PageBulkUpdateItem, value: any) => {
    setGridEdits((prev) => {
      const existing = prev[page.id] || { id: page.id }
      return {
        ...prev,
        [page.id]: { ...existing, [field]: value },
      }
    })
  }

  const getPageValue = (page: Page, field: keyof Page): any => {
    const edit = gridEdits[page.id]
    if (edit && field in edit) {
      return (edit as any)[field]
    }
    return page[field]
  }

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
      brief_text: (p as Page & { brief_text?: string | null }).brief_text || '',
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
        brief_text: form.brief_text.trim() || null,
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

  const renderTitleCounter = (text?: string | null) => {
    const len = (text || '').length
    const color = len === 0 ? '#94a3b8' : len <= 60 ? '#16a34a' : len <= 70 ? '#d97706' : '#dc2626'
    return <span style={{ fontSize: 11, fontWeight: 700, color, marginLeft: 4 }}>{len}/60</span>
  }

  const renderDescCounter = (text?: string | null) => {
    const len = (text || '').length
    const color = len === 0 ? '#94a3b8' : len <= 160 ? '#16a34a' : len <= 175 ? '#d97706' : '#dc2626'
    return <span style={{ fontSize: 11, fontWeight: 700, color, marginLeft: 4 }}>{len}/160</span>
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(items.map((p) => p.id))
    }
  }

  const toggleSelectRow = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const hasPendingGridEdits = Object.keys(gridEdits).length > 0

  return (
    <>
      <ScopeBar projects={projects} value={scopeProject} onChange={setScopeProject} />

      {viewMode === 'grid' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* BULK ACTIONS TOOLBAR */}
          <div
            className="card"
            style={{
              padding: '12px 18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                📊 Modo Cuadrícula Rápida: {selectedIds.length} páginas seleccionadas
              </span>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={handleBulkSyncRankMath}
                disabled={syncingRankMath}
              >
                {syncingRankMath ? 'Generando...' : '⚡ Auto-Completar Rank Math (Metas IA)'}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={handleBulkMarkExportReady}
                disabled={selectedIds.length === 0}
              >
                ✓ Marcar Export Ready
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {hasPendingGridEdits && (
                <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>
                  ⚠️ {Object.keys(gridEdits).length} páginas modificadas sin guardar
                </span>
              )}
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={handleSaveGridChanges}
                disabled={savingGrid || !hasPendingGridEdits}
              >
                {savingGrid ? 'Guardando...' : '💾 Guardar Todo (Cmd+S)'}
              </button>
            </div>
          </div>

          {/* BULK EDIT GRID TABLE */}
          <div className="card" style={{ overflowX: 'auto' }}>
            <table style={{ minWidth: 1100, fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ width: 36, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={items.length > 0 && selectedIds.length === items.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th style={{ minWidth: 200 }}>Título de Página & H1</th>
                  <th style={{ minWidth: 240 }}>
                    SEO Title (Rank Math) <span className="muted" style={{ fontWeight: 400 }}>(Max 60c)</span>
                  </th>
                  <th style={{ minWidth: 280 }}>
                    SEO Description <span className="muted" style={{ fontWeight: 400 }}>(Max 160c)</span>
                  </th>
                  <th style={{ minWidth: 100 }}>Tipo</th>
                  <th style={{ minWidth: 110 }}>Estado</th>
                  <th style={{ minWidth: 140 }}>Silo / Padre</th>
                  <th style={{ minWidth: 90, textAlign: 'center' }}>Export Ready</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => {
                  const isSelected = selectedIds.includes(p.id)
                  const isModified = Boolean(gridEdits[p.id])
                  const currentTitle = getPageValue(p, 'title')
                  const currentH1 = getPageValue(p, 'h1')
                  const currentSeoTitle = getPageValue(p, 'seo_title')
                  const currentSeoDesc = getPageValue(p, 'seo_description')
                  const currentType = getPageValue(p, 'type')
                  const currentState = getPageValue(p, 'state')
                  const currentParent = getPageValue(p, 'parent_page_id')
                  const currentExportReady = getPageValue(p, 'export_ready')

                  return (
                    <tr
                      key={p.id}
                      style={{
                        background: isSelected ? '#f0f9ff' : isModified ? '#fffbeb' : undefined,
                      }}
                    >
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(p.id)}
                        />
                      </td>

                      <td>
                        <input
                          type="text"
                          value={currentTitle || ''}
                          onChange={(e) => updateGridField(p, 'title', e.target.value)}
                          style={{ width: '100%', fontSize: 12, marginBottom: 4 }}
                          placeholder="Título..."
                        />
                        <input
                          type="text"
                          value={currentH1 || ''}
                          onChange={(e) => updateGridField(p, 'h1', e.target.value)}
                          style={{ width: '100%', fontSize: 11, color: '#0369a1' }}
                          placeholder="H1..."
                        />
                      </td>

                      <td>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 2 }}>
                          {renderTitleCounter(currentSeoTitle)}
                        </div>
                        <input
                          type="text"
                          value={currentSeoTitle || ''}
                          onChange={(e) => updateGridField(p, 'seo_title', e.target.value)}
                          style={{ width: '100%', fontSize: 12 }}
                          placeholder="Título SEO (Google / Rank Math)..."
                        />
                      </td>

                      <td>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 2 }}>
                          {renderDescCounter(currentSeoDesc)}
                        </div>
                        <textarea
                          rows={2}
                          value={currentSeoDesc || ''}
                          onChange={(e) => updateGridField(p, 'seo_description', e.target.value)}
                          style={{ width: '100%', fontSize: 11 }}
                          placeholder="Meta description..."
                        />
                      </td>

                      <td>
                        <select
                          value={currentType || 'TSG'}
                          onChange={(e) => updateGridField(p, 'type', e.target.value as PageType)}
                          style={{ fontSize: 12 }}
                        >
                          {Object.entries(PAGE_TYPES).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <select
                          value={currentState || 'borrador'}
                          onChange={(e) => updateGridField(p, 'state', e.target.value as PageState)}
                          style={{ fontSize: 12 }}
                        >
                          {Object.entries(PAGE_STATES).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <select
                          value={currentParent || 0}
                          onChange={(e) => updateGridField(p, 'parent_page_id', Number(e.target.value) || null)}
                          style={{ fontSize: 11, width: '100%' }}
                        >
                          <option value={0}>— Pilar (Raíz) —</option>
                          {items
                            .filter((cand) => cand.id !== p.id)
                            .map((cand) => (
                              <option key={cand.id} value={cand.id}>
                                ↳ {cand.title}
                              </option>
                            ))}
                        </select>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(currentExportReady)}
                          onChange={(e) => updateGridField(p, 'export_ready', e.target.checked)}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* NORMAL TABLE VIEW */
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
                            await api.pages.remove(p.id)
                            reload()
                            toast('Página eliminada')
                          }}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!items.length && (
                <tr><td colSpan={7} className="empty">No hay páginas en este proyecto.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

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

            <div className="field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label style={{ margin: 0 }}>Brief de contenido (instrucciones para la redacción)</label>
                {editing && (
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    disabled={briefLoading}
                    onClick={async () => {
                      if (!editing) return
                      setBriefLoading(true)
                      try {
                        const ps = await phase2Api.prompts.list()
                        const gen = ps.find((p) => p.slug === 'content_generator')
                        if (!gen) return toast('No se encontró el prompt de generación de contenido')
                        const data = await phase2Api.assistants.previewContext({
                          prompt_id: gen.id,
                          prompt_slug: gen.slug,
                          project_id: editing.project_id,
                          page_id: editing.id,
                        })
                        setForm((prev) => ({ ...prev, brief_text: data.user_prompt }))
                        toast('Brief sugerido generado desde el contexto — revísalo y pulsa Guardar')
                      } catch (e) {
                        toast(e instanceof Error ? e.message : 'Error al generar el brief sugerido')
                      } finally {
                        setBriefLoading(false)
                      }
                    }}
                  >
                    {briefLoading ? 'Generando...' : '✨ Generar brief sugerido'}
                  </button>
                )}
              </div>
              <textarea
                value={form.brief_text}
                onChange={(e) => setForm({ ...form, brief_text: e.target.value })}
                rows={5}
                placeholder="Brief editable: objetivo, keywords, tono, productos a mencionar, estructura deseada…"
              />
              <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Se guarda con la página y alimenta la generación de contenido.
              </p>
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
                      if (!editing) return
                      const hasExisting = Boolean(form.content_html || editing.content_html)
                      let replaceExisting = false
                      if (hasExisting) {
                        replaceExisting = window.confirm(
                          'Esta página ya tiene contenido maquetado. ¿Sobreescribirlo? Se guardará un nuevo borrador de todos modos.',
                        )
                      }
                      setMaquetando(true)
                      try {
                        const res = await api.ai.maquetar({
                          page_id: editing.id,
                          save_to_page: true,
                          replace_existing: replaceExisting,
                        } as Parameters<typeof api.ai.maquetar>[0] & { replace_existing?: boolean })
                        if (res.page_updated) {
                          setForm((prev) => ({
                            ...prev,
                            content_html: res.content_html,
                            content_status: 'revisado',
                          }))
                          toast('Maquetación generada con éxito y aplicada')
                        } else {
                          toast(
                            (res as { message?: string }).message ||
                              'Borrador maquetado guardado sin cambiar el HTML existente',
                          )
                        }
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

      {/* LIGHT SITE STRUCTURE IMPORTER MODAL */}
      <Modal
        title="📥 Importador Rápido de Estructura de Sitio (CSV / Silos / Nichos)"
        open={structureModalOpen}
        onClose={() => setStructureModalOpen(false)}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setStructureModalOpen(false)}>
              Cerrar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleImportStructure}
              disabled={importingStructure}
            >
              {importingStructure ? 'Importando...' : '⚡ Procesar e Importar Estructura'}
            </button>
          </>
        }
      >
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 13, color: '#475569', margin: '0 0 10px 0' }}>
            Importa masivamente la arquitectura completa de tu web. El importador crea automáticamente los <strong>nichos</strong>, <strong>páginas (TSG/TSR/TSA)</strong>, <strong>URLs limpias</strong>, vincula la jerarquía de <strong>Silos Padre-Hijo</strong> y etiqueta las <strong>Keywords Principales</strong> en un solo paso.
          </p>

          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => {
                setStructureCsv(
`title,slug,niche_name,parent_slug,page_type,h1,seo_title,seo_description,focus_keyword
Cafeteras Espresso,/cafeteras-espresso,Cafeteras,,TSG,Guía Completa de Cafeteras Espresso,Mejores Cafeteras Espresso 2026,Comparativa y análisis,cafeteras espresso
Cafeteras Superautomáticas,/cafeteras-espresso/superautomaticas,Cafeteras,/cafeteras-espresso,TSR,Mejores Cafeteras Superautomáticas,Cafeteras Superautomáticas Top,Guía de compra,cafeteras superautomaticas
Cafeteras Manuales,/cafeteras-espresso/manuales,Cafeteras,/cafeteras-espresso,TSR,Cafeteras Manuales para Baristas,Cafeteras Manuales Profesionales,Análisis detallado,cafeteras manuales
Robot Aspirador Conga,/aspiradoras/conga,Aspiradoras,,TSA,Análisis Cecotec Conga,Opiniones Cecotec Conga 2026,Review con pros y contras,robot aspirador conga`
                )
              }}
            >
              🔄 Cargar Ejemplo Multinicho & Silos
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => {
                setStructureCsv(
`title,slug,niche_name,parent_slug,page_type,h1,seo_title,seo_description,focus_keyword
`
                )
              }}
            >
              🧹 Limpiar
            </button>
          </div>

          <textarea
            value={structureCsv}
            onChange={(e) => setStructureCsv(e.target.value)}
            rows={10}
            className="mono"
            placeholder="title,slug,niche_name,parent_slug,page_type,h1,seo_title,seo_description,focus_keyword..."
            style={{ width: '100%', fontSize: 12 }}
          />
        </div>

        {structureImportResult && (
          <div
            style={{
              marginTop: 14,
              padding: 14,
              borderRadius: 8,
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
            }}
          >
            <h4 style={{ margin: '0 0 8px 0', color: '#166534', fontSize: 14 }}>
              ✓ Importación Completada con Éxito
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, fontSize: 12 }}>
              <div>🏢 Proyecto: <strong>{structureImportResult.project_name}</strong></div>
              <div>📂 Nichos creados: <strong>{structureImportResult.niches_created}</strong></div>
              <div>📄 Páginas creadas: <strong>{structureImportResult.pages_created}</strong></div>
              <div>🔗 Silos vinculados: <strong>{structureImportResult.silos_linked}</strong></div>
              <div>🔑 Keywords enlazadas: <strong>{structureImportResult.keywords_linked}</strong></div>
              <div>🌐 URLs registradas: <strong>{structureImportResult.urls_created}</strong></div>
            </div>
            {structureImportResult.errors.length > 0 && (
              <div style={{ marginTop: 10, color: '#dc2626', fontSize: 12 }}>
                <strong>Avisos / Errores leves:</strong>
                <ul>
                  {structureImportResult.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}