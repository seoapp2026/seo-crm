import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { AiResultView } from '../components/AiResultView'
import { ScopeBar } from '../components/ScopeBar'
import { PAGE_TYPES } from '../constants'
import { useApp } from '../context/AppContext'
import { useProjects } from '../hooks/useProjects'
import type { Keyword, Niche, Page } from '../types'

export function AiPage() {
  const { scopeProject, setScopeProject, toast } = useApp()
  const { projects } = useProjects()
  const [pages, setPages] = useState<Page[]>([])
  const [niches, setNiches] = useState<Niche[]>([])
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [pageId, setPageId] = useState<number>(0)
  const [model, setModel] = useState('gpt-4o-mini')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      api.pages.list(scopeProject),
      api.niches.list(scopeProject),
      api.keywords.list(scopeProject),
    ]).then(([pgs, ncs, kws]) => {
      setPages(pgs); setNiches(ncs); setKeywords(kws)
      if (pgs[0]) setPageId(pgs[0].id)
    })
  }, [scopeProject])

  const page = pages.find((p) => p.id === pageId)
  const niche = page ? niches.find((n) => n.id === page.niche_id) : null
  const pageKws = keywords.filter((k) => k.page_id === pageId)

  const generate = async () => {
    if (!pageId) return toast('Selecciona una página')
    setLoading(true)
    try {
      const res = await api.ai.generate(pageId, model)
      setResult(res.rendered)
      toast('Borrador generado — revisa antes de publicar')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al generar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <ScopeBar projects={projects} value={scopeProject} onChange={setScopeProject} />

      <div className="banner">
        <strong>Sistema supervisado.</strong> La IA genera borradores editables a partir de la página, su tipo (TSG/TSR/TSA) y sus keywords.
        Tú siempre revisas, editas y publicas manualmente. Nada se publica solo.{' '}
        <Link to="/help">Ver guía completa →</Link>
      </div>

      <div className="card">
        <div className="ai-zone">
          <div className="ai-config">
            <div className="field">
              <label>Página de destino</label>
              {pages.length ? (
                <select value={pageId} onChange={(e) => setPageId(Number(e.target.value))}>
                  {pages.map((p) => <option key={p.id} value={p.id}>{p.title} · {p.type}</option>)}
                </select>
              ) : <p className="muted">No hay páginas. Crea una primero.</p>}
            </div>

            {page && (
              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 14 }}>
                <div><strong>Tipo:</strong> {PAGE_TYPES[page.type]?.label}</div>
                <div><strong>Nicho:</strong> {niche?.name}</div>
                <div><strong>Keywords:</strong> {pageKws.map((k) => k.term).join(', ') || '—'}</div>
              </div>
            )}

            <div className="field">
              <label>Modelo</label>
              <select value={model} onChange={(e) => setModel(e.target.value)}>
                <option value="gpt-4o-mini">gpt-4o-mini (rápido y económico)</option>
                <option value="gpt-4o">gpt-4o (mayor calidad)</option>
              </select>
            </div>

            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={generate} disabled={!pages.length || loading}>
              {loading ? 'Generando...' : 'Generar borrador'}
            </button>
          </div>

          <div className="ai-output">
            <div className="section-head">
              <div>
                <h2 style={{ fontSize: 15 }}>Borrador generado</h2>
                <div className="muted" style={{ fontSize: 12.5 }}>
                  Formateado para lectura · copia el texto y edítalo fuera antes de publicar
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
              emptyMessage="El borrador aparecerá aquí con títulos, listas y meta legibles."
            />
          </div>
        </div>
      </div>
    </>
  )
}