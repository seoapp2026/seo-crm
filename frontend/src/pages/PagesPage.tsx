import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { Badge } from '../components/Badge'
import { Modal } from '../components/Modal'
import { ScopeBar } from '../components/ScopeBar'
import { PAGE_STATES, PAGE_TYPES } from '../constants'
import { useApp } from '../context/AppContext'
import { useProjects } from '../hooks/useProjects'
import type { Niche, Page, PageState, PageType } from '../types'

export function PagesPage() {
  const { scopeProject, setScopeProject, setTopbarAction, toast } = useApp()
  const { projects } = useProjects()
  const [items, setItems] = useState<Page[]>([])
  const [niches, setNiches] = useState<Niche[]>([])
  const [editing, setEditing] = useState<Page | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ title: '', niche_id: 0, project_id: 0, type: 'TSG' as PageType, state: 'borrador' as PageState, objective: '' })

  const reload = async () => {
    const [pages, nicheList] = await Promise.all([api.pages.list(scopeProject), api.niches.list(scopeProject)])
    setItems(pages)
    setNiches(nicheList)
  }

  useEffect(() => { reload() }, [scopeProject])
  useEffect(() => {
    setTopbarAction(<button className="btn btn-primary" onClick={() => {
      const n = niches[0]
      setEditing(null)
      setForm({ title: '', niche_id: n?.id || 0, project_id: n?.project_id || projects[0]?.id || 0, type: 'TSG', state: 'borrador', objective: '' })
      setOpen(true)
    }}>+ Nueva página</button>)
    return () => setTopbarAction(null)
  }, [niches, projects, setTopbarAction])

  const save = async () => {
    if (!form.title.trim()) return toast('El título es obligatorio')
    try {
      if (editing) await api.pages.update(editing.id, form)
      else await api.pages.create(form)
      setOpen(false); reload(); toast('Página guardada')
    } catch (e) { toast(e instanceof Error ? e.message : 'Error') }
  }

  const nicheName = (id: number) => niches.find((n) => n.id === id)?.name || '—'

  return (
    <>
      <ScopeBar projects={projects} value={scopeProject} onChange={setScopeProject} />
      <div className="card">
        <table>
          <thead><tr><th>Título</th><th>Nicho</th><th>Tipo</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td><div className="t-title">{p.title}</div><div className="t-sub">{p.objective}</div></td>
                <td>{nicheName(p.niche_id)}</td>
                <td><span className={`pill-type pt-${p.type}`}>{p.type}</span></td>
                <td><Badge label={PAGE_STATES[p.state].label} cls={PAGE_STATES[p.state].cls} /></td>
                <td><div className="row-actions">
                  <button className="btn btn-sm btn-ghost" onClick={() => { setEditing(p); setForm({ title: p.title, niche_id: p.niche_id, project_id: p.project_id, type: p.type, state: p.state, objective: p.objective || '' }); setOpen(true) }}>Editar</button>
                  <button className="btn btn-sm btn-danger" onClick={async () => { await api.pages.remove(p.id); reload(); toast('Eliminado') }}>Eliminar</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal title={editing ? 'Editar página' : 'Nueva página'} open={open} onClose={() => setOpen(false)}
        footer={<><button className="btn" onClick={() => setOpen(false)}>Cancelar</button><button className="btn btn-primary" onClick={save}>Guardar</button></>}>
        <div className="field"><label>Título</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div className="field"><label>Nicho</label><select value={form.niche_id} onChange={(e) => {
          const niche = niches.find((n) => n.id === Number(e.target.value))
          setForm({ ...form, niche_id: Number(e.target.value), project_id: niche?.project_id || form.project_id })
        }}>{niches.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select></div>
        <div className="field-row">
          <div className="field"><label>Tipo</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as PageType })}>{Object.entries(PAGE_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
          <div className="field"><label>Estado</label><select value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value as PageState })}>{Object.entries(PAGE_STATES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
        </div>
        <div className="field"><label>Objetivo</label><textarea value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} /></div>
      </Modal>
    </>
  )
}