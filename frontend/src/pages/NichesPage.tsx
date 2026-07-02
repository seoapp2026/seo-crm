import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { Badge } from '../components/Badge'
import { Modal } from '../components/Modal'
import { ScopeBar } from '../components/ScopeBar'
import { MONETIZATION, NICHE_STATES } from '../constants'
import { useApp } from '../context/AppContext'
import { useProjects } from '../hooks/useProjects'
import type { Niche, NicheState, Monetization } from '../types'

export function NichesPage() {
  const { scopeProject, setScopeProject, setTopbarAction, toast } = useApp()
  const { projects } = useProjects()
  const [items, setItems] = useState<Niche[]>([])
  const [editing, setEditing] = useState<Niche | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', topic: '', project_id: 0, state: 'nuevo' as NicheState, monetization: 'afiliacion' as Monetization, notes: '' })

  const reload = () => api.niches.list(scopeProject).then(setItems)

  useEffect(() => { reload() }, [scopeProject])
  useEffect(() => {
    setTopbarAction(<button className="btn btn-primary" onClick={() => {
      setEditing(null)
      setForm({ name: '', topic: '', project_id: projects[0]?.id || 0, state: 'nuevo', monetization: 'afiliacion', notes: '' })
      setOpen(true)
    }}>+ Nuevo nicho</button>)
    return () => setTopbarAction(null)
  }, [projects, setTopbarAction])

  const save = async () => {
    if (!form.name.trim()) return toast('El nombre es obligatorio')
    try {
      if (editing) await api.niches.update(editing.id, form)
      else await api.niches.create(form)
      setOpen(false); reload(); toast('Nicho guardado')
    } catch (e) { toast(e instanceof Error ? e.message : 'Error') }
  }

  const projectName = (id: number) => projects.find((p) => p.id === id)?.name || '—'

  return (
    <>
      <ScopeBar projects={projects} value={scopeProject} onChange={setScopeProject} />
      <div className="card">
        <table>
          <thead><tr><th>Nicho</th><th>Proyecto</th><th>Estado</th><th>Monetización</th><th></th></tr></thead>
          <tbody>
            {items.map((n) => (
              <tr key={n.id}>
                <td><div className="t-title">{n.name}</div><div className="t-sub">{n.topic}</div></td>
                <td>{projectName(n.project_id)}</td>
                <td><Badge label={NICHE_STATES[n.state].label} cls={NICHE_STATES[n.state].cls} /></td>
                <td>{MONETIZATION[n.monetization]}</td>
                <td><div className="row-actions">
                  <button className="btn btn-sm btn-ghost" onClick={() => { setEditing(n); setForm({ name: n.name, topic: n.topic || '', project_id: n.project_id, state: n.state, monetization: n.monetization, notes: n.notes || '' }); setOpen(true) }}>Editar</button>
                  <button className="btn btn-sm btn-danger" onClick={async () => { await api.niches.remove(n.id); reload(); toast('Eliminado') }}>Eliminar</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal title={editing ? 'Editar nicho' : 'Nuevo nicho'} open={open} onClose={() => setOpen(false)}
        footer={<><button className="btn" onClick={() => setOpen(false)}>Cancelar</button><button className="btn btn-primary" onClick={save}>Guardar</button></>}>
        <div className="field"><label>Nombre</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="field"><label>Tema</label><input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} /></div>
        <div className="field"><label>Proyecto</label><select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: Number(e.target.value) })}>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div className="field-row">
          <div className="field"><label>Estado</label><select value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value as NicheState })}>{Object.entries(NICHE_STATES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
          <div className="field"><label>Monetización</label><select value={form.monetization} onChange={(e) => setForm({ ...form, monetization: e.target.value as Monetization })}>{Object.entries(MONETIZATION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        </div>
        <div className="field"><label>Notas</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
      </Modal>
    </>
  )
}