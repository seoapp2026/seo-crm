import {
  MOCK_ADS_KEYWORDS,
  MOCK_AI_PROMPTS,
  MOCK_ANALYTICS_ROWS,
  MOCK_COMPETITORS,
  MOCK_GOOGLE_AUTH,
  MOCK_GSC_ROWS,
  MOCK_SYNC_JOBS,
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

function projectQuery(projectId: number | 'all') {
  return projectId === 'all' ? '' : `?project_id=${projectId}`
}

export const phase2Api = {
  integrations: {
    list: async (projectId: number | 'all') => {
      const data = await tryBackend<GoogleAuth[]>(`/api/integrations/google${projectQuery(projectId)}`)
      if (data) return data
      await delay()
      return projectFilter(MOCK_GOOGLE_AUTH, projectId)
    },
    connect: async (projectId: number, service: GoogleService) => {
      const data = await tryBackend<GoogleAuth>(`/api/integrations/google/connect`, {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, service }),
      })
      if (data) return data
      await delay(400)
      const existing = MOCK_GOOGLE_AUTH.find((a) => a.project_id === projectId && a.service === service)
      if (existing) {
        existing.connected = true
        existing.account_email = 'cliente@gmail.com'
        existing.last_sync_at = new Date().toISOString()
      }
      return existing!
    },
    disconnect: async (id: number) => {
      const ok = await tryBackend<void>(`/api/integrations/google/${id}`, { method: 'DELETE' })
      if (ok !== null) return
      await delay()
      const row = MOCK_GOOGLE_AUTH.find((a) => a.id === id)
      if (row) {
        row.connected = false
        row.account_email = null
        row.property_id = null
        row.property_label = null
      }
    },
  },

  sync: {
    list: async (projectId: number | 'all') => {
      const data = await tryBackend<SyncJob[]>(`/api/sync/jobs${projectQuery(projectId)}`)
      if (data) return data
      await delay()
      return projectFilter(MOCK_SYNC_JOBS, projectId)
    },
    runNow: async (jobId: number) => {
      const data = await tryBackend<SyncJob>(`/api/sync/jobs/${jobId}/run`, { method: 'POST' })
      if (data) return data
      await delay(800)
      const job = MOCK_SYNC_JOBS.find((j) => j.id === jobId)
      if (!job) throw new Error('Trabajo no encontrado')
      if (!job.enabled) throw new Error(job.last_error || 'Trabajo deshabilitado')
      job.status = 'running'
      await delay(600)
      job.status = 'success'
      job.last_run_at = new Date().toISOString()
      job.records_synced += Math.floor(Math.random() * 50) + 10
      return job
    },
    toggle: async (jobId: number, enabled: boolean) => {
      const data = await tryBackend<SyncJob>(`/api/sync/jobs/${jobId}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      })
      if (data) return data
      await delay()
      const job = MOCK_SYNC_JOBS.find((j) => j.id === jobId)!
      job.enabled = enabled
      return job
    },
  },

  performance: {
    summary: async (projectId: number | 'all') => {
      const data = await tryBackend<PerformanceSummary>(
        `/api/performance/summary${projectQuery(projectId)}`,
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
      const data = await tryBackend<GscDataRow[]>(`/api/gsc/data${q}`)
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
      const data = await tryBackend<AnalyticsDataRow[]>(`/api/analytics/data${q}`)
      if (data) return data
      await delay()
      return projectFilter(MOCK_ANALYTICS_ROWS, projectId).filter((r) => inDateRange(r.date, range))
    },
  },

  adsKeywords: {
    list: async (projectId: number | 'all') => {
      const data = await tryBackend<AdsKeyword[]>(`/api/ads/keywords${projectQuery(projectId)}`)
      if (data) return data
      await delay()
      return projectFilter(MOCK_ADS_KEYWORDS, projectId)
    },
  },

  competitors: {
    list: async (projectId: number | 'all') => {
      const data = await tryBackend<Competitor[]>(`/api/competitors${projectQuery(projectId)}`)
      if (data) return data
      await delay()
      return projectFilter(MOCK_COMPETITORS, projectId)
    },
    create: async (data: Omit<Competitor, 'id' | 'created_at' | 'pages_tracked'>) => {
      const res = await tryBackend<Competitor>('/api/competitors', {
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
      const res = await tryBackend<Competitor>(`/api/competitors/${id}`, {
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
      const res = await tryBackend<void>(`/api/competitors/${id}`, { method: 'DELETE' })
      if (res !== null) return
      await delay()
      const idx = MOCK_COMPETITORS.findIndex((c) => c.id === id)
      if (idx >= 0) MOCK_COMPETITORS.splice(idx, 1)
    },
  },

  prompts: {
    list: async () => {
      const data = await tryBackend<AiPrompt[]>('/api/ai/prompts')
      if (data) return data
      await delay()
      return [...MOCK_AI_PROMPTS]
    },
    update: async (id: number, payload: Partial<Pick<AiPrompt, 'system_prompt' | 'model_default' | 'description'>>) => {
      const data = await tryBackend<AiPrompt>(`/api/ai/prompts/${id}`, {
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
      const data = await tryBackend<AssistantRunResponse>('/api/ai/assistants/run', {
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
      const data = await tryBackend<WpExportBundle>(`/api/wordpress/export?project_id=${projectId}`)
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