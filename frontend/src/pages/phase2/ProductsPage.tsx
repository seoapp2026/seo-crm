import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { phase2Api } from '../../api/phase2-client'
import { Modal } from '../../components/Modal'
import { ScopeBar } from '../../components/ScopeBar'
import { useApp } from '../../context/AppContext'
import { useProjects } from '../../hooks/useProjects'
import type { Product } from '../../types/phase2'

const emptyForm = {
  name: '',
  brand: '',
  sku: '',
  features: '',
  price: '' as string | number,
  currency: 'EUR',
  stock_notes: '',
  opinions: '',
  source_url: '',
  project_id: 0,
}

export function ProductsPage() {
  const { scopeProject, setScopeProject, setTopbarAction, toast } = useApp()
  const { projects } = useProjects()
  const [items, setItems] = useState<Product[]>([])
  const [editing, setEditing] = useState<Product | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const reload = () =>
    phase2Api.products.list(scopeProject).then(setItems).catch((e) => {
      setItems([])
      toast(e instanceof Error ? e.message : 'No se pudieron cargar productos')
    })

  useEffect(() => {
    reload()
  }, [scopeProject])

  useEffect(() => {
    setTopbarAction(
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => {
          setEditing(null)
          setForm({
            ...emptyForm,
            project_id: scopeProject === 'all' ? projects[0]?.id || 0 : scopeProject,
          })
          setOpen(true)
        }}
      >
        + Producto
      </button>,
    )
    return () => setTopbarAction(null)
  }, [projects, scopeProject, setTopbarAction])

  const save = async () => {
    if (!form.name.trim()) return toast('El nombre es obligatorio')
    if (!form.project_id) return toast('Selecciona un proyecto')
    const payload = {
      project_id: form.project_id,
      name: form.name.trim(),
      brand: form.brand.trim() || null,
      sku: form.sku.trim() || null,
      features: form.features.trim() || null,
      price: form.price === '' || form.price === null ? null : Number(form.price),
      currency: form.currency || 'EUR',
      stock_notes: form.stock_notes.trim() || null,
      opinions: form.opinions.trim() || null,
      source_url: form.source_url.trim() || null,
    }
    try {
      if (editing) await phase2Api.products.update(editing.id, payload)
      else await phase2Api.products.create(payload as Omit<Product, 'id' | 'created_at' | 'updated_at'>)
      setOpen(false)
      reload()
      toast('Producto guardado — la IA solo usará estos hechos')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error')
    }
  }

  return (
    <>
      <ScopeBar projects={projects} value={scopeProject} onChange={setScopeProject} />

      <div className="banner">
        <strong>Catálogo de productos (Option 2).</strong> Hechos reales para reseñas y contenido.
        La IA <em>no debe inventar</em> precio, stock, características ni opiniones que no estén aquí.{' '}
        <Link to="/help#option2">Ver caps Option 2 →</Link>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Marca</th>
              <th>Precio</th>
              <th>Stock / notas</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td className="t-title">{p.name}</td>
                <td>{p.brand || '—'}</td>
                <td>
                  {p.price != null ? `${p.price.toFixed(2)} ${p.currency}` : <span className="muted">needs data</span>}
                </td>
                <td className="t-sub">{p.stock_notes || '—'}</td>
                <td>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => {
                        setEditing(p)
                        setForm({
                          name: p.name,
                          brand: p.brand || '',
                          sku: p.sku || '',
                          features: p.features || '',
                          price: p.price ?? '',
                          currency: p.currency || 'EUR',
                          stock_notes: p.stock_notes || '',
                          opinions: p.opinions || '',
                          source_url: p.source_url || '',
                          project_id: p.project_id,
                        })
                        setOpen(true)
                      }}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={async () => {
                        await phase2Api.products.remove(p.id)
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
            {!items.length && (
              <tr>
                <td colSpan={5} className="empty">
                  Añade productos reales antes de generar reseñas TSA con IA.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        title={editing ? 'Editar producto' : 'Nuevo producto'}
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
          <label>Proyecto</label>
          <select
            value={form.project_id}
            onChange={(e) => setForm({ ...form, project_id: Number(e.target.value) })}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Nombre</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Marca</label>
            <input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
          </div>
          <div className="field">
            <label>SKU</label>
            <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label>Características (hechos verificables)</label>
          <textarea
            rows={3}
            value={form.features}
            onChange={(e) => setForm({ ...form, features: e.target.value })}
          />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Precio</label>
            <input
              type="number"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Moneda</label>
            <input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label>Stock / disponibilidad (notas)</label>
          <input
            value={form.stock_notes}
            onChange={(e) => setForm({ ...form, stock_notes: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Opiniones / claims aprobados</label>
          <textarea
            rows={2}
            value={form.opinions}
            onChange={(e) => setForm({ ...form, opinions: e.target.value })}
          />
        </div>
        <div className="field">
          <label>URL fuente (opcional)</label>
          <input
            value={form.source_url}
            onChange={(e) => setForm({ ...form, source_url: e.target.value })}
          />
        </div>
      </Modal>
    </>
  )
}
