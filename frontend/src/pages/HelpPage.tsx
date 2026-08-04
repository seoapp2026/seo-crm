import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'

function Term({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="help-term">
      <dt>{term}</dt>
      <dd>{children}</dd>
    </div>
  )
}

export function HelpPage() {
  const { setTopbarAction } = useApp()

  useEffect(() => {
    setTopbarAction(
      <Link to="/dashboard" className="btn btn-sm">
        Volver al panel
      </Link>,
    )
    return () => setTopbarAction(null)
  }, [setTopbarAction])

  return (
    <div className="help-page">
      <div className="banner">
        <strong>Guía completa del CRM.</strong> Cómo está pensada la herramienta, cada pantalla, Google,
        Option 2 (DataForSEO), caps de coste y glosario. Actualizada con el flujo live de Análisis SEO.
      </div>

      <nav className="help-toc card card-pad">
        <h2 style={{ fontSize: 15, marginBottom: 10 }}>Contenido</h2>
        <ol className="help-toc-list">
          <li><a href="#idea">Idea general y fases</a></li>
          <li><a href="#orden">Orden recomendado de trabajo</a></li>
          <li><a href="#filtro">Filtro de proyecto (scope)</a></li>
          <li><a href="#pantallas">Pantallas del menú</a></li>
          <li><a href="#ads">Keywords Ads (Google Ads)</a></li>
          <li><a href="#google">Datos de Google (GSC / GA4)</a></li>
          <li><a href="#option2">Option 2 — Análisis SEO (DataForSEO)</a></li>
          <li><a href="#productos">Productos (hechos reales)</a></li>
          <li><a href="#ia">IA supervisada</a></li>
          <li><a href="#glosario">Glosario de términos</a></li>
          <li><a href="#problemas">Problemas frecuentes</a></li>
          <li><a href="#env">Variables de entorno (Railway)</a></li>
        </ol>
      </nav>

      <section id="idea" className="card card-pad help-section">
        <h2>1. Idea general y fases</h2>
        <p>
          Organizas el SEO como un árbol:{' '}
          <strong>Proyecto (una web) → Nicho (tema) → Página (contenido) → Keywords + URL</strong>.
          La IA, Google y WordPress se cuelgan de ese árbol. <strong>Tú siempre revisas</strong>;
          el sistema no publica solo.
        </p>
        <pre className="help-tree">
{`PROYECTO = una web (+ GSC / GA4 / Ads OAuth)
  └─ NICHO = tema / mercado
       └─ PÁGINA = artículo (TSG / TSR / TSA)
            ├─ KEYWORDS asignadas
            └─ URL publicada (slug + indexación)

Option 2 (aparte del árbol):
  Análisis SEO = jobs DataForSEO guardados
  Productos    = hechos comerciales para la IA`}
        </pre>
        <h3>Fases del producto</h3>
        <ul>
          <li><strong>Phase 1</strong> — Estructura: proyectos, nichos, páginas, keywords, URLs, enlaces, notas, IA básica.</li>
          <li><strong>Phase 2</strong> — Google: OAuth GSC/GA4/Ads, sync, tablas de datos, rendimiento, asistentes.</li>
          <li><strong>Option 2</strong> — Research externo DataForSEO + catálogo de productos + historial de análisis.</li>
        </ul>
      </section>

      <section id="orden" className="card card-pad help-section">
        <h2>2. Orden recomendado (nueva web)</h2>
        <ol className="help-steps">
          <li><Link to="/projects">Proyectos</Link> — crea la web y opcionalmente GSC / GA4 IDs.</li>
          <li><Link to="/integrations">Google OAuth</Link> — conecta Search Console → Analytics → Ads.</li>
          <li><Link to="/niches">Nichos</Link> — define temas a atacar.</li>
          <li><Link to="/pages">Páginas</Link> — planifica guías, comparativas y reseñas.</li>
          <li><Link to="/keywords">Palabras clave</Link> — asigna términos a cada página.</li>
          <li><Link to="/urls">URLs</Link> — cuando publiques, registra el slug e indexación.</li>
          <li><Link to="/links">Enlazado interno</Link> — conecta páginas; evita huérfanas.</li>
          <li><Link to="/sync">Sincronización</Link> — tira métricas reales de Google.</li>
          <li>
            Opcional research:{' '}
            <Link to="/research">Análisis SEO</Link> (DataForSEO) + <Link to="/products">Productos</Link>.
          </li>
          <li><Link to="/ai">Generador IA</Link> o <Link to="/assistants">Asistentes</Link> — borradores a revisar.</li>
          <li><Link to="/wordpress">WordPress</Link> — exporta estructura; publicas tú a mano.</li>
        </ol>
      </section>

      <section id="filtro" className="card card-pad help-section">
        <h2>3. Filtro de proyecto (barra superior)</h2>
        <p>
          En casi todas las pantallas hay un selector de <strong>proyecto</strong> (o “todos”).
        </p>
        <ul>
          <li><strong>Un proyecto</strong> — solo ves y creas datos de esa web.</li>
          <li>
            <strong>Todos</strong> — vista global; OAuth, export WP y Análisis SEO usan el primer proyecto
            si no filtras.
          </li>
        </ul>
        <p className="muted">
          Consejo: elige el proyecto correcto <em>antes</em> de crear keywords, páginas, productos o análisis.
        </p>
      </section>

      <section id="pantallas" className="card card-pad help-section">
        <h2>4. Pantallas del menú (qué hace cada una)</h2>

        <h3>Trabajo</h3>
        <ul className="help-screen-list">
          <li><strong>Panel</strong> — resumen, alertas (huérfanas, canibalización), acceso a ayuda y Análisis SEO.</li>
          <li><strong>Ayuda / Guía</strong> — esta página.</li>
          <li><strong>Proyectos</strong> — una fila ≈ una web (GSC URL + GA4 property).</li>
          <li><strong>Nichos</strong> — temas estratégicos (estado + monetización).</li>
          <li><strong>Páginas</strong> — unidades de contenido TSG/TSR/TSA + estado de workflow.</li>
          <li><strong>Palabras clave</strong> — términos por página + intención + flag canibalización.</li>
          <li><strong>URLs</strong> — slug publicado e indexación (no alimenta Keywords Ads ni es seed automático de Option 2).</li>
        </ul>

        <h3>SEO</h3>
        <ul className="help-screen-list">
          <li><strong>Enlazado interno</strong> — A → B con anchor; lista de huérfanas.</li>
          <li><strong>Notas</strong> — notas libres por proyecto.</li>
        </ul>

        <h3>Asistente / IA</h3>
        <ul className="help-screen-list">
          <li><strong>Generador IA</strong> — borrador según tipo de página y keywords.</li>
          <li><strong>Asistentes IA</strong> — 5 roles (arquitecto, clasificador, contenido, competencia, optimizador).</li>
          <li><strong>Editor de prompts</strong> — cambia el system prompt de cada asistente.</li>
        </ul>

        <h3>Datos</h3>
        <ul className="help-screen-list">
          <li><strong>Rendimiento</strong> — ganadoras / en caída / necesitan trabajo (28 días).</li>
          <li><strong>Search Console</strong> — impresiones, clicks, CTR, posición.</li>
          <li><strong>Analytics</strong> — sesiones, usuarios, rebote, engagement.</li>
          <li><strong>Keywords Ads</strong> — volumen/CPC vía Google Ads Keyword Planner (sync).</li>
          <li>
            <strong>Análisis SEO</strong> — Option 2 DataForSEO: jobs con SERP, backlinks, snapshot, informe.
          </li>
          <li><strong>Productos</strong> — hechos reales para que la IA no invente precios/stock.</li>
        </ul>

        <h3>Integraciones / publicación</h3>
        <ul className="help-screen-list">
          <li><strong>Google OAuth</strong> — conectar GSC, GA4, Ads por proyecto.</li>
          <li><strong>Sincronización</strong> — jobs gsc / ga4 / ads (programados o “ahora”).</li>
          <li><strong>Competidores</strong> — dominios + notas (contexto IA; no crawl automático).</li>
          <li><strong>WordPress</strong> — export JSON de estructura; publicación manual.</li>
        </ul>
      </section>

      <section id="ads" className="card card-pad help-section">
        <h2>5. Keywords Ads — cómo debe funcionar</h2>
        <p>
          Esta pantalla <strong>no es</strong> para crear keywords ni pegar URLs. Solo muestra métricas
          ya guardadas en <code className="mono">ads_keywords</code> tras el sync de Google Ads.
        </p>
        <h3>Flujo correcto</h3>
        <ol>
          <li>Crea términos en <Link to="/keywords">Palabras clave</Link> (proyecto correcto).</li>
          <li>Conecta <strong>Keyword Planner (Ads)</strong> en <Link to="/integrations">Integraciones</Link>.</li>
          <li>En <Link to="/sync">Sincronización</Link>, ejecuta el trabajo <strong>ads</strong>.</li>
          <li>Vuelve a <Link to="/ads-keywords">Keywords Ads</Link>.</li>
        </ol>
        <h3>Qué alimenta el sync</h3>
        <ul>
          <li>Solo los <strong>términos de texto</strong> de la tabla keywords del proyecto.</li>
        </ul>
        <h3>Qué NO alimenta el sync</h3>
        <ul>
          <li>URLs · dominios de competidores · URL del proyecto · keywords de otro proyecto</li>
        </ul>
        <p className="muted">
          Si añades keywords nuevas, hay que <strong>volver a sincronizar Ads</strong>.
          Para research por URL/competidores usa <Link to="/research">Análisis SEO</Link> (Option 2).
        </p>
      </section>

      <section id="google" className="card card-pad help-section">
        <h2>6. Datos de Google (GSC y Analytics)</h2>
        <ol>
          <li>En el proyecto: URL exacta de Search Console y Property ID de GA4.</li>
          <li>Integraciones → conectar OAuth (GSC, luego GA4).</li>
          <li>Sincronización → ejecutar jobs <code className="mono">gsc</code> y <code className="mono">ga4</code>.</li>
          <li>Las tablas y el panel de rendimiento se rellenan desde esos históricos.</li>
        </ol>
        <p>
          Si las tablas están vacías: OAuth, error del job, o filtro de proyecto incorrecto.
        </p>
      </section>

      <section id="option2" className="card card-pad help-section">
        <h2>7. Option 2 — Análisis SEO (DataForSEO) · detalle completo</h2>
        <p>
          Pantalla <Link to="/research">Análisis SEO</Link>. Un clic <strong>Analizar proyecto</strong> ejecuta un
          pack <em>fijo y acotado</em> de DataForSEO (o stub de demo) y guarda el resultado en el CRM.
        </p>

        <h3>Qué incluye un análisis</h3>
        <ul>
          <li>Keywords: volumen, competencia, CPC (Google Ads search volume)</li>
          <li>Ideas relacionadas (Labs related keywords, limitadas)</li>
          <li>SERP orgánico Google (regular live, máx. 10 queries)</li>
          <li>Snapshot on-page de 1 URL (title, meta, H1–H3)</li>
          <li>Backlinks summary + referring domains por tu sitio y hasta 3 competidores</li>
          <li>Link gap (dominios que enlazan al rival y no a ti)</li>
          <li>Oportunidades derivadas + informe de estrategia</li>
        </ul>

        <h3>Cómo activar datos REALES</h3>
        <ol>
          <li>Cuenta DataForSEO + saldo pay-as-you-go.</li>
          <li>
            API Access → copiar <strong>login</strong> y <strong>password de API</strong> (no la contraseña web).
          </li>
          <li>
            Railway:{' '}
            <code className="mono">DATAFORSEO_LOGIN</code>, <code className="mono">DATAFORSEO_PASSWORD</code>,{' '}
            <code className="mono">DATAFORSEO_FORCE_STUB=false</code>.
          </li>
          <li>Redeploy. Health debe mostrar <code className="mono">dataforseo.using_stub: false</code>.</li>
          <li>
            En Análisis SEO: estado <strong>● DataForSEO live listo</strong>.
          </li>
        </ol>

        <h3>Modo stub</h3>
        <p>
          Sin credenciales (o con force stub) se generan datos de ejemplo, <strong>0 € de API</strong>, para probar
          la UI y el historial. El job se marca <code className="mono">used_stub</code>.
        </p>

        <h3>Hard caps (servidor)</h3>
        <ul>
          <li>Máx. <strong>3</strong> competidores</li>
          <li>Máx. <strong>20</strong> keywords semilla · hasta <strong>100</strong> términos guardados</li>
          <li>Máx. <strong>10</strong> queries SERP · 10 resultados c/u</li>
          <li>Máx. <strong>1</strong> URL de snapshot</li>
          <li>Máx. <strong>50</strong> referring domains por dominio · <strong>100</strong> filas link gap</li>
          <li><strong>1</strong> análisis concurrente por proyecto · <strong>2</strong> globales</li>
          <li>Análisis <strong>manual</strong> (no nightly auto-refresh)</li>
          <li>Reabrir historial = <strong>gratis</strong>; re-run = nuevo coste</li>
          <li>Presupuesto soft/hard mensual por defecto <strong>50 € / 100 €</strong></li>
        </ul>

        <h3>Endpoints whitelist (solo estos)</h3>
        <ul className="mono" style={{ fontSize: 12 }}>
          <li>/v3/keywords_data/google_ads/search_volume/live</li>
          <li>/v3/dataforseo_labs/google/related_keywords/live</li>
          <li>/v3/serp/google/organic/live/regular</li>
          <li>/v3/on_page/instant_pages</li>
          <li>/v3/backlinks/summary/live</li>
          <li>/v3/backlinks/referring_domains/live</li>
        </ul>

        <h3>Pestañas del resultado</h3>
        <ul>
          <li><strong>Informe IA</strong> — arquitectura, clusters, next steps</li>
          <li><strong>Keywords</strong> — volumen, CPC, fuente seed/idea</li>
          <li><strong>SERP</strong> — posiciones orgánicas</li>
          <li><strong>Snapshot</strong> — on-page de la URL principal</li>
          <li><strong>Backlinks</strong> — resumen + link gap</li>
          <li><strong>Oportunidades</strong> — acciones priorizadas</li>
        </ul>

        <h3>No incluido en Option 2</h3>
        <ul>
          <li>Crawler multipágina · charts Ahrefs · outreach · otras APIs SEO · loops ilimitados</li>
        </ul>
        <p className="muted">
          Guía ops completa en el repositorio: <code className="mono">docs/OPTION2_DATAFORSEO_GUIDE.md</code>.
        </p>
      </section>

      <section id="productos" className="card card-pad help-section">
        <h2>8. Productos (hechos reales para la IA)</h2>
        <p>
          Pantalla <Link to="/products">Productos</Link>. Guarda datos comerciales verificables por proyecto.
        </p>
        <ul>
          <li>Nombre, marca, SKU, características, precio, moneda, stock, opiniones aprobadas, URL fuente.</li>
          <li>
            <strong>Regla dura:</strong> la IA no debe inventar precio, stock, features u opiniones que no estén aquí.
            Si falta un dato → “needs data” / placeholder.
          </li>
          <li>Rellena productos <em>antes</em> de generar reseñas TSA o copy comercial.</li>
        </ul>
      </section>

      <section id="ia" className="card card-pad help-section">
        <h2>9. IA supervisada — reglas claras</h2>
        <ul>
          <li>La IA <strong>propone</strong>; <strong>tú</strong> revisas y publicas.</li>
          <li><strong>Nadie publica en WordPress automáticamente</strong>.</li>
          <li>Generador: título, tipo TSG/TSR/TSA, objetivo y keywords de la página.</li>
          <li>Algunos asistentes inyectan métricas GSC/GA4 si hay sync.</li>
          <li>Resultados formateados (títulos, listas, meta). Usa <strong>Copiar texto</strong>.</li>
          <li>Productos: solo hechos del catálogo (ver §8).</li>
        </ul>
        <h3>Los 5 asistentes</h3>
        <ul>
          <li><strong>Arquitecto SEO</strong> — pilares y clusters del nicho.</li>
          <li><strong>Clasificador de keywords</strong> — intención, prioridad, canibalización.</li>
          <li><strong>Generador de contenido</strong> — borrador (puede usar métricas).</li>
          <li><strong>Analista de competencia</strong> — dominio + notas del competidor guardado.</li>
          <li><strong>Optimizador continuo</strong> — acciones si cae el rendimiento.</li>
        </ul>
      </section>

      <section id="glosario" className="card card-pad help-section">
        <h2>10. Glosario de términos</h2>
        <dl className="help-glossary">
          <Term term="Proyecto">Una web en el CRM. Tiene sus integraciones Google y datos.</Term>
          <Term term="Nicho">Tema o mercado dentro del proyecto.</Term>
          <Term term="Página">Unidad de contenido planificada (no tiene por qué estar publicada).</Term>
          <Term term="TSG / TSR / TSA">Guía informacional / comparativa comercial / reseña de producto.</Term>
          <Term term="Keyword">Término de búsqueda asignado a una página.</Term>
          <Term term="Intención">Informacional / comercial / transaccional.</Term>
          <Term term="Canibalización">
            En este CRM: el mismo término aparece más de una vez en el proyecto.
          </Term>
          <Term term="Página huérfana">Sin enlaces internos entrantes registrados.</Term>
          <Term term="Slug / URL">Ruta publicada; sirve para mapear GSC/GA; no es seed de Ads ni de Option 2 sola.</Term>
          <Term term="GSC">Search Console: impresiones, clicks, CTR, posición.</Term>
          <Term term="GA4">Analytics: sesiones, usuarios, rebote, engagement.</Term>
          <Term term="Keywords Ads">Métricas Keyword Planner vía cuenta Google Ads + sync.</Term>
          <Term term="Análisis SEO / Option 2">Job DataForSEO con SERP, backlinks, snapshot e informe.</Term>
          <Term term="Stub">Datos de ejemplo sin gastar API (sin credenciales DataForSEO).</Term>
          <Term term="Live">Llamadas reales a DataForSEO con login/password de API.</Term>
          <Term term="Link gap">Dominios que enlazan a competidores y no a ti.</Term>
          <Term term="Hard cap">Límite de servidor que rechaza o bloquea (coste/seguridad).</Term>
          <Term term="Productos">Hechos comerciales reales para la IA.</Term>
          <Term term="Sync">Job que copia datos de Google al CRM.</Term>
          <Term term="Supervisado">La IA no publica sola; un humano aprueba.</Term>
          <Term term="CPC">Coste por click estimado (publicidad); orientativo para priorizar SEO.</Term>
          <Term term="Volumen">Búsquedas medias mensuales estimadas del término.</Term>
          <Term term="OAuth">Conexión segura con Google; tokens solo en servidor.</Term>
        </dl>
      </section>

      <section id="problemas" className="card card-pad help-section">
        <h2>11. Problemas frecuentes</h2>
        <table className="help-table">
          <thead>
            <tr>
              <th>Síntoma</th>
              <th>Qué mirar</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Keywords Ads vacío o incompleto</td>
              <td>Keywords en el proyecto · Ads conectado · job ads OK · re-sync tras nuevas keywords</td>
            </tr>
            <tr>
              <td>Añadí una URL y no sale en Ads</td>
              <td>Normal: Ads solo usa términos de Palabras clave. Research por URL → Análisis SEO</td>
            </tr>
            <tr>
              <td>GSC / Analytics vacíos</td>
              <td>OAuth + IDs del proyecto + sync; error del job</td>
            </tr>
            <tr>
              <td>Rendimiento en ceros</td>
              <td>Sin datos GSC/GA o slug no coincide con URLs de Google</td>
            </tr>
            <tr>
              <td>IA da error</td>
              <td><code className="mono">OPENAI_API_KEY</code>; elige página/nicho/competidor</td>
            </tr>
            <tr>
              <td>Análisis SEO siempre stub</td>
              <td>
                <code className="mono">DATAFORSEO_LOGIN</code> / <code className="mono">PASSWORD</code>, redeploy, no
                force stub
              </td>
            </tr>
            <tr>
              <td>400 máx. competidores / keywords</td>
              <td>Máx. 3 competidores y 20 semillas únicas</td>
            </tr>
            <tr>
              <td>Tope mensual hard</td>
              <td>Sube <code className="mono">DATAFORSEO_HARD_MONTHLY_EUR</code> o espera al mes siguiente</td>
            </tr>
            <tr>
              <td>IA inventa precio de producto</td>
              <td>Rellena <Link to="/products">Productos</Link> antes de generar</td>
            </tr>
            <tr>
              <td>Página huérfana</td>
              <td>Crea enlace entrante en Enlazado interno</td>
            </tr>
            <tr>
              <td>Canibalización</td>
              <td>Mismo término en dos filas de keywords; unifica estrategia</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section id="env" className="card card-pad help-section">
        <h2>12. Variables de entorno relevantes (Railway)</h2>
        <h3>Core</h3>
        <ul className="mono" style={{ fontSize: 12.5 }}>
          <li>DATABASE_URL · OPENAI_API_KEY · SECRET_KEY · APP_AUTH_PASSWORD · AUTH_ALLOWED_EMAILS</li>
          <li>APP_ENV · APP_PUBLIC_URL · CORS_ORIGINS</li>
        </ul>
        <h3>Google</h3>
        <ul className="mono" style={{ fontSize: 12.5 }}>
          <li>GOOGLE_CLIENT_ID · GOOGLE_CLIENT_SECRET · GOOGLE_REDIRECT_URI</li>
          <li>GOOGLE_ADS_DEVELOPER_TOKEN · GOOGLE_ADS_CUSTOMER_ID · GOOGLE_ADS_LOGIN_CUSTOMER_ID</li>
        </ul>
        <h3>Option 2 DataForSEO</h3>
        <ul className="mono" style={{ fontSize: 12.5 }}>
          <li>DATAFORSEO_LOGIN · DATAFORSEO_PASSWORD · DATAFORSEO_FORCE_STUB</li>
          <li>DATAFORSEO_SOFT_MONTHLY_EUR · DATAFORSEO_HARD_MONTHLY_EUR</li>
          <li>DATAFORSEO_MAX_COMPETITORS · MAX_SEED_KEYWORDS · MAX_SERP_QUERIES · … (ver .env.example)</li>
        </ul>
        <p className="muted" style={{ marginTop: 12 }}>
          Comprobar: <code className="mono">GET /api/seo-crm/health</code> → bloques <code className="mono">google_ads</code> y{' '}
          <code className="mono">dataforseo</code>.
        </p>
        <p style={{ marginTop: 16 }}>
          ¿Dudas de flujo? Empieza por el <Link to="/dashboard">Panel</Link> y el orden de la sección 2.
        </p>
      </section>
    </div>
  )
}
