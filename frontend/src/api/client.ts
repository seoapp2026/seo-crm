import type {
  DashboardStats,
  GenerateContentResponse,
  InternalLink,
  Keyword,
  Niche,
  Note,
  Page,
  Project,
  Url,
} from '../types'
import { API_BASE } from './base'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

function projectQuery(projectId: number | 'all') {
  return projectId === 'all' ? '' : `?project_id=${projectId}`
}

export const api = {
  health: () => request<{ status: string }>(`${API_BASE}/health`),
  dashboard: (projectId: number | 'all') =>
    request<DashboardStats>(`${API_BASE}/dashboard/stats${projectQuery(projectId)}`),

  projects: {
    list: () => request<Project[]>(`${API_BASE}/projects`),
    create: (data: { name: string; description?: string }) =>
      request<Project>(`${API_BASE}/projects`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<{ name: string; description: string }>) =>
      request<Project>(`${API_BASE}/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`${API_BASE}/projects/${id}`, { method: 'DELETE' }),
  },

  niches: {
    list: (projectId: number | 'all') =>
      request<Niche[]>(`${API_BASE}/niches${projectQuery(projectId)}`),
    create: (data: Omit<Niche, 'id' | 'created_at'>) =>
      request<Niche>(`${API_BASE}/niches`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Niche>) =>
      request<Niche>(`${API_BASE}/niches/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`${API_BASE}/niches/${id}`, { method: 'DELETE' }),
  },

  pages: {
    list: (projectId: number | 'all') =>
      request<Page[]>(`${API_BASE}/pages${projectQuery(projectId)}`),
    create: (data: Omit<Page, 'id' | 'created_at'>) =>
      request<Page>(`${API_BASE}/pages`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Page>) =>
      request<Page>(`${API_BASE}/pages/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`${API_BASE}/pages/${id}`, { method: 'DELETE' }),
  },

  keywords: {
    list: (projectId: number | 'all') =>
      request<Keyword[]>(`${API_BASE}/keywords${projectQuery(projectId)}`),
    create: (data: Omit<Keyword, 'id' | 'created_at' | 'cannibalized'>) =>
      request<Keyword>(`${API_BASE}/keywords`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Keyword>) =>
      request<Keyword>(`${API_BASE}/keywords/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`${API_BASE}/keywords/${id}`, { method: 'DELETE' }),
  },

  urls: {
    list: (projectId: number | 'all') =>
      request<Url[]>(`${API_BASE}/urls${projectQuery(projectId)}`),
    create: (data: Omit<Url, 'id' | 'created_at'>) =>
      request<Url>(`${API_BASE}/urls`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Url>) =>
      request<Url>(`${API_BASE}/urls/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`${API_BASE}/urls/${id}`, { method: 'DELETE' }),
  },

  links: {
    list: (projectId: number | 'all') =>
      request<InternalLink[]>(`${API_BASE}/links${projectQuery(projectId)}`),
    create: (data: Omit<InternalLink, 'id' | 'created_at'>) =>
      request<InternalLink>(`${API_BASE}/links`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<InternalLink>) =>
      request<InternalLink>(`${API_BASE}/links/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`${API_BASE}/links/${id}`, { method: 'DELETE' }),
  },

  notes: {
    list: (projectId: number | 'all') =>
      request<Note[]>(`${API_BASE}/notes${projectQuery(projectId)}`),
    create: (data: Omit<Note, 'id' | 'created_at'>) =>
      request<Note>(`${API_BASE}/notes`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Note>) =>
      request<Note>(`${API_BASE}/notes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`${API_BASE}/notes/${id}`, { method: 'DELETE' }),
  },

  ai: {
    generate: (pageId: number, model: string) =>
      request<GenerateContentResponse>(`${API_BASE}/ai/generate`, {
        method: 'POST',
        body: JSON.stringify({ page_id: pageId, model }),
      }),
  },
}