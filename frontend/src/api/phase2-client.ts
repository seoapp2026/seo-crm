import { API_BASE } from './base'
import { apiFetch } from './http'
import type {
  AdsKeyword,
  AiPrompt,
  AiPromptCreate,
  AiPromptReorderItem,
  AnalyticsDataRow,
  AssistantRunRequest,
  AssistantRunResponse,
  ComparisonTableGenerateRequest,
  ComparisonTableGenerateResponse,
  Competitor,
  CompetitorScrapeRequest,
  CompetitorScrapeResponse,
  ContextPreviewRequest,
  ContextPreviewResponse,
  DateRange,
  GoogleAuth,
  GoogleService,
  GscSite,
  GscDataRow,
  PerformanceSummary,
  Product,
  ResearchBudget,
  ResearchCaps,
  ResearchJob,
  ResearchJobCreate,
  ResearchJobDetail,
  SyncJob,
  SyncJobType,
  WpExportBundle,
  WpPushRequest,
  WpPushResponse,
  WpTestConnectionRequest,
  WpTestConnectionResponse,
} from '../types/phase2'

async function parseApiError(res: Response): Promise<string> {
  try {
    const body = await res.json()
    if (typeof body?.detail === 'string') return body.detail
    if (Array.isArray(body?.detail)) {
      return body.detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join(', ') || res.statusText
    }
  } catch {
    /* ignore */
  }
  return res.statusText || 'Error del servidor'
}

/** Always hit the real backend; surface errors instead of silent mock data. */
async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch(path, options)
  if (!res.ok) throw new Error(await parseApiError(res))
  if (res.status === 204) return undefined as T
  return res.json()
}

function projectQuery(projectId: number | 'all') {
  return projectId === 'all' ? '' : `?project_id=${projectId}`
}

export const phase2Api = {
  integrations: {
    list: async (projectId: number | 'all') => {
      return apiRequest<GoogleAuth[]>(`${API_BASE}/integrations/google${projectQuery(projectId)}`)
    },
    connect: async (projectId: number, service: GoogleService): Promise<{ auth_url: string }> => {
      const data = await apiRequest<{ auth_url: string }>(
        `${API_BASE}/integrations/google/connect`,
        {
          method: 'POST',
          body: JSON.stringify({ project_id: projectId, service }),
        },
      )
      if (!data.auth_url) throw new Error('El servidor no devolvió la URL de autorización OAuth')
      return data
    },
    disconnect: async (id: number) => {
      await apiRequest<void>(`${API_BASE}/integrations/google/${id}`, { method: 'DELETE' })
    },
    listGscSites: async (projectId: number) => {
      return apiRequest<GscSite[]>(`${API_BASE}/integrations/google/gsc-sites?project_id=${projectId}`)
    },
  },

  sync: {
    list: async (projectId: number | 'all') => {
      return apiRequest<SyncJob[]>(`${API_BASE}/sync/jobs${projectQuery(projectId)}`)
    },
    runNow: async (jobId: number) => {
      return apiRequest<SyncJob>(`${API_BASE}/sync/jobs/${jobId}/run`, { method: 'POST' })
    },
    toggle: async (jobId: number, enabled: boolean) => {
      return apiRequest<SyncJob>(`${API_BASE}/sync/jobs/${jobId}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      })
    },
  },

  performance: {
    summary: async (projectId: number | 'all') => {
      return apiRequest<PerformanceSummary>(
        `${API_BASE}/performance/summary${projectQuery(projectId)}`,
      )
    },
  },

  gsc: {
    list: async (projectId: number | 'all', range?: DateRange) => {
      const qs = new URLSearchParams()
      if (projectId !== 'all') qs.set('project_id', String(projectId))
      if (range?.from) qs.set('from', range.from)
      if (range?.to) qs.set('to', range.to)
      const q = qs.toString() ? `?${qs}` : ''
      return apiRequest<GscDataRow[]>(`${API_BASE}/gsc/data${q}`)
    },
  },

  analytics: {
    list: async (projectId: number | 'all', range?: DateRange) => {
      const qs = new URLSearchParams()
      if (projectId !== 'all') qs.set('project_id', String(projectId))
      if (range?.from) qs.set('from', range.from)
      if (range?.to) qs.set('to', range.to)
      const q = qs.toString() ? `?${qs}` : ''
      return apiRequest<AnalyticsDataRow[]>(`${API_BASE}/analytics/data${q}`)
    },
  },

  adsKeywords: {
    list: async (projectId: number | 'all') => {
      return apiRequest<AdsKeyword[]>(`${API_BASE}/ads/keywords${projectQuery(projectId)}`)
    },
  },

  competitors: {
    list: async (projectId: number | 'all') => {
      return apiRequest<Competitor[]>(`${API_BASE}/competitors${projectQuery(projectId)}`)
    },
    create: async (data: Omit<Competitor, 'id' | 'created_at' | 'pages_tracked'>) => {
      return apiRequest<Competitor>(`${API_BASE}/competitors`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },
    update: async (id: number, data: Partial<Competitor>) => {
      return apiRequest<Competitor>(`${API_BASE}/competitors/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      })
    },
    remove: async (id: number) => {
      await apiRequest<void>(`${API_BASE}/competitors/${id}`, { method: 'DELETE' })
    },
    scrapeStructure: async (data: CompetitorScrapeRequest) => {
      return apiRequest<CompetitorScrapeResponse>(`${API_BASE}/competitors/scrape-structure`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },
    generateComparisonTable: async (data: ComparisonTableGenerateRequest) => {
      return apiRequest<ComparisonTableGenerateResponse>(
        `${API_BASE}/competitors/generate-comparison-table`,
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
      )
    },
  },

  prompts: {
    list: async (projectId?: number) => {
      const q = projectId ? `?project_id=${projectId}` : ''
      return apiRequest<AiPrompt[]>(`${API_BASE}/ai/prompts${q}`)
    },
    get: async (id: number) => {
      return apiRequest<AiPrompt>(`${API_BASE}/ai/prompts/${id}`)
    },
    create: async (payload: AiPromptCreate) => {
      return apiRequest<AiPrompt>(`${API_BASE}/ai/prompts`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    },
    update: async (id: number, payload: Partial<AiPrompt>) => {
      return apiRequest<AiPrompt>(`${API_BASE}/ai/prompts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
    },
    duplicate: async (id: number) => {
      return apiRequest<AiPrompt>(`${API_BASE}/ai/prompts/${id}/duplicate`, {
        method: 'POST',
      })
    },
    remove: async (id: number, force = false) => {
      const q = force ? '?force=true' : ''
      await apiRequest<void>(`${API_BASE}/ai/prompts/${id}${q}`, { method: 'DELETE' })
    },
    reorder: async (items: AiPromptReorderItem[]) => {
      return apiRequest<AiPrompt[]>(`${API_BASE}/ai/prompts/reorder`, {
        method: 'POST',
        body: JSON.stringify(items),
      })
    },
  },

  assistants: {
    run: async (payload: AssistantRunRequest) => {
      return apiRequest<AssistantRunResponse>(`${API_BASE}/ai/assistants/run`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    },
    previewContext: async (payload: ContextPreviewRequest) => {
      return apiRequest<ContextPreviewResponse>(`${API_BASE}/ai/assistants/preview-context`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    },
  },

  wordpress: {
    export: async (projectId: number) => {
      return apiRequest<WpExportBundle>(`${API_BASE}/wordpress/export?project_id=${projectId}`)
    },
    getCsvDownloadUrl: (projectId: number) => {
      return `${API_BASE}/wordpress/export/csv?project_id=${projectId}`
    },
    getZipDownloadUrl: (projectId: number) => {
      return `${API_BASE}/wordpress/export/zip?project_id=${projectId}`
    },
    push: async (payload: WpPushRequest) => {
      return apiRequest<WpPushResponse>(`${API_BASE}/wordpress/push`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    },
    testConnection: async (payload: WpTestConnectionRequest) => {
      return apiRequest<WpTestConnectionResponse>(`${API_BASE}/wordpress/test-connection`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    },
  },

  products: {
    list: async (projectId: number | 'all') => {
      return apiRequest<Product[]>(`${API_BASE}/products${projectQuery(projectId)}`)
    },
    create: async (data: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => {
      return apiRequest<Product>(`${API_BASE}/products`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },
    update: async (id: number, data: Partial<Product>) => {
      return apiRequest<Product>(`${API_BASE}/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      })
    },
    remove: async (id: number) => {
      await apiRequest<void>(`${API_BASE}/products/${id}`, { method: 'DELETE' })
    },
  },

  research: {
    caps: async () => apiRequest<ResearchCaps>(`${API_BASE}/research/caps`),
    budget: async () => apiRequest<ResearchBudget>(`${API_BASE}/research/budget`),
    list: async (projectId: number | 'all') => {
      return apiRequest<ResearchJob[]>(`${API_BASE}/research/jobs${projectQuery(projectId)}`)
    },
    get: async (jobId: number) => {
      return apiRequest<ResearchJobDetail>(`${API_BASE}/research/jobs/${jobId}`)
    },
    start: async (payload: ResearchJobCreate) => {
      return apiRequest<ResearchJobDetail>(`${API_BASE}/research/jobs`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    },
  },
}

export const SYNC_JOB_LABELS: Record<SyncJobType, string> = {
  gsc: 'Google Search Console',
  ga4: 'Google Analytics 4',
  ads: 'Google Ads Keyword Planner',
}
