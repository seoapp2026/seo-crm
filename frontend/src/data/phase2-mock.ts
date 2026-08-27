import type {
  AdsKeyword,
  AiPrompt,
  AnalyticsDataRow,
  AssistantRunResponse,
  AssistantSlug,
  Competitor,
  GoogleAuth,
  GscDataRow,
  PagePerformance,
  PerformanceSummary,
  SyncJob,
  WpExportBundle,
} from '../types/phase2'

const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

const isoNow = () => new Date().toISOString()

export const MOCK_GOOGLE_AUTH: GoogleAuth[] = [
  {
    id: 1,
    project_id: 1,
    service: 'gsc',
    account_email: 'cliente@gmail.com',
    property_id: 'sc-domain:afiliacion-hogar.com',
    property_label: 'afiliacion-hogar.com',
    connected: true,
    last_sync_at: isoNow(),
    token_expires_at: daysAgo(-30) + 'T12:00:00Z',
  },
  {
    id: 2,
    project_id: 1,
    service: 'ga4',
    account_email: 'cliente@gmail.com',
    property_id: '412345678',
    property_label: 'GA4 — Afiliación Hogar',
    connected: true,
    last_sync_at: isoNow(),
    token_expires_at: daysAgo(-30) + 'T12:00:00Z',
  },
  {
    id: 3,
    project_id: 1,
    service: 'ads',
    account_email: null,
    property_id: null,
    property_label: null,
    connected: false,
    last_sync_at: null,
    token_expires_at: null,
  },
  {
    id: 4,
    project_id: 2,
    service: 'gsc',
    account_email: null,
    property_id: null,
    property_label: null,
    connected: false,
    last_sync_at: null,
    token_expires_at: null,
  },
]

export const MOCK_SYNC_JOBS: SyncJob[] = [
  {
    id: 1,
    project_id: 1,
    job_type: 'gsc',
    schedule: 'Diario · 06:00',
    schedule_cron: '0 6 * * *',
    status: 'success',
    last_run_at: isoNow(),
    next_run_at: daysAgo(-1) + 'T06:00:00Z',
    last_error: null,
    records_synced: 1842,
    enabled: true,
  },
  {
    id: 2,
    project_id: 1,
    job_type: 'ga4',
    schedule: 'Diario · 07:00',
    schedule_cron: '0 7 * * *',
    status: 'success',
    last_run_at: isoNow(),
    next_run_at: daysAgo(-1) + 'T07:00:00Z',
    last_error: null,
    records_synced: 920,
    enabled: true,
  },
  {
    id: 3,
    project_id: 1,
    job_type: 'ads',
    schedule: 'Semanal · lunes 08:00',
    schedule_cron: '0 8 * * 1',
    status: 'idle',
    last_run_at: null,
    next_run_at: null,
    last_error: 'Google Ads: developer token pendiente de aprobación',
    records_synced: 0,
    enabled: false,
  },
]

export const MOCK_AI_PROMPTS: AiPrompt[] = [
  {
    id: 1,
    slug: 'seo_architect',
    name: 'Arquitecto SEO',
    description: 'Analiza la estructura del nicho y propone arquitectura de contenido (pilares, clusters, enlazado).',
    system_prompt:
      'Eres un arquitecto SEO senior. Analiza el nicho, páginas existentes y keywords. Propón estructura de pilares/clusters, prioridades y enlazado interno. Responde en español. No publiques nada automáticamente.',
    model_default: 'gpt-4o-mini',
    sort_order: 0,
    is_system: true,
    project_id: null,
    updated_at: isoNow(),
  },
  {
    id: 2,
    slug: 'keyword_classifier',
    name: 'Clasificador de Keywords',
    description: 'Clasifica términos por intención, dificultad estimada y página objetivo.',
    system_prompt:
      'Eres un especialista en investigación de keywords. Clasifica cada término: intención (informacional/comercial/transaccional), prioridad y página sugerida. Señala canibalización. Español.',
    model_default: 'gpt-4o-mini',
    sort_order: 10,
    is_system: true,
    project_id: null,
    updated_at: isoNow(),
  },
  {
    id: 3,
    slug: 'content_generator',
    name: 'Generador de Contenido (enriquecido)',
    description: 'Genera borradores usando métricas reales de GSC y Analytics cuando están disponibles.',
    system_prompt:
      'Eres redactor SEO. Genera borradores editables (meta, H1, cuerpo, FAQ) usando contexto de página, keywords y métricas GSC/GA4 si se proporcionan. Nunca inventes datos de tráfico sin métricas. Español.',
    model_default: 'gpt-4o-mini',
    sort_order: 20,
    is_system: true,
    project_id: null,
    updated_at: isoNow(),
  },
  {
    id: 4,
    slug: 'competitor_analyst',
    name: 'Analista de Competencia',
    description: 'Compara tu contenido con dominios competidores y detecta brechas.',
    system_prompt:
      'Eres analista de competencia SEO. Compara el proyecto con dominios rivales: brechas de contenido, oportunidades de keywords y diferenciación. Español. Supervisado.',
    model_default: 'gpt-4o',
    sort_order: 30,
    is_system: true,
    project_id: null,
    updated_at: isoNow(),
  },
  {
    id: 5,
    slug: 'continuous_optimizer',
    name: 'Optimizador Continuo',
    description: 'Sugiere mejoras en páginas con caída de rendimiento según histórico GSC/Analytics.',
    system_prompt:
      'Eres consultor de optimización SEO continua. Usa tendencias de clicks, posición y engagement para priorizar acciones concretas (título, snippet, enlaces, actualización). Español.',
    model_default: 'gpt-4o-mini',
    sort_order: 40,
    is_system: true,
    project_id: null,
    updated_at: isoNow(),
  },
]

const spark = (base: number, variance: number) =>
  Array.from({ length: 14 }, (_, i) => Math.max(0, Math.round(base + Math.sin(i) * variance)))

export const MOCK_PAGE_PERFORMANCE: PagePerformance[] = [
  {
    page_id: 1,
    page_title: 'Mejores cafeteras de oficina 2026',
    page_url: '/mejores-cafeteras-oficina-2026',
    impressions_28d: 12400,
    clicks_28d: 890,
    ctr_28d: 7.2,
    position_28d: 4.8,
    sessions_28d: 720,
    bounce_rate_28d: 42,
    trend: 'up',
    trend_pct: 18,
    status: 'winning',
    sparkline_clicks: spark(60, 15),
  },
  {
    page_id: 2,
    page_title: 'Guía de purificadores de aire',
    page_url: '/guia-purificadores-aire',
    impressions_28d: 8200,
    clicks_28d: 310,
    ctr_28d: 3.8,
    position_28d: 11.2,
    sessions_28d: 280,
    bounce_rate_28d: 58,
    trend: 'down',
    trend_pct: -22,
    status: 'declining',
    sparkline_clicks: spark(25, 8),
  },
  {
    page_id: 3,
    page_title: 'Reseña Rowenta X-Pert',
    page_url: '/resena-rowenta-xpert',
    impressions_28d: 2100,
    clicks_28d: 45,
    ctr_28d: 2.1,
    position_28d: 28.4,
    sessions_28d: 38,
    bounce_rate_28d: 71,
    trend: 'stable',
    trend_pct: 2,
    status: 'needs_work',
    sparkline_clicks: spark(3, 1),
  },
]

export function buildPerformanceSummary(projectId: number | 'all'): PerformanceSummary {
  const pages = projectId === 'all' || projectId === 1 ? MOCK_PAGE_PERFORMANCE : []
  return {
    winning: pages.filter((p) => p.status === 'winning').length,
    declining: pages.filter((p) => p.status === 'declining').length,
    needs_work: pages.filter((p) => p.status === 'needs_work').length,
    stable: pages.filter((p) => p.status === 'stable').length,
    total_clicks_28d: pages.reduce((s, p) => s + p.clicks_28d, 0),
    total_impressions_28d: pages.reduce((s, p) => s + p.impressions_28d, 0),
    total_sessions_28d: pages.reduce((s, p) => s + p.sessions_28d, 0),
    avg_position_28d: pages.length
      ? pages.reduce((s, p) => s + p.position_28d, 0) / pages.length
      : 0,
    pages,
  }
}

export const MOCK_GSC_ROWS: GscDataRow[] = [
  {
    id: 1,
    project_id: 1,
    url_id: 1,
    page_url: '/mejores-cafeteras-oficina-2026',
    date: daysAgo(1),
    impressions: 520,
    clicks: 38,
    ctr: 7.3,
    position: 4.6,
  },
  {
    id: 2,
    project_id: 1,
    url_id: 1,
    page_url: '/mejores-cafeteras-oficina-2026',
    date: daysAgo(2),
    impressions: 480,
    clicks: 35,
    ctr: 7.3,
    position: 4.9,
  },
  {
    id: 3,
    project_id: 1,
    url_id: 2,
    page_url: '/guia-purificadores-aire',
    date: daysAgo(1),
    impressions: 310,
    clicks: 9,
    ctr: 2.9,
    position: 11.8,
  },
  {
    id: 4,
    project_id: 1,
    url_id: 2,
    page_url: '/guia-purificadores-aire',
    date: daysAgo(2),
    impressions: 295,
    clicks: 11,
    ctr: 3.7,
    position: 10.9,
  },
  {
    id: 5,
    project_id: 1,
    url_id: null,
    page_url: '/resena-rowenta-xpert',
    date: daysAgo(1),
    impressions: 88,
    clicks: 2,
    ctr: 2.3,
    position: 29.1,
  },
]

export const MOCK_ANALYTICS_ROWS: AnalyticsDataRow[] = [
  {
    id: 1,
    project_id: 1,
    page_path: '/mejores-cafeteras-oficina-2026',
    date: daysAgo(1),
    sessions: 28,
    users: 24,
    bounce_rate: 41,
    avg_engagement_time: 142,
  },
  {
    id: 2,
    project_id: 1,
    page_path: '/mejores-cafeteras-oficina-2026',
    date: daysAgo(2),
    sessions: 31,
    users: 27,
    bounce_rate: 39,
    avg_engagement_time: 156,
  },
  {
    id: 3,
    project_id: 1,
    page_path: '/guia-purificadores-aire',
    date: daysAgo(1),
    sessions: 11,
    users: 10,
    bounce_rate: 62,
    avg_engagement_time: 68,
  },
  {
    id: 4,
    project_id: 1,
    page_path: '/guia-purificadores-aire',
    date: daysAgo(2),
    sessions: 9,
    users: 8,
    bounce_rate: 55,
    avg_engagement_time: 74,
  },
]

export const MOCK_ADS_KEYWORDS: AdsKeyword[] = [
  {
    id: 1,
    project_id: 1,
    term: 'cafetera oficina',
    volume: 2400,
    competition: 'MEDIUM',
    cpc_low: 0.42,
    cpc_high: 1.85,
    synced_at: daysAgo(7),
  },
  {
    id: 2,
    project_id: 1,
    term: 'mejor cafetera trabajo',
    volume: 880,
    competition: 'LOW',
    cpc_low: 0.28,
    cpc_high: 0.95,
    synced_at: daysAgo(7),
  },
  {
    id: 3,
    project_id: 1,
    term: 'purificador aire hogar',
    volume: 12100,
    competition: 'HIGH',
    cpc_low: 0.65,
    cpc_high: 2.40,
    synced_at: daysAgo(7),
  },
]

export const MOCK_COMPETITORS: Competitor[] = [
  {
    id: 1,
    project_id: 1,
    domain: 'mejoresproductos.es',
    niche_id: 1,
    notes: 'Fuerte en comparativas de electrodomésticos',
    pages_tracked: 12,
    created_at: isoNow(),
  },
  {
    id: 2,
    project_id: 1,
    domain: 'guiasdelhogar.com',
    niche_id: 1,
    notes: 'Contenido informacional, buen enlazado interno',
    pages_tracked: 8,
    created_at: isoNow(),
  },
]

export const MOCK_WP_EXPORT: WpExportBundle = {
  project_name: 'Afiliación Hogar',
  exported_at: isoNow(),
  pages: [
    {
      page_id: 1,
      title: 'Mejores cafeteras de oficina 2026',
      slug: '/mejores-cafeteras-oficina-2026',
      meta_title: 'Mejores cafeteras de oficina 2026 — Comparativa',
      meta_description: 'Comparativa actualizada de las mejores cafeteras para oficina en 2026.',
      content_type: 'TSR',
      h1: 'Mejores cafeteras de oficina en 2026',
      status: 'publicado',
      niche_name: 'Electrodomésticos hogar',
    },
    {
      page_id: 2,
      title: 'Guía de purificadores de aire',
      slug: '/guia-purificadores-aire',
      meta_title: 'Guía completa de purificadores de aire',
      meta_description: 'Todo lo que necesitas saber para elegir un purificador de aire.',
      content_type: 'TSG',
      h1: 'Guía de purificadores de aire para el hogar',
      status: 'en_revision',
      niche_name: 'Electrodomésticos hogar',
    },
  ],
}

const ASSISTANT_RESPONSES: Record<AssistantSlug, string> = {
  seo_architect: `## Arquitectura propuesta

**Pilar principal:** Comparativas de electrodomésticos (TSR)
**Clusters:** Guías informacionales (TSG) + reseñas puntuales (TSA)

### Prioridades
1. Reforzar cluster "cafeteras" — página ganadora con +18% clicks
2. Crear puente interno desde guía purificadores → comparativa cafeteras
3. Retrasar nuevas reseñas TSA hasta mejorar posición de pilares

> Borrador supervisado. Revisa antes de aplicar cambios.`,
  keyword_classifier: `| Keyword | Intención | Prioridad | Página sugerida | Canibalización |
|---------|-----------|-----------|-----------------|----------------|
| cafetera oficina | Transaccional | Alta | Mejores cafeteras… | No |
| purificador aire | Informacional | Media | Guía purificadores | No |
| rowenta xpert | Comercial | Baja | Reseña Rowenta | No |

**Acción:** Mantener "cafetera oficina" en la comparativa publicada.`,
  content_generator: `**META TITLE:** Mejores cafeteras de oficina 2026 (actualizado)
**META DESCRIPTION:** Comparativa con datos de uso real. CTR actual 7.2% — optimizar snippet.

## H1: Mejores cafeteras de oficina en 2026

### Métricas usadas (GSC 28d)
- Impresiones: 12.400 · Clicks: 890 · Posición media: 4.8

### Recomendación
Ampliar sección "para equipos pequeños" — alto engagement en GA4.`,
  competitor_analyst: `### Brechas vs mejoresproductos.es
- Ellos cubren "cafetera automática" — tú no tienes página
- Tu ventaja: comparativa más actualizada (2026)

### vs guiasdelhogar.com
- Mejor enlazado interno en guías informacionales
- Oportunidad: añadir FAQ schema en purificadores`,
  continuous_optimizer: `### Página en caída: Guía purificadores
- Clicks -22% (28d) · Posición 11.2 → revisar título y meta
- Bounce 58% — mejorar intro y tabla comparativa

### Acciones priorizadas
1. Actualizar meta description (CTR 3.8% bajo para posición)
2. Añadir 2 enlaces internos desde páginas con tráfico
3. Revisar H2 desactualizados`,
}

export function mockAssistantRun(slug: AssistantSlug, model: string): AssistantRunResponse {
  return {
    assistant: slug,
    rendered: ASSISTANT_RESPONSES[slug],
    model_used: model,
    used_metrics: slug === 'content_generator' || slug === 'continuous_optimizer',
  }
}