import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { phase2Api } from '../../api/phase2-client'
import { AiResultView } from '../../components/AiResultView'
import { ScopeBar } from '../../components/ScopeBar'
import { useApp } from '../../context/AppContext'
import { useProjects } from '../../hooks/useProjects'
import type { Niche, Page } from '../../types'
import type { AiPrompt, Competitor, ContextPreviewResponse } from '../../types/phase2'

export function AssistantsPage() {
  const { scopeProject, setScopeProject, setTopbarAction, toast } = useApp()
  const { projects } = useProjects()
  const [prompts, setPrompts] = useState<AiPrompt[]>([])
  const [pages, setPages] = useState<Page[]>([])
  const [niches, setNiches] = useState<Niche[]>([])
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [activePromptId, setActivePromptId] = useState<number>(0)
  const [pageId, setPageId] = useState(0)
  const [nicheId, setNicheId] = useState(0)
  const [competitorId, setCompetitorId] = useState(0)
  const [extra, setExtra] = useState('')
  const [model, setModel] = useState('gpt-4o-mini')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [previewData, setPreviewData] = useState<ContextPreviewResponse | null>(null)
  const [previewTab, setPreviewTab] = useState<'entities' | 'user' | 'system' | 'full'>('entities')
  const [previewLoading, setPreviewLoading] = useState(false)

  const effectiveProject = scopeProject === 'all' ? projects[0]?.id : scopeProject

  useEffect(() => {
    phase2Api.prompts.list()
      .then((ps) => {
        setPrompts(ps)
        if (ps.length > 0) {
          setActivePromptId(ps[0].id)
          setModel(ps[0].model_default)
        }
      })
      .catch((e) => toast(e instanceof Error ? e.message : 'No se pudieron cargar los prompts'))
  }, [toast])

  useEffect(() => {
    if (effectiveProject) {
      Promise.all([
        api.pages.list(effectiveProject),
        api.niches.list(effectiveProject),
        phase2Api.competitors.list(effectiveProject),
      ])
        .then(([pgs, ncs, comps]) => {
          setPages(pgs)
          setNiches(ncs)
          setCompetitors(comps)
          if (pgs[0]) setPageId(pgs[0].id)
          if (ncs[0]) setNicheId(ncs[0].id)
          if (comps[0]) setCompetitorId(comps[0].id)
        })
        .catch((e) => toast(e instanceof Error ? e.message : 'Error al cargar contexto del asistente'))
    }
  }, [effectiveProject, toast])

  useEffect(() => {
    setTopbarAction(
      <Link to="/prompts" className="btn btn-sm">
        Biblioteca de prompts
      </Link>,
    )
    return () => setTopbarAction(null)
  }, [setTopbarAction])

  const current = prompts.find((p) => p.id === activePromptId) || prompts[0]

  useEffect(() => {
    if (current) {
      setModel(current.model_default)
    }
  }, [current])

  const run = async () => {
    if (!effectiveProject) return toast('Selecciona un proyecto')
    if (!current) return toast('Selecciona un prompt de la biblioteca')
    setLoading(true)
    try {
      const res = await phase2Api.assistants.run({
        prompt_id: current.id,
        prompt_slug: current.slug,
        assistant: current.slug,
        project_id: effectiveProject,
        page_id: pageId || undefined,
        niche_id: nicheId || undefined,
        competitor_id: competitorId || undefined,
        extra_context: extra || undefined,
        model,
      })
      setResult(res.rendered)
      const draftId = (res as { draft_id?: number | null }).draft_id
      toast(
        draftId
          ? `Guardado como borrador #${draftId}`
          : res.used_metrics
            ? 'Análisis generado con métricas GSC/Analytics'
            : 'Borrador generado — revisa antes de publicar',
      )
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al ejecutar el asistente')
    } finally {
      setLoading(false)
    }
  }

  // Helper to determine relevant context inputs
  const slug = current?.slug || ''
  const showNiche = slug.includes('niche') || slug.includes('architect') || slug.includes('classifier') || niches.length > 0
  const showPage = slug.includes('content') || slug.includes('generator') || slug.includes('optimizer') || slug.includes('maquetad') || pages.length > 0
  const showCompetitor = slug.includes('competitor') || competitors.length > 0

  return (
    <>
      <ScopeBar projects={projects} value={scopeProject} onChange={setScopeProject} />

      <div className="banner">
        <strong>Asistentes IA Dinámicos.</strong> Ejecuta cualquier rol o prompt de tu biblioteca (<Link to="/prompts">editar prompts</Link>) contra los datos reales de tu proyecto, nichos, páginas o métricas.
        Siempre supervisado — el resultado se formatea para lectura; no se publica solo.{' '}
        <Link to="/help#ia">Cómo funciona la IA →</Link>
      </div>

      <div className="assistant-tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {prompts.map((p) => {
          const isActive = (current?.id === p.id)
          return (
            <button
              key={p.id}
              type="button"
              className={`assistant-tab${isActive ? ' active' : ''}`}
              onClick={() => {
                setActivePromptId(p.id)
                setResult('')
              }}
            >
              {p.name}
            </button>
          )
        })}
      </div>

      <div className="card">
        <div className="ai-zone">
          <div className="ai-config">
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: 16 }}>{current?.name || 'Asistente'}</h3>
              <p className="t-sub" style={{ margin: 0 }}>{current?.description || 'Sin descripción'}</p>
              <div className="muted mono" style={{ fontSize: 11, marginTop: 4 }}>
                slug: {current?.slug}
              </div>
            </div>

            {showNiche && niches.length > 0 && (
              <div className="field">
                <label>Nicho de referencia (opcional)</label>
                <select value={nicheId} onChange={(e) => setNicheId(Number(e.target.value))}>
                  <option value={0}>— Ninguno / Todo el proyecto —</option>
                  {niches.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              </div>
            )}

            {showPage && pages.length > 0 && (
              <div className="field">
                <label>Página de destino (opcional)</label>
                <select value={pageId} onChange={(e) => setPageId(Number(e.target.value))}>
                  <option value={0}>— Ninguna / General —</option>
                  {pages.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
                {pageId > 0 && (
                  <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    Se incluirán keywords y métricas de rendimiento 28d si están sincronizadas.
                  </p>
                )}
              </div>
            )}

            {showCompetitor && competitors.length > 0 && (
              <div className="field">
                <label>Competidor de referencia (opcional)</label>
                <select value={competitorId} onChange={(e) => setCompetitorId(Number(e.target.value))}>
                  <option value={0}>— Ninguno —</option>
                  {competitors.map((c) => <option key={c.id} value={c.id}>{c.domain}</option>)}
                </select>
              </div>
            )}

            <div className="field">
              <label>Contexto adicional (opcional)</label>
              <textarea
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                rows={3}
                placeholder="Instrucciones específicas o datos extra para esta ejecución…"
              />
            </div>

            <div className="field">
              <label>Modelo LLM</label>
              <select value={model} onChange={(e) => setModel(e.target.value)}>
                <option value="gpt-4o-mini">gpt-4o-mini</option>
                <option value="gpt-4o">gpt-4o</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ flex: 1 }}
                disabled={previewLoading || !current || !effectiveProject}
                onClick={async () => {
                  if (!effectiveProject || !current) return
                  setPreviewLoading(true)
                  try {
                    const data = await phase2Api.assistants.previewContext({
                      prompt_id: current.id,
                      prompt_slug: current.slug,
                      assistant: current.slug,
                      project_id: effectiveProject,
                      page_id: pageId || undefined,
                      niche_id: nicheId || undefined,
                      competitor_id: competitorId || undefined,
                      extra_context: extra || undefined,
                      model,
                    })
                    setPreviewData(data)
                    setPreviewTab('entities')
                    setPreviewModalOpen(true)
                  } catch (e) {
                    toast(e instanceof Error ? e.message : 'Error al generar vista previa')
                  } finally {
                    setPreviewLoading(false)
                  }
                }}
              >
                {previewLoading ? 'Cargando...' : '👁️ Ver Contexto Completo'}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={run}
                disabled={loading || !current}
                style={{ flex: 2 }}
              >
                {loading ? 'Generando respuesta…' : `Ejecutar "${current?.name || 'Asistente'}"`}
              </button>
            </div>
          </div>

          <div className="ai-output">
            <div className="section-head">
              <div>
                <h2 style={{ fontSize: 15 }}>Resultado</h2>
                <div className="muted" style={{ fontSize: 12.5 }}>
                  Formateado · no se publica automáticamente
                </div>
              </div>
              {result && (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => {
                    void navigator.clipboard.writeText(result)
                    toast('Texto copiado')
                  }}
                >
                  Copiar texto
                </button>
              )}
            </div>
            <AiResultView
              text={result}
              emptyMessage="Selecciona un asistente de la biblioteca y pulsa Ejecutar o Ver Contexto Completo para inspeccionar qué datos se enviarán a la IA."
            />
          </div>
        </div>
      </div>

      {previewModalOpen && previewData && (
        <div className="modal-backdrop" onClick={() => setPreviewModalOpen(false)}>
          <div
            className="modal-box"
            style={{ maxWidth: 840, width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17 }}>Contexto Resuelto — {previewData.prompt_name}</h3>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <span className="badge" style={{ background: '#f1f5f9', color: '#334155' }}>
                    🤖 {previewData.model}
                  </span>
                  <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                    📝 ~{previewData.word_count} palabras
                  </span>
                  <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>
                    ⚡ ~{previewData.estimated_tokens} tokens
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => setPreviewModalOpen(false)}
                style={{ fontSize: 18, lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <div className="assistant-tabs" style={{ margin: '16px 0 12px 0' }}>
              <button
                type="button"
                className={`assistant-tab${previewTab === 'entities' ? ' active' : ''}`}
                onClick={() => setPreviewTab('entities')}
              >
                1. Entidades Resueltas
              </button>
              <button
                type="button"
                className={`assistant-tab${previewTab === 'user' ? ' active' : ''}`}
                onClick={() => setPreviewTab('user')}
              >
                2. Prompt de Usuario
              </button>
              <button
                type="button"
                className={`assistant-tab${previewTab === 'system' ? ' active' : ''}`}
                onClick={() => setPreviewTab('system')}
              >
                3. Prompt de Sistema
              </button>
              <button
                type="button"
                className={`assistant-tab${previewTab === 'full' ? ' active' : ''}`}
                onClick={() => setPreviewTab('full')}
              >
                4. Prompt Completo Raw
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4, minHeight: 280 }}>
              {previewTab === 'entities' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    <strong style={{ fontSize: 13, color: '#0f172a' }}>Proyecto & Nicho:</strong>
                    <div style={{ marginTop: 4, fontSize: 13 }}>
                      <strong>{previewData.resolved_entities.project_name}</strong>
                      {previewData.resolved_entities.niche_name && (
                        <span> → {previewData.resolved_entities.niche_name} ({previewData.resolved_entities.monetization})</span>
                      )}
                    </div>
                    {previewData.resolved_entities.layout_template && (
                      <div style={{ marginTop: 6, fontSize: 12, color: '#475569', background: '#fff', padding: 8, borderRadius: 4 }}>
                        <strong>Reglas de Maquetación:</strong> {previewData.resolved_entities.layout_template}
                      </div>
                    )}
                  </div>

                  {previewData.resolved_entities.page_title && (
                    <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                      <strong style={{ fontSize: 13, color: '#0f172a' }}>Página & SEO:</strong>
                      <div style={{ marginTop: 4, fontSize: 13 }}>
                        <strong>{previewData.resolved_entities.page_title}</strong> ({previewData.resolved_entities.page_type})
                      </div>
                      {previewData.resolved_entities.h1 && (
                        <div style={{ fontSize: 12, color: '#0369a1', marginTop: 2 }}>
                          H1: {previewData.resolved_entities.h1}
                        </div>
                      )}
                      {previewData.resolved_entities.parent_page && (
                        <div style={{ fontSize: 12, color: '#6b21a8', marginTop: 2 }}>
                          ↳ Silo Padre: {previewData.resolved_entities.parent_page}
                        </div>
                      )}
                    </div>
                  )}

                  {(previewData.resolved_entities.focus_keyword || previewData.resolved_entities.secondary_keywords) && (
                    <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                      <strong style={{ fontSize: 13, color: '#0f172a' }}>Palabras Clave:</strong>
                      {previewData.resolved_entities.focus_keyword && (
                        <div style={{ marginTop: 4, fontSize: 13, color: '#854d0e', fontWeight: 600 }}>
                          ★ Focus: {previewData.resolved_entities.focus_keyword}
                        </div>
                      )}
                      {previewData.resolved_entities.secondary_keywords && (
                        <div style={{ marginTop: 2, fontSize: 12, color: '#475569' }}>
                          Secundarias: {previewData.resolved_entities.secondary_keywords.join(', ')}
                        </div>
                      )}
                    </div>
                  )}

                  {previewData.resolved_entities.competitor_domain && (
                    <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                      <strong style={{ fontSize: 13, color: '#0f172a' }}>Competidor:</strong>
                      <div style={{ marginTop: 4, fontSize: 13 }}>
                        {previewData.resolved_entities.competitor_domain}
                      </div>
                    </div>
                  )}

                  {previewData.resolved_entities.metrics && (
                    <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                      <strong style={{ fontSize: 13, color: '#0f172a' }}>Métricas 28d:</strong>
                      <div style={{ marginTop: 4, fontSize: 12, color: '#047857' }}>
                        Clicks: {previewData.resolved_entities.metrics.clicks_28d} | Impresiones: {previewData.resolved_entities.metrics.impressions_28d} | Posición: {previewData.resolved_entities.metrics.position_28d?.toFixed(1)}
                      </div>
                    </div>
                  )}

                  {previewData.resolved_entities.extra_instructions && (
                    <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                      <strong style={{ fontSize: 13, color: '#0f172a' }}>Instrucciones Extra:</strong>
                      <div style={{ marginTop: 4, fontSize: 12, color: '#334155' }}>
                        {previewData.resolved_entities.extra_instructions}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {previewTab === 'user' && (
                <textarea
                  readOnly
                  value={previewData.user_prompt}
                  rows={14}
                  className="mono"
                  style={{ width: '100%', fontSize: 12, background: '#f8fafc' }}
                />
              )}

              {previewTab === 'system' && (
                <textarea
                  readOnly
                  value={previewData.system_prompt}
                  rows={14}
                  className="mono"
                  style={{ width: '100%', fontSize: 12, background: '#f8fafc' }}
                />
              )}

              {previewTab === 'full' && (
                <textarea
                  readOnly
                  value={previewData.full_prompt_text}
                  rows={16}
                  className="mono"
                  style={{ width: '100%', fontSize: 12, background: '#f8fafc' }}
                />
              )}
            </div>

            <div
              className="modal-footer"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 16,
                paddingTop: 12,
                borderTop: '1px solid #e2e8f0',
              }}
            >
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  navigator.clipboard.writeText(previewData.full_prompt_text)
                  toast('Prompt completo copiado al portapapeles')
                }}
              >
                📋 Copiar Prompt Completo
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn" onClick={() => setPreviewModalOpen(false)}>
                  Cerrar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setPreviewModalOpen(false)
                    run()
                  }}
                  disabled={loading}
                >
                  ⚡ Ejecutar ahora
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}