import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { Modal } from '../components/Modal'
import { useApp } from '../context/AppContext'
import { useProjects } from '../hooks/useProjects'
import type { Project } from '../types'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function ProjectsPage() {
  const { setTopbarAction, toast } = useApp()
  const { projects, reload } = useProjects()
  const [editing, setEditing] = useState<Project | null>(null)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    setTopbarAction(
      <button className="btn btn-primary" onClick={() => { setEditing(null); setName(''); setDescription(''); setOpen(true) }}>
        + Nuevo proyecto
      </button>,
    )
    return () => setTopbarAction(null)
  }, [setTopbarAction])

  const save = async () => {
    if (!name.trim()) return toast('El nombre es obligatorio')
    try {
      if (editing) {
        await api.projects.update(editing.id, { name, description })
      } else {
        await api.projects.create({ name, description })
      }
      setOpen(false)
      reload()
      toast('Proyecto guardado')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error')
    }
  }

  return (
    <>
      <div className="card">
        <table>
          <thead><tr><th>Nombre</th><th>Descripción</th><th>Creado</th><th></th></tr></thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id}>
                <td className="t-title">{p.name}</td>
                <td className="muted">{p.description || '—'}</td>
                <td className="muted">{fmtDate(p.created_at)}</td>
                <td>
                  <div className="row-actions">
                    <button className="btn btn-sm btn-ghost" onClick={() => { setEditing(p); setName(p.name); setDescription(p.description || ''); setOpen(true) }}>Editar</button>
                    <button className="btn btn-sm btn-danger" onClick={async () => { await api.projects.remove(p.id); reload(); toast('Eliminado') }}>Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        title={editing ? 'Editar proyecto' : 'Nuevo proyecto'}
        open={open}
        onClose={() => setOpen(false)}
        footer={<><button className="btn" onClick={() => setOpen(false)}>Cancelar</button><button className="btn btn-primary" onClick={save}>Guardar</button></>}
      >
        <div className="field"><label>Nombre</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label>Descripción</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      </Modal>
    </>
  )
}