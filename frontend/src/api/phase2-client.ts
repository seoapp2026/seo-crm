import { API_BASE } from './base'
import {
  MOCK_ADS_KEYWORDS,
  MOCK_AI_PROMPTS,
  MOCK_ANALYTICS_ROWS,
  MOCK_COMPETITORS,
  MOCK_GSC_ROWS,
  MOCK_WP_EXPORT,
  buildPerformanceSummary,
  mockAssistantRun,
} from '../data/phase2-mock'
import type {
  AdsKeyword,
  AiPrompt,
  AnalyticsDataRow,
  AssistantRunRequest,
  AssistantRunResponse,
  Competitor,
  DateRange,
  GoogleAuth,
  GoogleService,
  GscDataRow,
  PerformanceSummary,
  SyncJob,
  SyncJobType,
  WpExportBundle,
} from '../types/phase2'

const delay = (ms = 180) => new Promise((r) => setTimeout(r, ms))

function projectFilter<T extends { project_id: number }>(items: T[], projectId: number | 'all') {
  return projectId === 'all' ? items : items.filter((i) => i.project_id === projectId)
}

function inDateRange(date: string, range?: DateRange) {
  if (!range) return true
  return date >= range.from && date <= range.to
}

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

async function tryBackend<T>(path: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      ...options,
    })
    if (!res.ok) return null
    if (res.status === 204) return undefined as T
    return res.json()
  } catch {
    return null
  }
}

async function tryBackendOrThrow<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
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
      return tryBackendOrThrow<GoogleAuth[]>(`${API_BASE}/integrations/google${projectQuery(projectId)}`)
    },
    connect: async (projectId: number, service: GoogleService): Promise<{ auth_url: string }> => {
      const data = await tryBackendOrThrow<{ auth_url: string }>(
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
      await tryBackendOrThrow<void>(`${API_BASE}/integrations/google/${id}`, { method: 'DELETE' })
    },
  },

  sync: {
    list: async (projectId: number | 'all') => {
      return tryBackendOrThrow<SyncJob[]>(`${API_BASE}/sync/jobs${projectQuery(projectId)}`)
    },
    runNow: async (jobId: number) => {
      return tryBackendOrThrow<SyncJob>(`${API_BASE}/sync/jobs/${jobId}/run`, { method: 'POST' })
    },
    toggle: async (jobId: number, enabled: boolean) => {
      return tryBackendOrThrow<SyncJob>(`${API_BASE}/sync/jobs/${jobId}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      })
    },
  },

  performance: {
    summary: async (projectId: number | 'all') => {
      const data = await tryBackend<PerformanceSummary>(
        `${API_BASE}/performance/summary${projectQuery(projectId)}`,
      )
      if (data) return data
      await delay()
      return buildPerformanceSummary(projectId)
    },
  },

  gsc: {
    list: async (projectId: number | 'all', range?: DateRange) => {
      const qs = new URLSearchParams()
      if (projectId !== 'all') qs.set('project_id', String(projectId))
      if (range?.from) qs.set('from', range.from)
      if (range?.to) qs.set('to', range.to)
      const q = qs.toString() ? `?${qs}` : ''
      const data = await tryBackend<GscDataRow[]>(`${API_BASE}/gsc/data${q}`)
      if (data) return data
      await delay()
      return projectFilter(MOCK_GSC_ROWS, projectId).filter((r) => inDateRange(r.date, range))
    },
  },

  analytics: {
    list: async (projectId: number | 'all', range?: DateRange) => {
      const qs = new URLSearchParams()
      if (projectId !== 'all') qs.set('project_id', String(projectId))
      if (range?.from) qs.set('from', range.from)
      if (range?.to) qs.set('to', range.to)
      const q = qs.toString() ? `?${qs}` : ''
      const data = await tryBackend<AnalyticsDataRow[]>(`${API_BASE}/analytics/data${q}`)
      if (data) return data
      await delay()
      return projectFilter(MOCK_ANALYTICS_ROWS, projectId).filter((r) => inDateRange(r.date, range))
    },
  },

  adsKeywords: {
    list: async (projectId: number | 'all') => {
      const data = await tryBackend<AdsKeyword[]>(`${API_BASE}/ads/keywords${projectQuery(projectId)}`)
      if (data) return data
      await delay()
      return projectFilter(MOCK_ADS_KEYWORDS, projectId)
    },
  },

  competitors: {
    list: async (projectId: number | 'all') => {
      const data = await tryBackend<Competitor[]>(`${API_BASE}/competitors${projectQuery(projectId)}`)
      if (data) return data
      await delay()
      return projectFilter(MOCK_COMPETITORS, projectId)
    },
    create: async (data: Omit<Competitor, 'id' | 'created_at' | 'pages_tracked'>) => {
      const res = await tryBackend<Competitor>('${API_BASE}/competitors', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      if (res) return res
      await delay()
      const row: Competitor = {
        ...data,
        id: MOCK_COMPETITORS.length + 1,
        pages_tracked: 0,
        created_at: new Date().toISOString(),
      }
      MOCK_COMPETITORS.push(row)
      return row
    },
    update: async (id: number, data: Partial<Competitor>) => {
      const res = await tryBackend<Competitor>(`${API_BASE}/competitors/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      })
      if (res) return res
      await delay()
      const row = MOCK_COMPETITORS.find((c) => c.id === id)!
      Object.assign(row, data)
      return row
    },
    remove: async (id: number) => {
      const res = await tryBackend<void>(`${API_BASE}/competitors/${id}`, { method: 'DELETE' })
      if (res !== null) return
      await delay()
      const idx = MOCK_COMPETITORS.findIndex((c) => c.id === id)
      if (idx >= 0) MOCK_COMPETITORS.splice(idx, 1)
    },
  },

  prompts: {
    list: async () => {
      const data = await tryBackend<AiPrompt[]>('${API_BASE}/ai/prompts')
      if (data) return data
      await delay()
      return [...MOCK_AI_PROMPTS]
    },
    update: async (id: number, payload: Partial<Pick<AiPrompt, 'system_prompt' | 'model_default' | 'description'>>) => {
      const data = await tryBackend<AiPrompt>(`${API_BASE}/ai/prompts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      if (data) return data
      await delay()
      const row = MOCK_AI_PROMPTS.find((p) => p.id === id)!
      Object.assign(row, payload, { updated_at: new Date().toISOString() })
      return row
    },
  },

  assistants: {
    run: async (payload: AssistantRunRequest) => {
      const data = await tryBackend<AssistantRunResponse>('${API_BASE}/ai/assistants/run', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (data) return data
      await delay(1200)
      return mockAssistantRun(payload.assistant, payload.model || 'gpt-4o-mini')
    },
  },

  wordpress: {
    export: async (projectId: number) => {
      const data = await tryBackend<WpExportBundle>(`${API_BASE}/wordpress/export?project_id=${projectId}`)
      if (data) return data
      await delay(500)
      return { ...MOCK_WP_EXPORT, project_name: projectId === 1 ? 'Afiliación Hogar' : 'Proyecto' }
    },
  },
}

export const SYNC_JOB_LABELS: Record<SyncJobType, string> = {
  gsc: 'Google Search Console',
  ga4: 'Google Analytics 4',
  ads: 'Google Ads Keyword Planner',
}