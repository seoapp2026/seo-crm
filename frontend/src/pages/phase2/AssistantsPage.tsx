import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { phase2Api } from '../../api/phase2-client'
import { ScopeBar } from '../../components/ScopeBar'
import { useApp } from '../../context/AppContext'
import { useProjects } from '../../hooks/useProjects'
import type { Niche, Page } from '../../types'
import type { AiPrompt, AssistantSlug, Competitor } from '../../types/phase2'

const ASSISTANT_ORDER: AssistantSlug[] = [
  'seo_architect',
  'keyword_classifier',
  'content_generator',
  'competitor_analyst',
  'continuous_optimizer',
]

export function AssistantsPage() {
  const { scopeProject, setScopeProject, setTopbarAction, toast } = useApp()
  const { projects } = useProjects()
  const [prompts, setPrompts] = useState<AiPrompt[]>([])
  const [pages, setPages] = useState<Page[]>([])
  const [niches, setNiches] = useState<Niche[]>([])
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [active, setActive] = useState<AssistantSlug>('seo_architect')
  const [pageId, setPageId] = useState(0)
  const [nicheId, setNicheId] = useState(0)
  const [competitorId, setCompetitorId] = useState(0)
  const [extra, setExtra] = useState('')
  const [model, setModel] = useState('gpt-4o-mini')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)

  const effectiveProject = scopeProject === 'all' ? projects[0]?.id : scopeProject

  useEffect(() => {
    phase2Api.prompts.list().then((ps) => {
      setPrompts(ps)
      if (ps[0]) setModel(ps[0].model_default)
    })
  }, [])

  useEffect(() => {
    if (effectiveProject) {
      Promise.all([
        api.pages.list(effectiveProject),
        api.niches.list(effectiveProject),
        phase2Api.competitors.list(effectiveProject),
      ]).then(([pgs, ncs, comps]) => {
        setPages(pgs)
        setNiches(ncs)
        setCompetitors(comps)
        if (pgs[0]) setPageId(pgs[0].id)
        if (ncs[0]) setNicheId(ncs[0].id)
        if (comps[0]) setCompetitorId(comps[0].id)
      })
    }
  }, [effectiveProject])

  useEffect(() => {
    setTopbarAction(
      <Link to="/prompts" className="btn btn-sm">Editor de prompts</Link>,
    )
    return () => setTopbarAction(null)
  }, [setTopbarAction])

  useEffect(() => {
    const p = prompts.find((x) => x.slug === active)
    if (p) setModel(p.model_default)
  }, [active, prompts])

  const current = prompts.find((p) => p.slug === active)

  const run = async () => {
    if (!effectiveProject) return toast('Selecciona un proyecto')
    setLoading(true)
    try {
      const res = await phase2Api.assistants.run({
        assistant: active,
        project_id: effectiveProject,
        page_id: pageId || undefined,
        niche_id: nicheId || undefined,
        competitor_id: competitorId || undefined,
        extra_context: extra || undefined,
        model,
      })
      setResult(res.rendered)
      toast(
        res.used_metrics
          ? 'Análisis generado con métricas GSC/Analytics'
          : 'Borrador generado — revisa antes de publicar',
      )
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <ScopeBar projects={projects} value={scopeProject} onChange={setScopeProject} />

      <div className="banner">
        <strong>5 asistentes IA especializados.</strong> Cada uno usa un prompt editable desde la base de datos. El Generador y el Optimizador enriquecen respuestas con métricas reales cuando GSC/Analytics están conectados. Siempre supervisado.
      </div>

      <div className="assistant-tabs">
        {ASSISTANT_ORDER.map((slug) => {
          const p = prompts.find((x) => x.slug === slug)
          return (
            <button
              key={slug}
              type="button"
              className={`assistant-tab${active === slug ? ' active' : ''}`}
              onClick={() => { setActive(slug); setResult('') }}
            >
              {p?.name || slug}
            </button>
          )
        })}
      </div>

      <div className="card">
        <div className="ai-zone">
          <div className="ai-config">
            <p className="t-sub" style={{ marginBottom: 16 }}>{current?.description}</p>

            {(active === 'seo_architect' || active === 'keyword_classifier') && (
              <div className="field">
                <label>Nicho</label>
                <select value={nicheId} onChange={(e) => setNicheId(Number(e.target.value))}>
                  {niches.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              </div>
            )}

            {(active === 'content_generator' || active === 'continuous_optimizer') && (
              <div className="field">
                <label>Página</label>
                <select value={pageId} onChange={(e) => setPageId(Number(e.target.value))}>
                  {pages.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
                {(active === 'content_generator' || active === 'continuous_optimizer') && (
                  <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    {active === 'content_generator' ? 'Usará métricas GSC/GA4 si están sincronizadas.' : 'Analiza tendencias de la página seleccionada.'}
                  </p>
                )}
              </div>
            )}

            {active === 'competitor_analyst' && (
              <div className="field">
                <label>Competidor</label>
                {competitors.length ? (
                  <select value={competitorId} onChange={(e) => setCompetitorId(Number(e.target.value))}>
                    {competitors.map((c) => <option key={c.id} value={c.id}>{c.domain}</option>)}
                  </select>
                ) : (
                  <p className="muted">Añade competidores primero.</p>
                )}
              </div>
            )}

            <div className="field">
              <label>Contexto adicional (opcional)</label>
              <textarea value={extra} onChange={(e) => setExtra(e.target.value)} rows={3} placeholder="Instrucciones extra para esta ejecución…" />
            </div>

            <div className="field">
              <label>Modelo</label>
              <select value={model} onChange={(e) => setModel(e.target.value)}>
                <option value="gpt-4o-mini">gpt-4o-mini</option>
                <option value="gpt-4o">gpt-4o</option>
              </select>
            </div>

            <button type="button" className="btn btn-primary" onClick={run} disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Generando…' : 'Ejecutar asistente'}
            </button>
          </div>

          <div className="ai-output">
            <div className="section-head">
              <h2>Resultado</h2>
              <span className="muted">Editable · no se publica automáticamente</span>
            </div>
            <div className="ai-result">{result || 'Selecciona un asistente y ejecuta para ver el borrador.'}</div>
          </div>
        </div>
      </div>
    </>
  )
}