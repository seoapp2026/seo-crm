import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { phase2Api } from '../../api/phase2-client'
import { Modal } from '../../components/Modal'
import { useApp } from '../../context/AppContext'
import type { AiPrompt } from '../../types/phase2'

export function PromptsPage() {
  const { setTopbarAction, toast } = useApp()
  const [prompts, setPrompts] = useState<AiPrompt[]>([])
  const [editing, setEditing] = useState<AiPrompt | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ system_prompt: '', model_default: '', description: '' })

  const reload = () =>
    phase2Api.prompts.list().then(setPrompts).catch((e) => {
      setPrompts([])
      toast(e instanceof Error ? e.message : 'No se pudieron cargar los prompts')
    })

  useEffect(() => { reload() }, [])
  useEffect(() => {
    setTopbarAction(
      <Link to="/assistants" className="btn btn-sm">Ir a Asistentes IA</Link>,
    )
    return () => setTopbarAction(null)
  }, [setTopbarAction])

  const openEdit = (p: AiPrompt) => {
    setEditing(p)
    setForm({ system_prompt: p.system_prompt, model_default: p.model_default, description: p.description })
    setOpen(true)
  }

  const save = async () => {
    if (!editing) return
    try {
      await phase2Api.prompts.update(editing.id, form)
      setOpen(false)
      reload()
      toast('Prompt actualizado — los asistentes lo usarán en la próxima ejecución')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error')
    }
  }

  return (
    <>
      <div className="banner">
        <strong>Editor de prompts IA.</strong> Los 5 asistentes leen su system prompt desde <code className="mono">ai_prompts</code> — nunca hardcodeados. El cliente puede ajustar tono y criterios sin tocar código.
      </div>

      <div className="grid grid-1 gap-16">
        {prompts.map((p) => (
          <div key={p.id} className="card card-pad prompt-card">
            <div className="section-head">
              <div>
                <h2>{p.name}</h2>
                <p className="t-sub">{p.description}</p>
              </div>
              <button type="button" className="btn btn-sm" onClick={() => openEdit(p)}>Editar prompt</button>
            </div>
            <div className="prompt-meta muted">
              <span className="mono">slug: {p.slug}</span>
              <span>Modelo: {p.model_default}</span>
              <span>Actualizado: {new Date(p.updated_at).toLocaleString('es-ES')}</span>
            </div>
            <pre className="prompt-preview">{p.system_prompt}</pre>
          </div>
        ))}
      </div>

      <Modal
        title={editing ? `Editar — ${editing.name}` : 'Editar prompt'}
        open={open}
        onClose={() => setOpen(false)}
        footer={<><button type="button" className="btn" onClick={() => setOpen(false)}>Cancelar</button><button type="button" className="btn btn-primary" onClick={save}>Guardar</button></>}
      >
        <div className="field"><label>Descripción</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="field">
          <label>Modelo por defecto</label>
          <select value={form.model_default} onChange={(e) => setForm({ ...form, model_default: e.target.value })}>
            <option value="gpt-4o-mini">gpt-4o-mini</option>
            <option value="gpt-4o">gpt-4o</option>
          </select>
        </div>
        <div className="field">
          <label>System prompt</label>
          <textarea value={form.system_prompt} onChange={(e) => setForm({ ...form, system_prompt: e.target.value })} rows={12} />
        </div>
      </Modal>
    </>
  )
}