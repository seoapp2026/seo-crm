import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { phase2Api } from '../../api/phase2-client'
import { Modal } from '../../components/Modal'
import { ScopeBar } from '../../components/ScopeBar'
import { useApp } from '../../context/AppContext'
import { useProjects } from '../../hooks/useProjects'
import type { Product, ProductProviderStatus, ProductSearchItem } from '../../types/phase2'

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
  affiliate_url: '',
  image_url: '',
  rating: '',
  provider: 'manual',
  external_id: '',
  project_id: 0,
}

export function ProductsPage() {
  const { scopeProject, setScopeProject, setTopbarAction, toast } = useApp()
  const { projects } = useProjects()
  const [items, setItems] = useState<Product[]>([])
  const [editing, setEditing] = useState<Product | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  // Amazon / eBay Search Modal State
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [providerStatus, setProviderStatus] = useState<ProductProviderStatus | null>(null)
  const [searchProvider, setSearchProvider] = useState<'all' | 'amazon' | 'ebay'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<ProductSearchItem[]>([])
  const [importingIds, setImportingIds] = useState<Record<string, boolean>>({})

  const reload = () =>
    phase2Api.products.list(scopeProject).then(setItems).catch((e) => {
      setItems([])
      toast(e instanceof Error ? e.message : 'No se pudieron cargar productos')
    })

  useEffect(() => {
    reload()
    phase2Api.products.getProviders().then(setProviderStatus).catch(() => {})
  }, [scopeProject])

  const targetProjectId = scopeProject === 'all' ? projects[0]?.id || 0 : scopeProject

  useEffect(() => {
    setTopbarAction(
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setSearchModalOpen(true)
            if (!searchResults.length && !searchQuery) {
              setSearchQuery('cafetera express')
              void runSearch('cafetera express', searchProvider)
            }
          }}
        >
          🔍 Buscar en Amazon / eBay
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setEditing(null)
            setForm({
              ...emptyForm,
              project_id: targetProjectId,
            })
            setOpen(true)
          }}
        >
          + Producto Manual
        </button>
      </div>,
    )
    return () => setTopbarAction(null)
  }, [projects, scopeProject, searchResults.length, searchQuery, searchProvider, targetProjectId, setTopbarAction])

  const runSearch = async (q: string, prov: 'all' | 'amazon' | 'ebay') => {
    if (!q.trim()) return toast('Introduce un término de búsqueda')
    setSearching(true)
    try {
      const data = await phase2Api.products.search({
        query: q.trim(),
        provider: prov,
        limit: 8,
        project_id: targetProjectId,
      })
      setSearchResults(data.results)
      toast(`Encontrados ${data.results.length} productos en ${prov === 'all' ? 'Amazon & eBay' : prov.toUpperCase()}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al buscar productos')
    } finally {
      setSearching(false)
    }
  }

  const importItem = async (item: ProductSearchItem) => {
    if (!targetProjectId) return toast('Selecciona un proyecto para importar')
    const key = `${item.provider}-${item.external_id}`
    setImportingIds((prev) => ({ ...prev, [key]: true }))
    try {
      const res = await phase2Api.products.import({
        project_id: targetProjectId,
        provider: item.provider,
        external_id: item.external_id,
        name: item.name,
        brand: item.brand,
        price: item.price,
        currency: item.currency,
        image_url: item.image_url,
        rating: item.rating,
        affiliate_url: item.affiliate_url,
        features: item.features,
      })
      toast(res.message)
      reload()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al importar producto')
    } finally {
      setImportingIds((prev) => ({ ...prev, [key]: false }))
    }
  }

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
      affiliate_url: form.affiliate_url.trim() || null,
      image_url: form.image_url.trim() || null,
      rating: form.rating.trim() || null,
      provider: form.provider || 'manual',
      external_id: form.external_id.trim() || null,
    }
    try {
      if (editing) await phase2Api.products.update(editing.id, payload)
      else await phase2Api.products.create(payload as Omit<Product, 'id' | 'created_at' | 'updated_at'>)
      setOpen(false)
      reload()
      toast('Producto guardado con éxito')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error')
    }
  }

  return (
    <>
      <ScopeBar projects={projects} value={scopeProject} onChange={setScopeProject} />

      <div className="banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <strong>Catálogo Oficial de Productos (Amazon PA-API & eBay Browse API).</strong> Hechos reales para comparativas y reseñas afiliadas.{' '}
          <Link to="/help#option2">Ver documentación →</Link>
        </div>
        {providerStatus && (
          <div style={{ display: 'flex', gap: 8 }}>
            {providerStatus.providers.map((p) => (
              <span
                key={p.provider}
                className={`badge ${p.configured ? 'badge-success' : 'badge-subtle'}`}
                style={{ fontSize: 12, padding: '4px 8px' }}
                title={`Marketplace: ${p.marketplace} | ${p.using_stub ? 'Modo Fixture/Stub' : 'API Oficial Activa'}`}
              >
                {p.provider === 'amazon' ? '📦 Amazon PA-API 5.0' : '🛒 eBay Browse API'}: {p.configured ? 'En vivo' : 'Catálogo Demo'}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th style={{ width: 60 }}>Img</th>
              <th>Nombre & Modelo</th>
              <th>Proveedor</th>
              <th>Marca</th>
              <th>Precio</th>
              <th>Valoración</th>
              <th>Enlace Afiliado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 4, background: '#fff', border: '1px solid #e2e8f0' }}
                    />
                  ) : (
                    <div style={{ width: 44, height: 44, background: '#f1f5f9', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 18 }}>
                      📦
                    </div>
                  )}
                </td>
                <td className="t-title">
                  <div>{p.name}</div>
                  {p.external_id && <span className="muted" style={{ fontSize: 11 }}>ID: {p.external_id}</span>}
                </td>
                <td>
                  <span
                    className={`badge ${
                      p.provider === 'amazon' ? 'badge-warning' : p.provider === 'ebay' ? 'badge-info' : 'badge-subtle'
                    }`}
                    style={{ fontSize: 11, textTransform: 'uppercase' }}
                  >
                    {p.provider || 'manual'}
                  </span>
                </td>
                <td>{p.brand || '—'}</td>
                <td>
                  {p.price != null ? (
                    <strong style={{ color: '#0f172a' }}>
                      {p.price.toFixed(2)} {p.currency}
                    </strong>
                  ) : (
                    <span className="muted">Consultar</span>
                  )}
                </td>
                <td>
                  {p.rating ? (
                    <span style={{ fontSize: 12, color: '#b45309', fontWeight: 600 }}>⭐ {p.rating}</span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  {p.affiliate_url ? (
                    <a
                      href={p.affiliate_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-ghost"
                      style={{ fontSize: 12, textDecoration: 'none' }}
                    >
                      🔗 Link Afiliado ↗
                    </a>
                  ) : (
                    <span className="muted">Sin enlace</span>
                  )}
                </td>
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
                          affiliate_url: p.affiliate_url || '',
                          image_url: p.image_url || '',
                          rating: p.rating || '',
                          provider: p.provider || 'manual',
                          external_id: p.external_id || '',
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
                        toast('Producto eliminado')
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
                <td colSpan={8} className="empty">
                  No hay productos en el catálogo. Usa el botón <strong>"🔍 Buscar en Amazon / eBay"</strong> para importar productos oficiales en 1 clic.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Official Amazon & eBay Search Modal */}
      <Modal
        title="🔍 Buscar e Importar Productos Oficiales (Amazon PA-API & eBay)"
        open={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        footer={
          <button type="button" className="btn" onClick={() => setSearchModalOpen(false)}>
            Cerrar
          </button>
        }
      >
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <select
            value={searchProvider}
            onChange={(e) => {
              const p = e.target.value as 'all' | 'amazon' | 'ebay'
              setSearchProvider(p)
              if (searchQuery.trim()) void runSearch(searchQuery, p)
            }}
            style={{ width: 180 }}
          >
            <option value="all">📦 Todos (Amazon + eBay)</option>
            <option value="amazon">📦 Amazon PA-API 5.0</option>
            <option value="ebay">🛒 eBay Browse API</option>
          </select>
          <input
            type="text"
            placeholder="Buscar por término o palabra clave (ej: cafetera express, robot aspirador)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void runSearch(searchQuery, searchProvider)
            }}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void runSearch(searchQuery, searchProvider)}
            disabled={searching}
          >
            {searching ? 'Buscando...' : 'Buscar'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, maxHeight: '60vh', overflowY: 'auto', padding: 4 }}>
          {searchResults.map((item) => {
            const key = `${item.provider}-${item.external_id}`
            const isImporting = !!importingIds[key]
            return (
              <div
                key={key}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: 12,
                  background: '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <span
                      className={`badge ${item.provider === 'amazon' ? 'badge-warning' : 'badge-info'}`}
                      style={{ fontSize: 11, textTransform: 'uppercase' }}
                    >
                      {item.provider === 'amazon' ? 'Amazon ES' : 'eBay ES'}
                    </span>
                    {item.is_prime && (
                      <span className="badge badge-success" style={{ fontSize: 10 }}>
                        ✓ Prime 24h
                      </span>
                    )}
                    {item.condition && !item.is_prime && (
                      <span className="badge badge-subtle" style={{ fontSize: 10 }}>
                        {item.condition}
                      </span>
                    )}
                  </div>

                  {item.image_url && (
                    <div style={{ textAlign: 'center', marginBottom: 10, background: '#f8fafc', padding: 8, borderRadius: 6 }}>
                      <img
                        src={item.image_url}
                        alt={item.name}
                        style={{ height: 110, maxWidth: '100%', objectFit: 'contain' }}
                      />
                    </div>
                  )}

                  <h4 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 6px 0', lineHeight: 1.3, color: '#1e293b' }}>
                    {item.name}
                  </h4>

                  {item.brand && (
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
                      Marca: <strong>{item.brand}</strong>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                      {item.price != null ? `${item.price.toFixed(2)} ${item.currency}` : 'Consultar'}
                    </div>
                    {item.rating && (
                      <div style={{ fontSize: 12, color: '#d97706', fontWeight: 600 }}>
                        ⭐ {item.rating}
                      </div>
                    )}
                  </div>

                  {item.features && (
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10, lineHeight: 1.4 }}>
                      {item.features}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    style={{ flex: 1 }}
                    disabled={isImporting}
                    onClick={() => void importItem(item)}
                  >
                    {isImporting ? 'Importando...' : '📥 Importar al Catálogo'}
                  </button>
                  {item.affiliate_url && (
                    <a
                      href={item.affiliate_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-ghost"
                      style={{ fontSize: 11, padding: '4px 8px' }}
                      title="Abrir enlace de afiliado"
                    >
                      ↗
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Modal>

      {/* Manual / Edit Product Modal */}
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
          <label>Nombre del Producto</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Proveedor</label>
            <select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}>
              <option value="manual">Manual</option>
              <option value="amazon">Amazon PA-API</option>
              <option value="ebay">eBay</option>
            </select>
          </div>
          <div className="field">
            <label>ID Externo (ASIN / Item ID)</label>
            <input value={form.external_id} onChange={(e) => setForm({ ...form, external_id: e.target.value })} />
          </div>
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
        <div className="field-row">
          <div className="field">
            <label>URL Imagen</label>
            <input
              value={form.image_url}
              onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div className="field">
            <label>Valoración (ej: 4.6/5)</label>
            <input
              value={form.rating}
              onChange={(e) => setForm({ ...form, rating: e.target.value })}
              placeholder="4.5/5"
            />
          </div>
        </div>
        <div className="field">
          <label>URL de Afiliado (con partner tag)</label>
          <input
            value={form.affiliate_url}
            onChange={(e) => setForm({ ...form, affiliate_url: e.target.value })}
            placeholder="https://amazon.es/dp/ASIN?tag=seocrm-21"
          />
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
      </Modal>
    </>
  )
}
