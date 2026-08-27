import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { phase2Api } from '../../api/phase2-client'
import { AiResultView } from '../../components/AiResultView'
import { ScopeBar } from '../../components/ScopeBar'
import { useApp } from '../../context/AppContext'
import { useProjects } from '../../hooks/useProjects'
import type { Niche, Page } from '../../types'
import type { AiPrompt, Competitor } from '../../types/phase2'

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
      toast(
        res.used_metrics
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

            <button
              type="button"
              className="btn btn-primary"
              onClick={run}
              disabled={loading || !current}
              style={{ width: '100%' }}
            >
              {loading ? 'Generando respuesta…' : `Ejecutar "${current?.name || 'Asistente'}"`}
            </button>
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
              emptyMessage="Selecciona un asistente de la biblioteca y pulsa Ejecutar. El análisis o contenido se mostrará estructurado con títulos y listas legibles."
            />
          </div>
        </div>
      </div>
    </>
  )
}