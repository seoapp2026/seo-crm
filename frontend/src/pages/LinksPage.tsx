import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { ScopeBar } from '../components/ScopeBar'
import { Modal } from '../components/Modal'
import { useApp } from '../context/AppContext'
import { useProjects } from '../hooks/useProjects'
import type { InternalLink, Page } from '../types'

export function LinksPage() {
  const { scopeProject, setScopeProject, setTopbarAction, toast } = useApp()
  const { projects } = useProjects()
  const [items, setItems] = useState<InternalLink[]>([])
  const [pages, setPages] = useState<Page[]>([])
  const [orphans, setOrphans] = useState<Page[]>([])
  const [editing, setEditing] = useState<InternalLink | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ from_page_id: 0, to_page_id: 0, project_id: 0, anchor: '' })

  const reload = async () => {
    const [links, pgs, stats] = await Promise.all([
      api.links.list(scopeProject),
      api.pages.list(scopeProject),
      api.dashboard(scopeProject),
    ])
    setItems(links); setPages(pgs); setOrphans(stats.orphan_pages)
  }

  useEffect(() => { reload() }, [scopeProject])
  useEffect(() => {
    setTopbarAction(<button className="btn btn-primary" onClick={() => {
      const pg = pages[0]
      setEditing(null)
      setForm({ from_page_id: pg?.id || 0, to_page_id: pages[1]?.id || 0, project_id: pg?.project_id || 0, anchor: '' })
      setOpen(true)
    }}>+ Nuevo enlace</button>)
    return () => setTopbarAction(null)
  }, [pages, setTopbarAction])

  const save = async () => {
    if (form.from_page_id === form.to_page_id) return toast('Origen y destino deben ser distintos')
    try {
      if (editing) await api.links.update(editing.id, form)
      else await api.links.create(form)
      setOpen(false); reload(); toast('Enlace guardado')
    } catch (e) { toast(e instanceof Error ? e.message : 'Error') }
  }

  const pageTitle = (id: number) => pages.find((p) => p.id === id)?.title || '—'

  return (
    <>
      <ScopeBar projects={projects} value={scopeProject} onChange={setScopeProject} />

      {orphans.length > 0 && (
        <div className="banner" style={{ marginBottom: 16 }}>
          <strong>{orphans.length} páginas huérfanas:</strong>{' '}
          {orphans.map((p) => p.title).join(', ')}
        </div>
      )}

      <div className="card">
        <table>
          <thead><tr><th>Desde</th><th>Hacia</th><th>Ancla</th><th></th></tr></thead>
          <tbody>
            {items.map((l) => (
              <tr key={l.id}>
                <td>{pageTitle(l.from_page_id)}</td>
                <td>{pageTitle(l.to_page_id)}</td>
                <td className="muted">{l.anchor || '—'}</td>
                <td><div className="row-actions">
                  <button className="btn btn-sm btn-ghost" onClick={() => { setEditing(l); setForm({ from_page_id: l.from_page_id, to_page_id: l.to_page_id, project_id: l.project_id, anchor: l.anchor || '' }); setOpen(true) }}>Editar</button>
                  <button className="btn btn-sm btn-danger" onClick={async () => { await api.links.remove(l.id); reload(); toast('Eliminado') }}>Eliminar</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal title={editing ? 'Editar enlace' : 'Nuevo enlace interno'} open={open} onClose={() => setOpen(false)}
        footer={<><button className="btn" onClick={() => setOpen(false)}>Cancelar</button><button className="btn btn-primary" onClick={save}>Guardar</button></>}>
        <div className="field"><label>Desde</label><select value={form.from_page_id} onChange={(e) => {
          const pg = pages.find((p) => p.id === Number(e.target.value))
          setForm({ ...form, from_page_id: Number(e.target.value), project_id: pg?.project_id || form.project_id })
        }}>{pages.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
        <div className="field"><label>Hacia</label><select value={form.to_page_id} onChange={(e) => setForm({ ...form, to_page_id: Number(e.target.value) })}>{pages.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
        <div className="field"><label>Texto ancla</label><input value={form.anchor} onChange={(e) => setForm({ ...form, anchor: e.target.value })} /></div>
      </Modal>
    </>
  )
}