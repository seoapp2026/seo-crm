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
  const [form, setForm] = useState({
    name: '',
    topic: '',
    project_id: 0,
    state: 'nuevo' as NicheState,
    monetization: 'afiliacion' as Monetization,
    notes: '',
    layout_template_text: '',
  })

  const reload = () => api.niches.list(scopeProject).then(setItems)

  useEffect(() => { reload() }, [scopeProject])
  useEffect(() => {
    setTopbarAction(
      <button
        className="btn btn-primary"
        onClick={() => {
          setEditing(null)
          setForm({
            name: '',
            topic: '',
            project_id: projects[0]?.id || 0,
            state: 'nuevo',
            monetization: 'afiliacion',
            notes: '',
            layout_template_text: '',
          })
          setOpen(true)
        }}
      >
        + Nuevo nicho
      </button>,
    )
    return () => setTopbarAction(null)
  }, [projects, setTopbarAction])

  const save = async () => {
    if (!form.name.trim()) return toast('El nombre es obligatorio')
    try {
      const payload = {
        ...form,
        layout_template_text: form.layout_template_text.trim() || null,
      }
      if (editing) await api.niches.update(editing.id, payload)
      else await api.niches.create(payload)
      setOpen(false)
      reload()
      toast('Nicho guardado')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error')
    }
  }

  const projectName = (id: number) => projects.find((p) => p.id === id)?.name || '—'

  return (
    <>
      <ScopeBar projects={projects} value={scopeProject} onChange={setScopeProject} />
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Nicho</th>
              <th>Proyecto</th>
              <th>Estado</th>
              <th>Monetización</th>
              <th>Maquetación</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((n) => (
              <tr key={n.id}>
                <td><div className="t-title">{n.name}</div><div className="t-sub">{n.topic}</div></td>
                <td>{projectName(n.project_id)}</td>
                <td><Badge label={NICHE_STATES[n.state].label} cls={NICHE_STATES[n.state].cls} /></td>
                <td>{MONETIZATION[n.monetization]}</td>
                <td>
                  {n.layout_template_text ? (
                    <span className="badge" style={{ background: '#e0e7ff', color: '#3730a3', fontSize: 11 }}>
                      ✓ Reglas Divi
                    </span>
                  ) : (
                    <span className="muted" style={{ fontSize: 11 }}>
                      Default
                    </span>
                  )}
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => {
                        setEditing(n)
                        setForm({
                          name: n.name,
                          topic: n.topic || '',
                          project_id: n.project_id,
                          state: n.state,
                          monetization: n.monetization,
                          notes: n.notes || '',
                          layout_template_text: n.layout_template_text || '',
                        })
                        setOpen(true)
                      }}
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={async () => {
                        try {
                          await api.niches.remove(n.id)
                          reload()
                          toast('Eliminado')
                        } catch (e) {
                          toast(e instanceof Error ? e.message : 'No se pudo eliminar el nicho')
                        }
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
                  No hay nichos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        title={editing ? 'Editar nicho' : 'Nuevo nicho'}
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
          <label>Nombre *</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="field">
          <label>Tema</label>
          <input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
        </div>
        <div className="field">
          <label>Proyecto</label>
          <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: Number(e.target.value) })}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Estado</label>
            <select
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value as NicheState })}
            >
              {Object.entries(NICHE_STATES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Monetización</label>
            <select
              value={form.monetization}
              onChange={(e) => setForm({ ...form, monetization: e.target.value as Monetization })}
            >
              {Object.entries(MONETIZATION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        <div className="field">
          <label>Plantilla de Maquetación / Reglas Divi del Nicho</label>
          <textarea
            value={form.layout_template_text}
            onChange={(e) => setForm({ ...form, layout_template_text: e.target.value })}
            rows={4}
            placeholder="ej. Estructura requerida: Encabezado con H1 > Tabla Resumen Top 3 > Secciones H2 con Pros/Contras > Cajas de Producto > FAQ con Schema."
            className="mono"
          />
          <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
            El Maquetador IA utilizará estas reglas arquitectónicas y estilos para dar forma al HTML final de todas las páginas de este nicho.
          </p>
        </div>

        <div className="field">
          <label>Notas</label>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
        </div>
      </Modal>
    </>
  )
}