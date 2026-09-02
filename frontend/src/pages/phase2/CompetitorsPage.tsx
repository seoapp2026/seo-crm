import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api/client'
import { phase2Api } from '../../api/phase2-client'
import { Modal } from '../../components/Modal'
import { ScopeBar } from '../../components/ScopeBar'
import { useApp } from '../../context/AppContext'
import { useProjects } from '../../hooks/useProjects'
import type { Page } from '../../types'
import type {
  ComparisonTableGenerateResponse,
  Competitor,
  CompetitorScrapeResponse,
  ProductItem,
  ProductSearchItem,
} from '../../types/phase2'

const SAMPLE_PRODUCTS: ProductItem[] = [
  {
    name: 'DeLonghi Dedica EC685',
    brand: 'DeLonghi',
    badge: 'Mejor Calidad-Precio ⭐',
    price: '189,00 €',
    rating: '4.8/5',
    pros: ['Diseño compacto (15 cm)', '15 bares de presión', 'Calentamiento ultra rápido'],
    cons: ['Bandeja de goteo pequeña'],
    specs: {
      Presión: '15 Bares',
      Potencia: '1350 W',
      Capacidad: '1.1 Litros',
      Sistema: 'Thermoblock',
    },
    cta_text: 'Ver en Amazon',
    affiliate_url: 'https://amazon.es',
  },
  {
    name: 'Cecotec Cafelizzia 790',
    brand: 'Cecotec',
    badge: 'Opción Económica',
    price: '79,90 €',
    rating: '4.3/5',
    pros: ['Precio muy asequible', '20 bares de presión', 'Manómetro de control'],
    cons: ['Cuerpo de plástico ligero', 'Más ruidosa'],
    specs: {
      Presión: '20 Bares',
      Potencia: '1350 W',
      Capacidad: '1.2 Litros',
      Sistema: 'Thermoblock',
    },
    cta_text: 'Ver en Cecotec',
    affiliate_url: 'https://cecotec.es',
  },
  {
    name: 'Sage The Bambino Plus',
    brand: 'Sage',
    badge: 'Gama Premium',
    price: '449,00 €',
    rating: '4.9/5',
    pros: ['Espumado automático profesional', 'Calentamiento en 3 segundos', 'Acero inoxidable'],
    cons: ['Inversión más elevada'],
    specs: {
      Presión: '15 Bares (Pre-infusión)',
      Potencia: '1600 W',
      Capacidad: '1.9 Litros',
      Sistema: 'ThermoJet',
    },
    cta_text: 'Ver Oferta',
    affiliate_url: 'https://amazon.es',
  },
]

export function CompetitorsPage() {
  const { scopeProject, setScopeProject, setTopbarAction, toast } = useApp()
  const { projects } = useProjects()
  const [activeTab, setActiveTab] = useState<'domains' | 'table_generator' | 'scraper'>('domains')

  // Tab 1: Domains state
  const [items, setItems] = useState<Competitor[]>([])
  const [editing, setEditing] = useState<Competitor | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ domain: '', project_id: 0, niche_id: null as number | null, notes: '' })

  // Tab 2: Comparison Table Generator state
  const [pages, setPages] = useState<Page[]>([])
  const [tableTitle, setTableTitle] = useState('Comparativa de los Mejores Modelos')
  const [products, setProducts] = useState<ProductItem[]>(SAMPLE_PRODUCTS)
  const [targetPageId, setTargetPageId] = useState<number | null>(null)
  const [generatingTable, setGeneratingTable] = useState(false)
  const [tableResult, setTableResult] = useState<ComparisonTableGenerateResponse | null>(null)
  const [previewMode, setPreviewMode] = useState<'visual' | 'code'>('visual')

  // Tab 3: Competitor Scraper state
  const [scrapeUrl, setScrapeUrl] = useState('')
  const [rawHtml, setRawHtml] = useState('')
  const [scraping, setScraping] = useState(false)
  const [scrapeResult, setScrapeResult] = useState<CompetitorScrapeResponse | null>(null)

  // Product Search Modal inside Table Builder
  const [productSearchModalOpen, setProductSearchModalOpen] = useState(false)
  const [providerSearchQuery, setProviderSearchQuery] = useState('')
  const [providerSearchType, setProviderSearchType] = useState<'all' | 'amazon' | 'ebay'>('all')
  const [searchingProducts, setSearchingProducts] = useState(false)
  const [providerResults, setProviderResults] = useState<ProductSearchItem[]>([])

  const effectiveProject = scopeProject === 'all' ? projects[0]?.id : scopeProject

  const reload = useCallback(() => {
    phase2Api.competitors.list(scopeProject).then(setItems).catch((e) => {
      setItems([])
      toast(e instanceof Error ? e.message : 'No se pudieron cargar competidores')
    })
    if (scopeProject !== 'all' || projects[0]?.id) {
      api.pages.list(scopeProject).then(setPages).catch(() => setPages([]))
    }
  }, [scopeProject, projects, toast])

  useEffect(() => { reload() }, [reload])

  useEffect(() => {
    if (activeTab === 'domains') {
      setTopbarAction(
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setEditing(null)
            setForm({ domain: '', project_id: effectiveProject || projects[0]?.id || 0, niche_id: null, notes: '' })
            setOpen(true)
          }}
        >
          + Competidor
        </button>,
      )
    } else if (activeTab === 'table_generator') {
      setTopbarAction(
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setProducts(SAMPLE_PRODUCTS)}
          >
            🔄 Cargar Ejemplo
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={handleGenerateTable}
            disabled={generatingTable || products.length === 0}
          >
            {generatingTable ? 'Generando...' : '⚡ Generar Tabla HTML'}
          </button>
        </div>,
      )
    } else {
      setTopbarAction(null)
    }
    return () => setTopbarAction(null)
  }, [activeTab, effectiveProject, projects, products, generatingTable, setTopbarAction])

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

  const handleGenerateTable = async () => {
    if (products.length === 0) return toast('Añade al menos un producto')
    setGeneratingTable(true)
    try {
      const res = await phase2Api.competitors.generateComparisonTable({
        products,
        table_title: tableTitle,
        target_page_id: targetPageId,
      })
      setTableResult(res)
      toast('✓ Tabla HTML generada con éxito')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al generar tabla')
    } finally {
      setGeneratingTable(false)
    }
  }

  const handleScrape = async () => {
    if (!scrapeUrl.trim() && !rawHtml.trim()) {
      return toast('Introduce una URL o pega el código HTML del competidor')
    }
    setScraping(true)
    setScrapeResult(null)
    try {
      const res = await phase2Api.competitors.scrapeStructure({
        url: scrapeUrl.trim() || undefined,
        raw_html: rawHtml.trim() || undefined,
        project_id: effectiveProject || projects[0]?.id || 0,
      })
      setScrapeResult(res)
      toast('✓ Análisis de estructura del competidor completado')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al analizar competidor')
    } finally {
      setScraping(false)
    }
  }

  const importDetectedProducts = () => {
    if (!scrapeResult || scrapeResult.detected_products.length === 0) {
      return toast('No hay productos detectados para importar')
    }
    setProducts(scrapeResult.detected_products)
    setActiveTab('table_generator')
    toast(`✓ ${scrapeResult.detected_products.length} productos transferidos al Generador de Tablas`)
  }

  const addProduct = () => {
    setProducts((prev) => [
      ...prev,
      {
        name: `Producto #${prev.length + 1}`,
        brand: '',
        badge: '',
        price: '0,00 €',
        rating: '4.5/5',
        pros: ['Ventaja clave 1', 'Ventaja clave 2'],
        cons: ['Desventaja'],
        specs: { Presión: '15 Bares', Potencia: '1400 W' },
        cta_text: 'Ver Precio',
        affiliate_url: '',
      },
    ])
  }

  const removeProduct = (idx: number) => {
    setProducts((prev) => prev.filter((_, i) => i !== idx))
  }

  const updateProductField = (idx: number, field: keyof ProductItem, val: any) => {
    setProducts((prev) => {
      const copy = [...prev]
      copy[idx] = { ...copy[idx], [field]: val }
      return copy
    })
  }

  const runProviderProductSearch = async (q: string, prov: 'all' | 'amazon' | 'ebay') => {
    if (!q.trim()) return toast('Introduce un término de búsqueda')
    setSearchingProducts(true)
    try {
      const data = await phase2Api.products.search({ query: q.trim(), provider: prov, limit: 6 })
      setProviderResults(data.results)
      toast(`Encontrados ${data.results.length} productos`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al buscar productos')
    } finally {
      setSearchingProducts(false)
    }
  }

  const addExternalProductToTable = (item: ProductSearchItem) => {
    const newProd: ProductItem = {
      name: item.name,
      brand: item.brand || (item.provider === 'amazon' ? 'Amazon' : 'eBay'),
      badge: item.is_prime ? 'Mejor Opción ⭐' : 'Destacado',
      price: item.price != null ? `${item.price.toFixed(2)} ${item.currency}` : 'Consultar',
      rating: item.rating || '4.5/5',
      pros: item.features ? item.features.split('|').map((s) => s.trim()).filter(Boolean) : ['Excelente rendimiento', 'Buena relación calidad-precio'],
      cons: ['Consultar disponibilidad'],
      specs: { Proveedor: item.provider === 'amazon' ? 'Amazon ES' : 'eBay ES', ID: item.external_id },
      cta_text: item.provider === 'amazon' ? 'Ver en Amazon' : 'Ver en eBay',
      affiliate_url: item.affiliate_url || '',
      image_url: item.image_url || undefined,
    }
    setProducts((prev) => [...prev, newProd])
    toast(`✓ "${item.name.slice(0, 30)}..." añadido a la tabla`)
  }

  return (
    <>
      <ScopeBar projects={projects} value={scopeProject} onChange={setScopeProject} />

      <div className="banner">
        <strong>Competidores & Comparativas SEO.</strong> Analiza la estructura de contenidos de tus rivales, extrae entidades de producto y genera <strong>Tablas Comparativas Responsive</strong> optimizadas para Divi y WordPress.
      </div>

      <div className="tab-nav" style={{ marginBottom: 18 }}>
        <button
          type="button"
          className={`tab-item ${activeTab === 'domains' ? 'active' : ''}`}
          onClick={() => setActiveTab('domains')}
        >
          🌐 Dominios Competidores ({items.length})
        </button>
        <button
          type="button"
          className={`tab-item ${activeTab === 'table_generator' ? 'active' : ''}`}
          onClick={() => setActiveTab('table_generator')}
        >
          📊 Generador de Tablas Comparativas
        </button>
        <button
          type="button"
          className={`tab-item ${activeTab === 'scraper' ? 'active' : ''}`}
          onClick={() => setActiveTab('scraper')}
        >
          🔍 Scraper / Analizador de Estructura
        </button>
      </div>

      {/* TAB 1: DOMAINS */}
      {activeTab === 'domains' && (
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
      )}

      {/* TAB 2: TABLE GENERATOR */}
      {activeTab === 'table_generator' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card card-pad">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Configuración de la Tabla Comparativa</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => {
                    setProductSearchModalOpen(true)
                    if (!providerResults.length && !providerSearchQuery) {
                      setProviderSearchQuery('cafetera express')
                      void runProviderProductSearch('cafetera express', providerSearchType)
                    }
                  }}
                >
                  🔍 Buscar en Amazon / eBay
                </button>
                <button type="button" className="btn btn-sm" onClick={addProduct}>
                  + Añadir Manual
                </button>
                <button type="button" className="btn btn-sm btn-primary" onClick={handleGenerateTable} disabled={generatingTable}>
                  {generatingTable ? 'Generando...' : '⚡ Generar / Actualizar HTML'}
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 16 }}>
              <div className="field">
                <label>Título de la Tabla</label>
                <input value={tableTitle} onChange={(e) => setTableTitle(e.target.value)} />
              </div>
              <div className="field">
                <label>Insertar directamente en Página (Opcional)</label>
                <select
                  value={targetPageId || 0}
                  onChange={(e) => setTargetPageId(Number(e.target.value) || null)}
                >
                  <option value={0}>-- Solo generar código HTML --</option>
                  {pages.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* PRODUCT CARDS LIST */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {products.map((p, idx) => (
                <div
                  key={idx}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: 14,
                    background: '#f8fafc',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <strong style={{ fontSize: 14, color: '#0f172a' }}>
                      #{idx + 1} — {p.name || 'Sin nombre'}
                    </strong>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => removeProduct(idx)}
                      style={{ color: '#dc2626' }}
                    >
                      ✕ Eliminar
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                    <div className="field">
                      <label style={{ fontSize: 11 }}>Nombre del Modelo</label>
                      <input
                        value={p.name}
                        onChange={(e) => updateProductField(idx, 'name', e.target.value)}
                        style={{ fontSize: 12 }}
                      />
                    </div>
                    <div className="field">
                      <label style={{ fontSize: 11 }}>Marca</label>
                      <input
                        value={p.brand || ''}
                        onChange={(e) => updateProductField(idx, 'brand', e.target.value)}
                        style={{ fontSize: 12 }}
                      />
                    </div>
                    <div className="field">
                      <label style={{ fontSize: 11 }}>Distintivo / Badge</label>
                      <input
                        value={p.badge || ''}
                        placeholder="Mejor Calidad-Precio ⭐"
                        onChange={(e) => updateProductField(idx, 'badge', e.target.value)}
                        style={{ fontSize: 12 }}
                      />
                    </div>
                    <div className="field">
                      <label style={{ fontSize: 11 }}>Precio Aprox</label>
                      <input
                        value={p.price || ''}
                        placeholder="189,00 €"
                        onChange={(e) => updateProductField(idx, 'price', e.target.value)}
                        style={{ fontSize: 12 }}
                      />
                    </div>
                    <div className="field">
                      <label style={{ fontSize: 11 }}>Valoración</label>
                      <input
                        value={p.rating || ''}
                        placeholder="4.8/5"
                        onChange={(e) => updateProductField(idx, 'rating', e.target.value)}
                        style={{ fontSize: 12 }}
                      />
                    </div>
                    <div className="field">
                      <label style={{ fontSize: 11 }}>Enlace de Afiliado (CTA URL)</label>
                      <input
                        value={p.affiliate_url || ''}
                        placeholder="https://amazon.es/..."
                        onChange={(e) => updateProductField(idx, 'affiliate_url', e.target.value)}
                        style={{ fontSize: 12 }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* HTML & VISUAL PREVIEW */}
          {tableResult && (
            <div className="card card-pad">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${previewMode === 'visual' ? 'btn-primary' : ''}`}
                    onClick={() => setPreviewMode('visual')}
                  >
                    👁️ Vista Previa Tabla
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${previewMode === 'code' ? 'btn-primary' : ''}`}
                    onClick={() => setPreviewMode('code')}
                  >
                    &lt;/&gt; Código HTML Divi/WP
                  </button>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(tableResult.html_table)
                    toast('HTML de la tabla copiado al portapapeles')
                  }}
                >
                  📋 Copiar Código HTML
                </button>
              </div>

              {previewMode === 'visual' ? (
                <div
                  style={{ background: '#f8fafc', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  dangerouslySetInnerHTML={{ __html: tableResult.html_table }}
                />
              ) : (
                <textarea
                  readOnly
                  value={tableResult.html_table}
                  rows={14}
                  className="mono"
                  style={{ width: '100%', fontSize: 12, background: '#f8fafc' }}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SCRAPER */}
      {activeTab === 'scraper' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card card-pad">
            <h3 style={{ margin: '0 0 12px 0', fontSize: 16 }}>Extraer y Analizar Estructura de Competidor</h3>
            <p className="t-sub" style={{ margin: '0 0 16px 0' }}>
              Pega la URL de una página competidora o su contenido HTML para extraer el esquema de encabezados (H1, H2, H3), conteo de palabras, productos detectados y tablas comparativas.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="field">
                <label>URL del Competidor</label>
                <input
                  type="url"
                  placeholder="https://competidor.com/mejores-cafeteras-espresso"
                  value={scrapeUrl}
                  onChange={(e) => setScrapeUrl(e.target.value)}
                />
              </div>

              <div className="field">
                <label>O Pega el Contenido HTML / Outline Directamente</label>
                <textarea
                  placeholder="<html>... o texto de la página..."
                  value={rawHtml}
                  onChange={(e) => setRawHtml(e.target.value)}
                  rows={5}
                />
              </div>

              <div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleScrape}
                  disabled={scraping}
                >
                  {scraping ? 'Analizando...' : '🔍 Analizar Estructura'}
                </button>
              </div>
            </div>
          </div>

          {scrapeResult && (
            <div className="card card-pad">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>{scrapeResult.title}</h3>
                  <p className="t-sub" style={{ margin: '4px 0 0 0' }}>{scrapeResult.meta_description || 'Sin meta description'}</p>
                </div>
                {scrapeResult.detected_products.length > 0 && (
                  <button type="button" className="btn btn-sm btn-primary" onClick={importDetectedProducts}>
                    📥 Importar {scrapeResult.detected_products.length} Productos a Tabla Comparativa
                  </button>
                )}
              </div>

              <div className="grid grid-3" style={{ marginBottom: 20 }}>
                <div className="stat">
                  <div className="stat-label">Conteo de Palabras</div>
                  <div className="stat-value" style={{ fontSize: 18 }}>~{scrapeResult.word_count} palabras</div>
                </div>
                <div className="stat">
                  <div className="stat-label">Encabezados (H1-H3)</div>
                  <div className="stat-value" style={{ fontSize: 18 }}>{scrapeResult.headings.length} headings</div>
                </div>
                <div className="stat">
                  <div className="stat-label">Tabla Comparativa</div>
                  <div className="stat-value" style={{ fontSize: 18 }}>
                    {scrapeResult.has_comparison_table ? '✓ Detectada' : 'No detectada'}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 13 }}>Palabras Clave Más Frecuentes Detectadas:</h4>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {scrapeResult.detected_keywords.map((kw, i) => (
                    <span key={i} className="badge" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                      {kw}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 13 }}>Jerarquía de Encabezados (Outline):</h4>
                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', maxHeight: 300, overflowY: 'auto' }}>
                  {scrapeResult.headings.map((h, i) => (
                    <div
                      key={i}
                      style={{
                        paddingLeft: (h.level - 1) * 20,
                        fontSize: 13,
                        marginBottom: 4,
                        display: 'flex',
                        gap: 8,
                      }}
                    >
                      <span className="badge" style={{ fontSize: 10, padding: '1px 6px' }}>{h.tag}</span>
                      <span>{h.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CREATE DOMAIN MODAL */}
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

      {/* SEARCH PRODUCTS MODAL FOR COMPARISON TABLE */}
      <Modal
        title="🔍 Buscar Productos Oficiales (Amazon PA-API & eBay)"
        open={productSearchModalOpen}
        onClose={() => setProductSearchModalOpen(false)}
        footer={
          <button type="button" className="btn" onClick={() => setProductSearchModalOpen(false)}>
            Cerrar
          </button>
        }
      >
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <select
            value={providerSearchType}
            onChange={(e) => {
              const p = e.target.value as 'all' | 'amazon' | 'ebay'
              setProviderSearchType(p)
              if (providerSearchQuery.trim()) void runProviderProductSearch(providerSearchQuery, p)
            }}
            style={{ width: 180 }}
          >
            <option value="all">📦 Todos (Amazon + eBay)</option>
            <option value="amazon">📦 Amazon PA-API 5.0</option>
            <option value="ebay">🛒 eBay Browse API</option>
          </select>
          <input
            type="text"
            placeholder="Buscar por término o modelo..."
            value={providerSearchQuery}
            onChange={(e) => setProviderSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void runProviderProductSearch(providerSearchQuery, providerSearchType)
            }}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void runProviderProductSearch(providerSearchQuery, providerSearchType)}
            disabled={searchingProducts}
          >
            {searchingProducts ? 'Buscando...' : 'Buscar'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, maxHeight: '60vh', overflowY: 'auto', padding: 4 }}>
          {providerResults.map((item) => {
            const key = `${item.provider}-${item.external_id}`
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span
                      className={`badge ${item.provider === 'amazon' ? 'badge-warning' : 'badge-info'}`}
                      style={{ fontSize: 10, textTransform: 'uppercase' }}
                    >
                      {item.provider === 'amazon' ? 'Amazon ES' : 'eBay ES'}
                    </span>
                    {item.rating && (
                      <span style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>⭐ {item.rating}</span>
                    )}
                  </div>

                  {item.image_url && (
                    <div style={{ textAlign: 'center', marginBottom: 8, background: '#f8fafc', padding: 6, borderRadius: 6 }}>
                      <img
                        src={item.image_url}
                        alt={item.name}
                        style={{ height: 90, maxWidth: '100%', objectFit: 'contain' }}
                      />
                    </div>
                  )}

                  <h5 style={{ fontSize: 12, fontWeight: 600, margin: '0 0 4px 0', lineHeight: 1.3, color: '#1e293b' }}>
                    {item.name}
                  </h5>

                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                    {item.price != null ? `${item.price.toFixed(2)} ${item.currency}` : 'Consultar'}
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  style={{ width: '100%', marginTop: 8 }}
                  onClick={() => addExternalProductToTable(item)}
                >
                  + Añadir a la Tabla
                </button>
              </div>
            )
          })}
        </div>
      </Modal>
    </>
  )
}