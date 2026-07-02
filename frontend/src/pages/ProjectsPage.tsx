import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { Modal } from '../components/Modal'
import { useApp } from '../context/AppContext'
import { useProjects } from '../hooks/useProjects'
import type { Project } from '../types'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

const emptyForm = () => ({
  name: '',
  description: '',
  gsc_site_url: '',
  ga4_property_id: '',
})

export function ProjectsPage() {
  const { setTopbarAction, toast } = useApp()
  const { projects, reload } = useProjects()
  const [editing, setEditing] = useState<Project | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm())

  useEffect(() => {
    setTopbarAction(
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => {
          setEditing(null)
          setForm(emptyForm())
          setOpen(true)
        }}
      >
        + Nuevo proyecto
      </button>,
    )
    return () => setTopbarAction(null)
  }, [setTopbarAction])

  const openEdit = (p: Project) => {
    setEditing(p)
    setForm({
      name: p.name,
      description: p.description || '',
      gsc_site_url: p.gsc_site_url || '',
      ga4_property_id: p.ga4_property_id || '',
    })
    setOpen(true)
  }

  const save = async () => {
    if (!form.name.trim()) return toast('El nombre es obligatorio')
    if (!editing && !form.gsc_site_url.trim()) {
      return toast('La URL de Search Console es obligatoria por proyecto')
    }
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        gsc_site_url: form.gsc_site_url || undefined,
        ga4_property_id: form.ga4_property_id || undefined,
      }
      if (editing) await api.projects.update(editing.id, payload)
      else await api.projects.create(payload)
      setOpen(false)
      reload()
      toast('Proyecto guardado')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error')
    }
  }

  return (
    <>
      <div className="banner">
        <strong>Un proyecto = un sitio web.</strong> Cada proyecto tiene su propia URL de Search Console y Property ID de GA4.
        Usa la URL exacta de GSC (prefijo de URL), por ejemplo <code className="mono">https://www.tusitio.com/</code>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Search Console</th>
              <th>GA4</th>
              <th>Creado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="t-title">{p.name}</div>
                  <div className="t-sub">{p.description || '—'}</div>
                </td>
                <td className="mono t-sub">{p.gsc_site_url || '—'}</td>
                <td className="mono t-sub">{p.ga4_property_id || '—'}</td>
                <td className="muted">{fmtDate(p.created_at)}</td>
                <td>
                  <div className="row-actions">
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => openEdit(p)}>Editar</button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={async () => {
                        await api.projects.remove(p.id)
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
          </tbody>
        </table>
      </div>

      <Modal
        title={editing ? 'Editar proyecto' : 'Nuevo proyecto'}
        open={open}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setOpen(false)}>Cancelar</button>
            <button type="button" className="btn btn-primary" onClick={save}>Guardar</button>
          </>
        }
      >
        <div className="field">
          <label>Nombre</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="field">
          <label>Descripción</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="field">
          <label>URL Search Console (prefijo de URL)</label>
          <input
            value={form.gsc_site_url}
            onChange={(e) => setForm({ ...form, gsc_site_url: e.target.value })}
            placeholder="https://www.tusitio.com/"
          />
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Debe coincidir exactamente con la propiedad en GSC. También acepta <code className="mono">sc-domain:ejemplo.com</code>
          </p>
        </div>
        <div className="field">
          <label>GA4 Property ID</label>
          <input
            value={form.ga4_property_id}
            onChange={(e) => setForm({ ...form, ga4_property_id: e.target.value })}
            placeholder="412345678"
          />
        </div>
        {editing && (
          <p className="muted" style={{ fontSize: 12.5 }}>
            Tras guardar, ve a <Link to="/integrations">Integraciones Google</Link> para conectar OAuth de este proyecto.
          </p>
        )}
      </Modal>
    </>
  )
}