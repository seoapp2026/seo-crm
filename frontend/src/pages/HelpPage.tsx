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
        <strong>Guía del CRM.</strong> Esta página explica cómo está pensada la herramienta, qué hace
        cada pantalla y el significado de los términos. Léela una vez y úsala como referencia.
      </div>

      <nav className="help-toc card card-pad">
        <h2 style={{ fontSize: 15, marginBottom: 10 }}>Contenido</h2>
        <ol className="help-toc-list">
          <li><a href="#idea">Idea general</a></li>
          <li><a href="#orden">Orden recomendado de trabajo</a></li>
          <li><a href="#filtro">Filtro de proyecto (scope)</a></li>
          <li><a href="#pantallas">Pantallas del menú</a></li>
          <li><a href="#ads">Keywords Ads (Google Ads)</a></li>
          <li><a href="#google">Datos de Google (GSC / GA4)</a></li>
          <li><a href="#ia">IA supervisada</a></li>
          <li><a href="#glosario">Glosario de términos</a></li>
          <li><a href="#option2">Option 2 — Análisis SEO (hard caps)</a></li>
          <li><a href="#problemas">Problemas frecuentes</a></li>
        </ol>
      </nav>

      <section id="idea" className="card card-pad help-section">
        <h2>1. Idea general en una frase</h2>
        <p>
          Organizas el SEO como un árbol:{' '}
          <strong>Proyecto (una web) → Nicho (tema) → Página (contenido) → Keywords + URL</strong>.
          La IA, Google y WordPress se cuelgan de ese árbol. <strong>Tú siempre revisas</strong>;
          el sistema no publica solo.
        </p>
        <pre className="help-tree">
{`PROYECTO = una web
  └─ NICHO = tema / mercado
       └─ PÁGINA = artículo planificado (TSG / TSR / TSA)
            ├─ KEYWORDS asignadas
            └─ URL publicada (slug + indexación)`}
        </pre>
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
          <li><strong>Todos</strong> — vista global; algunas acciones (OAuth, export WP) usan el primer proyecto si no filtras.</li>
        </ul>
        <p className="muted">
          Consejo: elige el proyecto correcto <em>antes</em> de crear keywords, páginas o competidores.
        </p>
      </section>

      <section id="pantallas" className="card card-pad help-section">
        <h2>4. Pantallas del menú (qué hace cada una)</h2>

        <h3>Trabajo</h3>
        <ul className="help-screen-list">
          <li><strong>Panel</strong> — resumen: conteos, alertas (huérfanas, canibalización), teaser de rendimiento.</li>
          <li><strong>Proyectos</strong> — una fila ≈ una web. Aquí van URL de Search Console y Property ID de GA4.</li>
          <li><strong>Nichos</strong> — temas estratégicos dentro del proyecto (estado + monetización).</li>
          <li><strong>Páginas</strong> — unidades de contenido con tipo TSG/TSR/TSA y estado de workflow.</li>
          <li><strong>Palabras clave</strong> — términos asignados a una página + intención de búsqueda.</li>
          <li><strong>URLs</strong> — slug publicado e estado de indexación (no alimenta Keywords Ads por sí solo).</li>
        </ul>

        <h3>SEO</h3>
        <ul className="help-screen-list">
          <li><strong>Enlazado interno</strong> — de página A → página B con anchor; lista de <em>huérfanas</em>.</li>
          <li><strong>Notas</strong> — notas libres por proyecto.</li>
        </ul>

        <h3>Asistente / IA</h3>
        <ul className="help-screen-list">
          <li><strong>Generador IA</strong> — un clic: borrador según tipo de página y sus keywords.</li>
          <li><strong>Asistentes IA</strong> — 5 roles (arquitecto, clasificador, contenido, competencia, optimizador).</li>
          <li><strong>Editor de prompts</strong> — cambia el “cerebro” de cada asistente sin tocar código.</li>
        </ul>

        <h3>Datos</h3>
        <ul className="help-screen-list">
          <li><strong>Rendimiento</strong> — ganadoras / en caída / necesitan trabajo (últimos 28 días).</li>
          <li><strong>Search Console</strong> — impresiones, clicks, CTR, posición por URL y fecha.</li>
          <li><strong>Analytics</strong> — sesiones, usuarios, rebote, engagement.</li>
          <li><strong>Keywords Ads</strong> — volumen, competencia y CPC desde Keyword Planner (tras sync).</li>
        </ul>

        <h3>Integraciones / publicación</h3>
        <ul className="help-screen-list">
          <li><strong>Google OAuth</strong> — conectar o desconectar GSC, GA4 y Ads por proyecto.</li>
          <li><strong>Sincronización</strong> — trabajos programados o “ejecutar ahora”.</li>
          <li><strong>Competidores</strong> — dominios rivales + notas (no es un crawler automático).</li>
          <li><strong>WordPress</strong> — export JSON de estructura; publicación siempre manual.</li>
        </ul>
      </section>

      <section id="ads" className="card card-pad help-section">
        <h2>5. Keywords Ads — cómo debe funcionar</h2>
        <p>
          Esta pantalla <strong>no es</strong> para crear keywords ni pegar URLs. Solo muestra métricas
          ya guardadas en la tabla <code className="mono">ads_keywords</code>.
        </p>
        <h3>Flujo correcto</h3>
        <ol>
          <li>Crea términos en <Link to="/keywords">Palabras clave</Link> (del proyecto correcto).</li>
          <li>Conecta <strong>Keyword Planner (Ads)</strong> en <Link to="/integrations">Integraciones</Link>.</li>
          <li>En <Link to="/sync">Sincronización</Link>, ejecuta el trabajo <strong>ads</strong>.</li>
          <li>Vuelve a <Link to="/ads-keywords">Keywords Ads</Link> y filtra por ese proyecto.</li>
        </ol>
        <h3>Qué SÍ alimenta el sync de Ads</h3>
        <ul>
          <li>Los <strong>términos de texto</strong> de la tabla de keywords del proyecto.</li>
        </ul>
        <h3>Qué NO alimenta el sync</h3>
        <ul>
          <li>URLs de la pantalla URLs</li>
          <li>Dominios de competidores</li>
          <li>URL del sitio en el proyecto</li>
          <li>Keywords de otro proyecto (aunque veas “todos” en el menú)</li>
        </ul>
        <p className="muted">
          Si añades keywords nuevas, hay que <strong>volver a sincronizar Ads</strong> para que aparezcan aquí.
        </p>
      </section>

      <section id="google" className="card card-pad help-section">
        <h2>6. Datos de Google (GSC y Analytics)</h2>
        <ol>
          <li>En el proyecto: URL exacta de Search Console y Property ID de GA4.</li>
          <li>Integraciones → conectar OAuth (GSC, luego GA4).</li>
          <li>Sincronización → ejecutar jobs <code className="mono">gsc</code> y <code className="mono">ga4</code>.</li>
          <li>Las tablas y el panel de rendimiento se rellenan solos desde esos históricos.</li>
        </ol>
        <p>
          Si las tablas están vacías: o no hay OAuth, o el sync falló (mira el error del job), o el
          filtro de proyecto no coincide.
        </p>
      </section>

      <section id="ia" className="card card-pad help-section">
        <h2>7. IA supervisada — reglas claras</h2>
        <ul>
          <li>La IA <strong>propone</strong> borradores y análisis.</li>
          <li><strong>Tú</strong> revisas, editas y decides.</li>
          <li><strong>Nadie publica en WordPress automáticamente</strong>.</li>
          <li>El Generador usa título, tipo (TSG/TSR/TSA), objetivo y keywords de la página.</li>
          <li>Algunos asistentes (contenido / optimizador) pueden inyectar métricas GSC/GA4 si hay sync.</li>
          <li>Los resultados se muestran formateados (títulos, listas, meta). Usa <strong>Copiar</strong> para llevarlos a un editor.</li>
        </ul>
        <h3>Los 5 asistentes</h3>
        <ul>
          <li><strong>Arquitecto SEO</strong> — estructura de pilares y clusters del nicho.</li>
          <li><strong>Clasificador de keywords</strong> — intención, prioridad, canibalización.</li>
          <li><strong>Generador de contenido</strong> — borrador enriquecido (puede usar métricas).</li>
          <li><strong>Analista de competencia</strong> — usa el dominio y notas del competidor guardado.</li>
          <li><strong>Optimizador continuo</strong> — acciones si la página cae en rendimiento.</li>
        </ul>
      </section>

      <section id="glosario" className="card card-pad help-section">
        <h2>8. Glosario de términos</h2>
        <dl className="help-glossary">
          <Term term="Proyecto">
            Una web que gestionas en el CRM. Tiene sus propias integraciones Google y datos.
          </Term>
          <Term term="Nicho">
            Un tema o mercado dentro del proyecto (ej. “energía solar residencial”). Agrupa páginas y estrategia.
          </Term>
          <Term term="Página">
            Una unidad de contenido planificada (no tiene por qué estar publicada aún).
          </Term>
          <Term term="TSG (guía)">
            Contenido informacional / guía pilar. Educa; suele captar tráfico de búsqueda informacional.
          </Term>
          <Term term="TSR (comparativa)">
            Comparativa comercial (A vs B, “mejores X”). Orientada a decisión de compra.
          </Term>
          <Term term="TSA (reseña)">
            Reseña de un producto o servicio concreto.
          </Term>
          <Term term="Keyword / palabra clave">
            Término de búsqueda que asignas a una página para orientar SEO y la IA.
          </Term>
          <Term term="Intención de búsqueda">
            Por qué busca el usuario: <em>informacional</em> (aprender), <em>comercial</em> (comparar),{' '}
            <em>transaccional</em> (comprar / contactar).
          </Term>
          <Term term="Canibalización">
            En este CRM: el <strong>mismo término</strong> aparece en más de una keyword del proyecto.
            Señala riesgo de que dos páginas compitan por lo mismo.
          </Term>
          <Term term="Página huérfana">
            Página del CRM sin ningún enlace interno <em>entrante</em> registrado. Dificulta descubrimiento y SEO.
          </Term>
          <Term term="Slug / URL">
            Ruta publicada de la página (ej. <code className="mono">/mejores-placas-solares</code>). Sirve para
            mapear datos de GSC/Analytics; no es input de Keyword Planner aquí.
          </Term>
          <Term term="Indexada / pendiente / noindex">
            Estado de indexación que registras manualmente: si Google la tiene en índice, está pendiente o la
            marcas noindex.
          </Term>
          <Term term="GSC (Search Console)">
            Datos de Google sobre cómo se ve tu web en la búsqueda: impresiones, clicks, CTR, posición.
          </Term>
          <Term term="Impresiones">
            Veces que una URL o consulta se mostró en resultados de Google (aunque no hagan click).
          </Term>
          <Term term="Clicks">
            Veces que alguien hizo click desde Google hacia tu URL.
          </Term>
          <Term term="CTR">
            Click-through rate: clicks ÷ impresiones. Un CTR bajo con muchas impresiones puede indicar mal título/snippet.
          </Term>
          <Term term="Posición media">
            Posición aproximada en resultados de Google (1 = arriba del todo).
          </Term>
          <Term term="GA4 (Analytics)">
            Comportamiento en tu web: sesiones, usuarios, rebote, tiempo de engagement.
          </Term>
          <Term term="Sesión">
            Visita al sitio (periodo de actividad del usuario).
          </Term>
          <Term term="Tasa de rebote">
            Porcentaje de visitas con poca o ninguna interacción. Alta no siempre es malo en landings, pero hay que contextualizar.
          </Term>
          <Term term="Keyword Planner / Keywords Ads">
            Métricas de planificación de Google Ads: volumen de búsqueda estimado, competencia y rango de CPC.
            Aquí se usan para priorizar SEO, no para gestionar campañas.
          </Term>
          <Term term="Volumen / mes">
            Búsquedas medias mensuales estimadas del término (orden de magnitud, no exacto al día).
          </Term>
          <Term term="Competencia (Ads)">
            Nivel LOW / MEDIUM / HIGH de competencia publicitaria en Google Ads (no es “dificultad SEO” de Ahrefs).
          </Term>
          <Term term="CPC bajo / alto">
            Rango estimado de coste por click en la parte superior de resultados de pago (orientativo).
          </Term>
          <Term term="OAuth">
            Conexión segura con tu cuenta Google. El CRM guarda tokens en el servidor; el navegador no llama a Google Ads con el developer token.
          </Term>
          <Term term="Sync / sincronización">
            Trabajo que descarga datos de Google y los guarda en el CRM para que las pantallas de datos los lean.
          </Term>
          <Term term="Supervisado">
            La IA no actúa sola en producción de contenido: genera propuestas; un humano aprueba y publica.
          </Term>
          <Term term="Competidor (módulo)">
            Registro de un dominio rival + notas. Sirve de contexto al asistente; no rastrea la web sola.
          </Term>
          <Term term="Export WordPress">
            JSON con títulos, slugs, tipos y estados para copiar/importar a mano. No publica posts por API.
          </Term>
        </dl>
      </section>

      <section id="option2" className="card card-pad help-section">
        <h2>9. Option 2 — Análisis SEO (DataForSEO) · hard caps</h2>
        <p>
          Pantalla <Link to="/research">Análisis SEO</Link>: un clic <strong>Analizar proyecto</strong> guarda un
          snapshot (keywords, SERP, snapshot on-page, backlinks básicos, link gap, oportunidades + informe IA).
          Catálogo <Link to="/products">Productos</Link> para hechos reales.
        </p>
        <h3>Hard caps (no negociables en v1)</h3>
        <ul>
          <li>Máx. <strong>3 competidores</strong> por análisis</li>
          <li>Máx. <strong>20 keywords semilla</strong> · hasta 100 términos guardados</li>
          <li>Máx. <strong>10 queries SERP</strong> · 10 resultados c/u</li>
          <li>Máx. <strong>1 URL</strong> de snapshot on-page</li>
          <li>Máx. <strong>50</strong> backlinks / referring domains por dominio</li>
          <li>Análisis <strong>manual</strong> (no nightly auto-refresh)</li>
          <li>Reabrir historial = <strong>gratis</strong>; re-run = nuevo coste</li>
          <li>Presupuesto soft/hard mensual (por defecto 50 € / 100 €)</li>
        </ul>
        <h3>No incluido</h3>
        <ul>
          <li>Crawler multipágina · charts tipo Ahrefs · outreach de enlaces · otras APIs SEO</li>
        </ul>
        <p className="muted">
          Sin credenciales DataForSEO el sistema corre en <strong>modo stub</strong> (datos de ejemplo, 0 € API)
          para validar flujo. PR2 conectará el cliente live.
        </p>
      </section>

      <section id="problemas" className="card card-pad help-section">
        <h2>10. Problemas frecuentes</h2>
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
              <td>
                ¿Keywords en ese proyecto? ¿Ads conectado? ¿Job ads en éxito? ¿Re-sync tras añadir términos?
              </td>
            </tr>
            <tr>
              <td>Añadí una URL y no sale en Ads</td>
              <td>Normal: Ads solo usa términos de Palabras clave, no URLs.</td>
            </tr>
            <tr>
              <td>GSC / Analytics vacíos</td>
              <td>OAuth + IDs en el proyecto + sync. Revisa error del job.</td>
            </tr>
            <tr>
              <td>Rendimiento en ceros</td>
              <td>Sin datos GSC/GA o el slug de la URL no coincide con las URLs de Google.</td>
            </tr>
            <tr>
              <td>IA da error</td>
              <td>Falta <code className="mono">OPENAI_API_KEY</code> en el servidor, o elige página/nicho/competidor.</td>
            </tr>
            <tr>
              <td>Competidor “guardado” y desaparece</td>
              <td>Tras el último fix de API, debe persistir. Si no, recarga y comprueba el proyecto filtrado.</td>
            </tr>
            <tr>
              <td>Página huérfana</td>
              <td>Crea un enlace interno desde otra página hacia ella en Enlazado interno.</td>
            </tr>
            <tr>
              <td>Canibalización</td>
              <td>El mismo término está en dos filas de keywords; reasigna o unifica la estrategia.</td>
            </tr>
          </tbody>
        </table>
        <p style={{ marginTop: 16 }}>
          ¿Dudas de flujo? Empieza por el <Link to="/dashboard">Panel</Link> y el orden de la sección 2.
        </p>
      </section>
    </div>
  )
}
