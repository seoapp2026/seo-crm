import { useEffect, useState } from 'react'
import { phase2Api } from '../../api/phase2-client'
import { Modal } from '../../components/Modal'
import { ScopeBar } from '../../components/ScopeBar'
import { useApp } from '../../context/AppContext'
import { useProjects } from '../../hooks/useProjects'
import type { Competitor } from '../../types/phase2'

export function CompetitorsPage() {
  const { scopeProject, setScopeProject, setTopbarAction, toast } = useApp()
  const { projects } = useProjects()
  const [items, setItems] = useState<Competitor[]>([])
  const [editing, setEditing] = useState<Competitor | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ domain: '', project_id: 0, niche_id: null as number | null, notes: '' })

  const reload = () =>
    phase2Api.competitors.list(scopeProject).then(setItems).catch((e) => {
      setItems([])
      toast(e instanceof Error ? e.message : 'No se pudieron cargar competidores')
    })

  useEffect(() => { reload() }, [scopeProject])
  useEffect(() => {
    setTopbarAction(
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => {
          setEditing(null)
          setForm({ domain: '', project_id: projects[0]?.id || 0, niche_id: null, notes: '' })
          setOpen(true)
        }}
      >
        + Competidor
      </button>,
    )
    return () => setTopbarAction(null)
  }, [projects, setTopbarAction])

  const save = async () => {
    if (!form.domain.trim()) return toast('El dominio es obligatorio')
    try {
      if (editing) await phase2Api.competitors.update(editing.id, form)
      else await phase2Api.competitors.create(form)
      setOpen(false)
      reload()
      toast('Competidor guardado')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error')
    }
  }

  return (
    <>
      <ScopeBar projects={projects} value={scopeProject} onChange={setScopeProject} />

      <div className="banner">
        <strong>Competidores.</strong> Dominios rivales por nicho para el Analista de Competencia IA. Tabla <code className="mono">competitors</code> — adaptadores Ahrefs/Semrush podrán ampliar datos más adelante.
      </div>

      <div className="card">
        <table>
          <thead>
            <tr><th>Dominio</th><th>Proyecto</th><th>Páginas rastreadas</th><th>Notas</th><th></th></tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <td className="t-title mono">{c.domain}</td>
                <td>{projects.find((p) => p.id === c.project_id)?.name || '—'}</td>
                <td>{c.pages_tracked}</td>
                <td className="t-sub">{c.notes || '—'}</td>
                <td>
                  <div className="row-actions">
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => {
                      setEditing(c)
                      setForm({ domain: c.domain, project_id: c.project_id, niche_id: c.niche_id, notes: c.notes || '' })
                      setOpen(true)
                    }}>Editar</button>
                    <button type="button" className="btn btn-sm btn-danger" onClick={async () => {
                      await phase2Api.competitors.remove(c.id)
                      reload()
                      toast('Eliminado')
                    }}>Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr><td colSpan={5} className="empty">Añade dominios competidores para análisis estratégico.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        title={editing ? 'Editar competidor' : 'Nuevo competidor'}
        open={open}
        onClose={() => setOpen(false)}
        footer={<><button type="button" className="btn" onClick={() => setOpen(false)}>Cancelar</button><button type="button" className="btn btn-primary" onClick={save}>Guardar</button></>}
      >
        <div className="field"><label>Dominio</label><input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="ejemplo.com" /></div>
        <div className="field">
          <label>Proyecto</label>
          <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: Number(e.target.value) })}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="field"><label>Notas</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
      </Modal>
    </>
  )
}