import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { phase2Api } from '../../api/phase2-client'
import { AiResultView } from '../../components/AiResultView'
import { Badge } from '../../components/Badge'
import { ScopeBar } from '../../components/ScopeBar'
import { PAGE_TYPES } from '../../constants'
import { useApp } from '../../context/AppContext'
import { useProjects } from '../../hooks/useProjects'
import type {
  PageTypeCode,
  ResearchBudget,
  ResearchCaps,
  ResearchJob,
  ResearchJobDetail,
} from '../../types/phase2'

const STATUS: Record<string, { label: string; cls: string }> = {
  queued: { label: 'En cola', cls: 'b-gray' },
  running: { label: 'Ejecutando', cls: 'b-blue' },
  done: { label: 'Listo', cls: 'b-green' },
  error: { label: 'Error', cls: 'b-amber' },
}

type Tab = 'report' | 'keywords' | 'serp' | 'snapshot' | 'backlinks' | 'opps'

export function ResearchPage() {
  const { scopeProject, setScopeProject, toast } = useApp()
  const { projects } = useProjects()
  const effectiveProject = scopeProject === 'all' ? projects[0]?.id : scopeProject

  const [caps, setCaps] = useState<ResearchCaps | null>(null)
  const [budget, setBudget] = useState<ResearchBudget | null>(null)
  const [jobs, setJobs] = useState<ResearchJob[]>([])
  const [detail, setDetail] = useState<ResearchJobDetail | null>(null)
  const [tab, setTab] = useState<Tab>('report')
  const [running, setRunning] = useState(false)

  const [noSite, setNoSite] = useState(false)
  const [siteUrl, setSiteUrl] = useState('')
  const [comp1, setComp1] = useState('')
  const [comp2, setComp2] = useState('')
  const [comp3, setComp3] = useState('')
  const [keywordsText, setKeywordsText] = useState('')
  const [country, setCountry] = useState('es')
  const [language, setLanguage] = useState('es')
  const [pageType, setPageType] = useState<PageTypeCode>('TSG')

  const reloadMeta = async () => {
    try {
      const [c, b] = await Promise.all([phase2Api.research.caps(), phase2Api.research.budget()])
      setCaps(c)
      setBudget(b)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudieron cargar caps/presupuesto')
    }
  }

  const reloadJobs = async () => {
    try {
      const list = await phase2Api.research.list(scopeProject)
      setJobs(list)
    } catch (e) {
      setJobs([])
      toast(e instanceof Error ? e.message : 'No se pudieron cargar análisis')
    }
  }

  useEffect(() => {
    void reloadMeta()
  }, [])

  useEffect(() => {
    void reloadJobs()
    setDetail(null)
  }, [scopeProject])

  const seedKeywords = useMemo(
    () =>
      keywordsText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
    [keywordsText],
  )

  const competitorUrls = useMemo(
    () => [comp1, comp2, comp3].map((u) => u.trim()).filter(Boolean),
    [comp1, comp2, comp3],
  )

  const openJob = async (id: number) => {
    try {
      const d = await phase2Api.research.get(id)
      setDetail(d)
      setTab('report')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al abrir análisis')
    }
  }

  const start = async () => {
    if (!effectiveProject) return toast('Selecciona un proyecto')
    if (budget?.hard_blocked) return toast('Tope mensual hard alcanzado')
    if (caps && seedKeywords.length > caps.max_seed_keywords) {
      return toast(`Máximo ${caps.max_seed_keywords} keywords semilla`)
    }
    if (caps && competitorUrls.length > caps.max_competitors) {
      return toast(`Máximo ${caps.max_competitors} competidores`)
    }
    setRunning(true)
    try {
      const d = await phase2Api.research.start({
        project_id: effectiveProject,
        site_url: noSite ? null : siteUrl.trim() || null,
        competitor_urls: competitorUrls,
        seed_keywords: seedKeywords,
        country,
        language,
        page_type: pageType,
      })
      setDetail(d)
      setTab('report')
      await reloadJobs()
      await reloadMeta()
      toast(
        d.used_stub
          ? 'Análisis stub listo (sin gasto DataForSEO). Revisa el informe.'
          : 'Análisis completado',
      )
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al analizar')
    } finally {
      setRunning(false)
    }
  }

  return (
    <>
      <ScopeBar projects={projects} value={scopeProject} onChange={setScopeProject} />

      <div className="banner">
        <strong>Análisis SEO (Option 2 · DataForSEO).</strong> Pack real acotado: volumen/CPC, related keywords,
        SERP orgánico, snapshot on-page (1 URL), backlinks + link gap. Manual (no auto-noche). Historial gratis al
        reabrir.{' '}
        <Link to="/help#option2">Guía y caps →</Link>
        {' · '}
        <Link to="/products">Productos</Link>
      </div>

      {caps && (
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="section-head">
            <h2 style={{ fontSize: 15 }}>Estado de integración</h2>
            <span className={caps.credentials_configured && !caps.force_stub ? 't-title' : 'muted'}>
              {caps.force_stub
                ? 'FORCE STUB activo'
                : caps.credentials_configured
                  ? '● DataForSEO live listo'
                  : '○ Sin credenciales → stub (0 € API)'}
            </span>
          </div>
          <p className="muted" style={{ fontSize: 13, margin: '0 0 8px' }}>
            Máx. {caps.max_competitors} competidores · {caps.max_seed_keywords} keywords semilla ·{' '}
            {caps.max_serp_queries} SERP · {caps.max_backlinks_per_domain} ref. domains/dominio · soft{' '}
            {caps.soft_monthly_eur} € / hard {caps.hard_monthly_eur || 'off'} €
            {budget && (
              <>
                {' '}
                · mes {budget.year_month}: {budget.runs_count} runs, {budget.spend_eur.toFixed(2)} €
                {budget.soft_warning ? ' ⚠ soft' : ''}
                {budget.hard_blocked ? ' ⛔ hard' : ''}
              </>
            )}
          </p>
          {!caps.credentials_configured && (
            <p style={{ fontSize: 13, margin: 0 }}>
              Para datos reales: define <code className="mono">DATAFORSEO_LOGIN</code> y{' '}
              <code className="mono">DATAFORSEO_PASSWORD</code> en Railway (API Access de DataForSEO), redeploy, y
              vuelve aquí. Ver <Link to="/help#option2">ayuda Option 2</Link>.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-2" style={{ gap: 16, marginBottom: 22, alignItems: 'start' }}>
        <div className="card card-pad">
          <h2 style={{ fontSize: 15, marginBottom: 12 }}>Nuevo análisis</h2>

          <div className="field">
            <label>
              <input
                type="checkbox"
                checked={noSite}
                onChange={(e) => setNoSite(e.target.checked)}
                style={{ marginRight: 8 }}
              />
              Proyecto sin web aún (solo keywords / competidores)
            </label>
          </div>

          {!noSite && (
            <div className="field">
              <label>URL principal (máx. 1)</label>
              <input
                placeholder="https://www.ejemplo.com"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
              />
            </div>
          )}

          <div className="field">
            <label>Competidores (máx. {caps?.max_competitors ?? 3})</label>
            <input placeholder="https://rival1.com" value={comp1} onChange={(e) => setComp1(e.target.value)} />
            <input
              placeholder="https://rival2.com"
              value={comp2}
              onChange={(e) => setComp2(e.target.value)}
              style={{ marginTop: 8 }}
            />
            <input
              placeholder="https://rival3.com"
              value={comp3}
              onChange={(e) => setComp3(e.target.value)}
              style={{ marginTop: 8 }}
            />
          </div>

          <div className="field">
            <label>
              Keywords semilla (una por línea, máx. {caps?.max_seed_keywords ?? 20}) — {seedKeywords.length}{' '}
              ahora
            </label>
            <textarea
              rows={5}
              value={keywordsText}
              onChange={(e) => setKeywordsText(e.target.value)}
              placeholder={'placas solares\ninstalación solar\n...' }
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label>País</label>
              <input value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>
            <div className="field">
              <label>Idioma</label>
              <input value={language} onChange={(e) => setLanguage(e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>Tipo de contenido principal</label>
            <select value={pageType} onChange={(e) => setPageType(e.target.value as PageTypeCode)}>
              {Object.entries(PAGE_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={running || !!budget?.hard_blocked}
            onClick={start}
          >
            {running ? 'Analizando…' : 'Analizar proyecto'}
          </button>
          <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            Re-leer un análisis pasado no llama a DataForSEO. Un re-run crea un snapshot nuevo.
          </p>
        </div>

        <div className="card">
          <div className="card-pad section-head">
            <h2 style={{ fontSize: 15 }}>Historial</h2>
          </div>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Coste est.</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => {
                const s = STATUS[j.status] || STATUS.queued
                return (
                  <tr key={j.id}>
                    <td className="muted">{new Date(j.created_at).toLocaleString('es-ES')}</td>
                    <td>
                      <Badge label={s.label} cls={s.cls} />
                      {j.used_stub && <span className="muted"> · stub</span>}
                    </td>
                    <td>{j.estimated_cost_eur.toFixed(2)} €</td>
                    <td>
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => openJob(j.id)}>
                        Ver
                      </button>
                    </td>
                  </tr>
                )
              })}
              {!jobs.length && (
                <tr>
                  <td colSpan={4} className="empty">
                    Aún no hay análisis en este proyecto.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detail && (
        <div className="card card-pad">
          <div className="section-head">
            <div>
              <h2 style={{ fontSize: 15 }}>Resultado #{detail.id}</h2>
              <div className="muted" style={{ fontSize: 12.5 }}>
                {detail.site_url || 'Sin URL'} · {detail.seed_keywords.length} seeds ·{' '}
                {detail.competitor_urls.length} comps
                {detail.used_stub ? ' · datos stub' : ''}
                {detail.error_message ? ` · ${detail.error_message}` : ''}
              </div>
            </div>
            {detail.ai_report && (
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => {
                  void navigator.clipboard.writeText(detail.ai_report || '')
                  toast('Informe copiado')
                }}
              >
                Copiar informe
              </button>
            )}
          </div>

          <div className="assistant-tabs" style={{ marginBottom: 14 }}>
            {(
              [
                ['report', 'Informe IA'],
                ['keywords', `Keywords (${detail.keywords.length})`],
                ['serp', `SERP (${detail.serp_rows.length})`],
                ['snapshot', `Snapshot (${detail.page_snapshots.length})`],
                ['backlinks', `Backlinks (${detail.backlink_summaries.length})`],
                ['opps', `Oportunidades (${detail.opportunities.length})`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`assistant-tab${tab === id ? ' active' : ''}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'report' && (
            <AiResultView text={detail.ai_report || ''} emptyMessage="Sin informe aún." />
          )}

          {tab === 'keywords' && (
            <table>
              <thead>
                <tr>
                  <th>Término</th>
                  <th>Volumen</th>
                  <th>Intención</th>
                  <th>CPC</th>
                  <th>Comp.</th>
                  <th>Fuente</th>
                </tr>
              </thead>
              <tbody>
                {detail.keywords.map((k) => (
                  <tr key={k.id}>
                    <td className="t-title">{k.term}</td>
                    <td>{k.volume.toLocaleString('es-ES')}</td>
                    <td>{k.intent || '—'}</td>
                    <td>{k.cpc.toFixed(2)} €</td>
                    <td>{k.competition || '—'}</td>
                    <td className="muted">{k.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'serp' && (
            <table>
              <thead>
                <tr>
                  <th>Query</th>
                  <th>Pos</th>
                  <th>Título</th>
                  <th>Dominio</th>
                </tr>
              </thead>
              <tbody>
                {detail.serp_rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.query}</td>
                    <td>{r.position}</td>
                    <td className="t-sub">{r.title || r.url}</td>
                    <td className="mono">{r.domain}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'snapshot' && (
            <div>
              {detail.page_snapshots.map((s) => (
                <div key={s.id} style={{ marginBottom: 16 }}>
                  <p>
                    <strong>URL:</strong> <span className="mono">{s.url}</span>
                  </p>
                  <p>
                    <strong>Title:</strong> {s.title || '—'}
                  </p>
                  <p>
                    <strong>Meta:</strong> {s.meta_description || '—'}
                  </p>
                  <p className="muted">H1: {s.h1_json}</p>
                  <p className="muted">H2: {s.h2_json}</p>
                  <p className="muted">H3: {s.h3_json}</p>
                  <p className="muted">Links: {s.links_json}</p>
                </div>
              ))}
              {!detail.page_snapshots.length && <p className="empty">Sin snapshot (no había URL o stub sin sitio).</p>}
            </div>
          )}

          {tab === 'backlinks' && (
            <>
              <table>
                <thead>
                  <tr>
                    <th>Dominio</th>
                    <th>Rol</th>
                    <th>Backlinks</th>
                    <th>Ref. domains</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.backlink_summaries.map((b) => (
                    <tr key={b.id}>
                      <td className="mono">{b.domain}</td>
                      <td>{b.is_target ? 'Tu sitio' : 'Competidor'}</td>
                      <td>{b.backlinks_count}</td>
                      <td>{b.referring_domains}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h3 style={{ fontSize: 14, marginTop: 18 }}>Link gap (oportunidades)</h3>
              <table>
                <thead>
                  <tr>
                    <th>Dominio que enlaza</th>
                    <th>Competidor</th>
                    <th>Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.link_gaps.map((g) => (
                    <tr key={g.id}>
                      <td className="mono">{g.domain}</td>
                      <td className="mono">{g.linked_to_competitor}</td>
                      <td className="t-sub">{g.note || '—'}</td>
                    </tr>
                  ))}
                  {!detail.link_gaps.length && (
                    <tr>
                      <td colSpan={3} className="empty">
                        Sin gaps en este run.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </>
          )}

          {tab === 'opps' && (
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Título</th>
                  <th>Detalle</th>
                  <th>Prioridad</th>
                </tr>
              </thead>
              <tbody>
                {detail.opportunities.map((o) => (
                  <tr key={o.id}>
                    <td className="mono">{o.kind}</td>
                    <td className="t-title">{o.title}</td>
                    <td className="t-sub">{o.detail || '—'}</td>
                    <td>{o.priority}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  )
}
