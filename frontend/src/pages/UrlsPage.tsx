import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { Badge } from '../components/Badge'
import { Modal } from '../components/Modal'
import { ScopeBar } from '../components/ScopeBar'
import { INDEX_STATES } from '../constants'
import { useApp } from '../context/AppContext'
import { useProjects } from '../hooks/useProjects'
import type { IndexedStatus, Page, Url } from '../types'

export function UrlsPage() {
  const { scopeProject, setScopeProject, setTopbarAction, toast } = useApp()
  const { projects } = useProjects()
  const [items, setItems] = useState<Url[]>([])
  const [pages, setPages] = useState<Page[]>([])
  const [editing, setEditing] = useState<Url | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ slug: '', page_id: 0, niche_id: 0, project_id: 0, indexed: 'pendiente' as IndexedStatus, status: '' })

  const reload = async () => {
    const [urls, pgs] = await Promise.all([api.urls.list(scopeProject), api.pages.list(scopeProject)])
    setItems(urls); setPages(pgs)
  }

  useEffect(() => { reload() }, [scopeProject])
  useEffect(() => {
    setTopbarAction(<button className="btn btn-primary" onClick={() => {
      const pg = pages[0]
      setEditing(null)
      setForm({ slug: '', page_id: pg?.id || 0, niche_id: pg?.niche_id || 0, project_id: pg?.project_id || 0, indexed: 'pendiente', status: '' })
      setOpen(true)
    }}>+ Nueva URL</button>)
    return () => setTopbarAction(null)
  }, [pages, setTopbarAction])

  const save = async () => {
    if (!form.slug.trim()) return toast('El slug es obligatorio')
    try {
      if (editing) await api.urls.update(editing.id, form)
      else await api.urls.create(form)
      setOpen(false); reload(); toast('URL guardada')
    } catch (e) { toast(e instanceof Error ? e.message : 'Error') }
  }

  const pageTitle = (id: number) => pages.find((p) => p.id === id)?.title || '—'

  return (
    <>
      <ScopeBar projects={projects} value={scopeProject} onChange={setScopeProject} />
      <div className="card">
        <table>
          <thead><tr><th>Slug</th><th>Página</th><th>Indexación</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id}>
                <td className="mono">{u.slug}</td>
                <td>{pageTitle(u.page_id)}</td>
                <td><Badge label={INDEX_STATES[u.indexed].label} cls={INDEX_STATES[u.indexed].cls} /></td>
                <td className="muted">{u.status || '—'}</td>
                <td><div className="row-actions">
                  <button className="btn btn-sm btn-ghost" onClick={() => { setEditing(u); setForm({ slug: u.slug, page_id: u.page_id, niche_id: u.niche_id, project_id: u.project_id, indexed: u.indexed, status: u.status || '' }); setOpen(true) }}>Editar</button>
                  <button className="btn btn-sm btn-danger" onClick={async () => { await api.urls.remove(u.id); reload(); toast('Eliminado') }}>Eliminar</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal title={editing ? 'Editar URL' : 'Nueva URL'} open={open} onClose={() => setOpen(false)}
        footer={<><button className="btn" onClick={() => setOpen(false)}>Cancelar</button><button className="btn btn-primary" onClick={save}>Guardar</button></>}>
        <div className="field"><label>Slug</label><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="/mi-pagina" /></div>
        <div className="field"><label>Página</label><select value={form.page_id} onChange={(e) => {
          const pg = pages.find((p) => p.id === Number(e.target.value))
          setForm({ ...form, page_id: Number(e.target.value), niche_id: pg?.niche_id || 0, project_id: pg?.project_id || 0 })
        }}>{pages.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
        <div className="field-row">
          <div className="field"><label>Indexación</label><select value={form.indexed} onChange={(e) => setForm({ ...form, indexed: e.target.value as IndexedStatus })}>{Object.entries(INDEX_STATES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
          <div className="field"><label>Estado</label><input value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} /></div>
        </div>
      </Modal>
    </>
  )
}