import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { Modal } from '../components/Modal'
import { ScopeBar } from '../components/ScopeBar'
import { useApp } from '../context/AppContext'
import { useProjects } from '../hooks/useProjects'
import type { Note } from '../types'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function NotesPage() {
  const { scopeProject, setScopeProject, setTopbarAction, toast } = useApp()
  const { projects } = useProjects()
  const [items, setItems] = useState<Note[]>([])
  const [editing, setEditing] = useState<Note | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ title: '', project_id: 0, body: '' })

  const reload = () => api.notes.list(scopeProject).then(setItems)

  useEffect(() => { reload() }, [scopeProject])
  useEffect(() => {
    setTopbarAction(<button className="btn btn-primary" onClick={() => {
      setEditing(null)
      setForm({ title: '', project_id: projects[0]?.id || 0, body: '' })
      setOpen(true)
    }}>+ Nueva nota</button>)
    return () => setTopbarAction(null)
  }, [projects, setTopbarAction])

  const save = async () => {
    if (!form.title.trim()) return toast('El título es obligatorio')
    try {
      if (editing) await api.notes.update(editing.id, form)
      else await api.notes.create(form)
      setOpen(false); reload(); toast('Nota guardada')
    } catch (e) { toast(e instanceof Error ? e.message : 'Error') }
  }

  const projectName = (id: number) => projects.find((p) => p.id === id)?.name || '—'

  return (
    <>
      <ScopeBar projects={projects} value={scopeProject} onChange={setScopeProject} />
      <div className="grid grid-2">
        {items.map((n) => (
          <div key={n.id} className="card card-pad">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div className="t-title" style={{ fontSize: 15 }}>{n.title}</div>
                <div className="t-sub">{projectName(n.project_id)} · {fmtDate(n.created_at)}</div>
              </div>
              <div className="row-actions">
                <button className="btn btn-sm btn-ghost" onClick={() => { setEditing(n); setForm({ title: n.title, project_id: n.project_id, body: n.body || '' }); setOpen(true) }}>Editar</button>
                <button className="btn btn-sm btn-danger" onClick={async () => { await api.notes.remove(n.id); reload(); toast('Eliminado') }}>Eliminar</button>
              </div>
            </div>
            <p style={{ marginTop: 10, color: 'var(--ink-soft)', whiteSpace: 'pre-wrap' }}>{n.body}</p>
          </div>
        ))}
      </div>

      <Modal title={editing ? 'Editar nota' : 'Nueva nota'} open={open} onClose={() => setOpen(false)}
        footer={<><button className="btn" onClick={() => setOpen(false)}>Cancelar</button><button className="btn btn-primary" onClick={save}>Guardar</button></>}>
        <div className="field"><label>Título</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div className="field"><label>Proyecto</label><select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: Number(e.target.value) })}>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div className="field"><label>Contenido</label><textarea style={{ minHeight: 140 }} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
      </Modal>
    </>
  )
}