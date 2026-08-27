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
  const [editOpen, setEditOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AiPrompt | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const [form, setForm] = useState({
    slug: '',
    name: '',
    description: '',
    model_default: 'gpt-4o-mini',
    system_prompt: '',
  })

  const reload = () =>
    phase2Api.prompts.list().then(setPrompts).catch((e) => {
      setPrompts([])
      toast(e instanceof Error ? e.message : 'No se pudieron cargar los prompts')
    })

  useEffect(() => { reload() }, [])

  const openCreate = () => {
    setForm({
      slug: '',
      name: '',
      description: '',
      model_default: 'gpt-4o-mini',
      system_prompt: '',
    })
    setCreateOpen(true)
  }

  useEffect(() => {
    setTopbarAction(
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn btn-sm btn-primary" onClick={openCreate}>
          + Nuevo prompt
        </button>
        <Link to="/assistants" className="btn btn-sm">
          Ir a Asistentes IA
        </Link>
      </div>,
    )
    return () => setTopbarAction(null)
  }, [setTopbarAction])

  const openEdit = (p: AiPrompt) => {
    setEditing(p)
    setForm({
      slug: p.slug,
      name: p.name,
      description: p.description,
      model_default: p.model_default,
      system_prompt: p.system_prompt,
    })
    setEditOpen(true)
  }

  const handleCreate = async () => {
    if (!form.name.trim()) return toast('El nombre es obligatorio')
    if (!form.slug.trim()) return toast('El slug es obligatorio')
    if (!form.system_prompt.trim()) return toast('El system prompt es obligatorio')
    try {
      await phase2Api.prompts.create({
        slug: form.slug.trim().toLowerCase(),
        name: form.name.trim(),
        description: form.description.trim(),
        model_default: form.model_default,
        system_prompt: form.system_prompt,
      })
      setCreateOpen(false)
      reload()
      toast('Prompt creado correctamente')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al crear el prompt')
    }
  }

  const handleSaveEdit = async () => {
    if (!editing) return
    if (!form.name.trim()) return toast('El nombre es obligatorio')
    if (!form.slug.trim()) return toast('El slug es obligatorio')
    if (!form.system_prompt.trim()) return toast('El system prompt es obligatorio')
    try {
      await phase2Api.prompts.update(editing.id, {
        slug: form.slug.trim().toLowerCase(),
        name: form.name.trim(),
        description: form.description.trim(),
        model_default: form.model_default,
        system_prompt: form.system_prompt,
      })
      setEditOpen(false)
      reload()
      toast('Prompt actualizado — los asistentes lo usarán en la próxima ejecución')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al actualizar el prompt')
    }
  }

  const handleDuplicate = async (p: AiPrompt) => {
    try {
      const copy = await phase2Api.prompts.duplicate(p.id)
      reload()
      toast(`Prompt duplicado como "${copy.name}"`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al duplicar')
    }
  }

  const confirmDelete = (p: AiPrompt) => {
    setDeleteTarget(p)
    setDeleteOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await phase2Api.prompts.remove(deleteTarget.id, deleteTarget.is_system)
      setDeleteOpen(false)
      setDeleteTarget(null)
      reload()
      toast('Prompt eliminado')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al eliminar')
    }
  }

  const moveOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= prompts.length) return
    const updated = [...prompts]
    const temp = updated[index]
    updated[index] = updated[targetIndex]
    updated[targetIndex] = temp

    // Reassign sort orders
    const items = updated.map((p, idx) => ({ id: p.id, sort_order: idx * 10 }))
    setPrompts(updated.map((p, idx) => ({ ...p, sort_order: idx * 10 })))

    try {
      await phase2Api.prompts.reorder(items)
      toast('Orden actualizado')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al guardar orden')
      reload()
    }
  }

  return (
    <>
      <div className="banner">
        <strong>Biblioteca Dinámica de Prompts IA.</strong> Crea, duplica, reordena y personaliza libremente todos los prompts y roles del sistema. Los asistentes ejecutarán dinámicamente cualquier prompt de esta biblioteca.
      </div>

      <div className="grid grid-1 gap-16">
        {prompts.map((p, idx) => (
          <div key={p.id} className="card card-pad prompt-card">
            <div className="section-head" style={{ alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span className="badge" style={{ fontSize: 11, background: 'var(--color-bg-secondary, #eee)' }}>
                    #{idx + 1}
                  </span>
                  {p.is_system && (
                    <span className="badge" style={{ fontSize: 11, background: '#e0f2fe', color: '#0369a1' }}>
                      Sistema
                    </span>
                  )}
                  <h2 style={{ margin: 0 }}>{p.name}</h2>
                </div>
                <p className="t-sub" style={{ margin: 0 }}>{p.description || 'Sin descripción'}</p>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={idx === 0}
                  onClick={() => moveOrder(idx, 'up')}
                  title="Subir posición"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={idx === prompts.length - 1}
                  onClick={() => moveOrder(idx, 'down')}
                  title="Bajar posición"
                >
                  ↓
                </button>
                <button type="button" className="btn btn-sm" onClick={() => openEdit(p)}>
                  Editar
                </button>
                <button type="button" className="btn btn-sm" onClick={() => handleDuplicate(p)}>
                  Duplicar
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  style={{ color: '#ef4444' }}
                  onClick={() => confirmDelete(p)}
                >
                  Eliminar
                </button>
              </div>
            </div>

            <div className="prompt-meta muted" style={{ marginTop: 8 }}>
              <span className="mono">slug: {p.slug}</span>
              <span>Modelo: {p.model_default}</span>
              <span>Actualizado: {new Date(p.updated_at).toLocaleString('es-ES')}</span>
            </div>
            <pre className="prompt-preview" style={{ marginTop: 12 }}>{p.system_prompt}</pre>
          </div>
        ))}

        {prompts.length === 0 && (
          <div className="card card-pad" style={{ textAlign: 'center', padding: 32 }}>
            <p className="muted">No hay prompts en la biblioteca.</p>
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              Crear primer prompt
            </button>
          </div>
        )}
      </div>

      {/* Modal Crear */}
      <Modal
        title="Crear nuevo prompt IA"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setCreateOpen(false)}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={handleCreate}>
              Crear prompt
            </button>
          </>
        }
      >
        <div className="field">
          <label>Nombre del prompt *</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="ej. Prompt 00 Maestro o Maquetador HTML"
          />
        </div>
        <div className="field">
          <label>Slug identificador *</label>
          <input
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder="ej. prompt_00 o maquetador"
            className="mono"
          />
        </div>
        <div className="field">
          <label>Descripción corta</label>
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Qué hace este prompt y en qué paso se utiliza"
          />
        </div>
        <div className="field">
          <label>Modelo por defecto</label>
          <select
            value={form.model_default}
            onChange={(e) => setForm({ ...form, model_default: e.target.value })}
          >
            <option value="gpt-4o-mini">gpt-4o-mini (rápido y económico)</option>
            <option value="gpt-4o">gpt-4o (mayor capacidad de razonamiento)</option>
          </select>
        </div>
        <div className="field">
          <label>System prompt *</label>
          <textarea
            value={form.system_prompt}
            onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
            rows={12}
            placeholder="Instrucciones detalladas del rol, directrices y formato de salida..."
          />
        </div>
      </Modal>

      {/* Modal Editar */}
      <Modal
        title={editing ? `Editar — ${editing.name}` : 'Editar prompt'}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setEditOpen(false)}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSaveEdit}>
              Guardar cambios
            </button>
          </>
        }
      >
        <div className="field">
          <label>Nombre</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Slug identificador</label>
          <input
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            className="mono"
          />
        </div>
        <div className="field">
          <label>Descripción</label>
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Modelo por defecto</label>
          <select
            value={form.model_default}
            onChange={(e) => setForm({ ...form, model_default: e.target.value })}
          >
            <option value="gpt-4o-mini">gpt-4o-mini</option>
            <option value="gpt-4o">gpt-4o</option>
          </select>
        </div>
        <div className="field">
          <label>System prompt</label>
          <textarea
            value={form.system_prompt}
            onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
            rows={12}
          />
        </div>
      </Modal>

      {/* Modal Confirmar Eliminar */}
      <Modal
        title="Confirmar eliminación"
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setDeleteOpen(false)}>
              Cancelar
            </button>
            <button type="button" className="btn" style={{ background: '#ef4444', color: '#fff' }} onClick={handleDelete}>
              Eliminar definitivamente
            </button>
          </>
        }
      >
        <p>
          ¿Estás seguro de que deseas eliminar el prompt <strong>{deleteTarget?.name}</strong> (<code>{deleteTarget?.slug}</code>)?
        </p>
        {deleteTarget?.is_system && (
          <div className="banner" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b', marginTop: 12 }}>
            <strong>Aviso:</strong> Este es un prompt base del sistema.
          </div>
        )}
      </Modal>
    </>
  )
}