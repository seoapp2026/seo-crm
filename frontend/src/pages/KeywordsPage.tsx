import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { Badge } from '../components/Badge'
import { Modal } from '../components/Modal'
import { ScopeBar } from '../components/ScopeBar'
import { INTENTS } from '../constants'
import { useApp } from '../context/AppContext'
import { useProjects } from '../hooks/useProjects'
import type { Intent, Keyword, Niche, Page } from '../types'

export function KeywordsPage() {
  const { scopeProject, setScopeProject, setTopbarAction, toast } = useApp()
  const { projects } = useProjects()
  const [items, setItems] = useState<Keyword[]>([])
  const [pages, setPages] = useState<Page[]>([])
  const [, setNiches] = useState<Niche[]>([])
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

  useEffect(() => {
    setTopbarAction(
      <button
        className="btn btn-primary"
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
      </button>,
    )
    return () => setTopbarAction(null)
  }, [pages, setTopbarAction])

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
    </>
  )
}