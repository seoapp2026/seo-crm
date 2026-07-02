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
  health: () => request<{ status: string }>('/api/health'),
  dashboard: (projectId: number | 'all') =>
    request<DashboardStats>(`/api/dashboard/stats${projectQuery(projectId)}`),

  projects: {
    list: () => request<Project[]>('/api/projects'),
    create: (data: { name: string; description?: string }) =>
      request<Project>('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<{ name: string; description: string }>) =>
      request<Project>(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/api/projects/${id}`, { method: 'DELETE' }),
  },

  niches: {
    list: (projectId: number | 'all') =>
      request<Niche[]>(`/api/niches${projectQuery(projectId)}`),
    create: (data: Omit<Niche, 'id' | 'created_at'>) =>
      request<Niche>('/api/niches', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Niche>) =>
      request<Niche>(`/api/niches/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/api/niches/${id}`, { method: 'DELETE' }),
  },

  pages: {
    list: (projectId: number | 'all') =>
      request<Page[]>(`/api/pages${projectQuery(projectId)}`),
    create: (data: Omit<Page, 'id' | 'created_at'>) =>
      request<Page>('/api/pages', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Page>) =>
      request<Page>(`/api/pages/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/api/pages/${id}`, { method: 'DELETE' }),
  },

  keywords: {
    list: (projectId: number | 'all') =>
      request<Keyword[]>(`/api/keywords${projectQuery(projectId)}`),
    create: (data: Omit<Keyword, 'id' | 'created_at' | 'cannibalized'>) =>
      request<Keyword>('/api/keywords', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Keyword>) =>
      request<Keyword>(`/api/keywords/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/api/keywords/${id}`, { method: 'DELETE' }),
  },

  urls: {
    list: (projectId: number | 'all') =>
      request<Url[]>(`/api/urls${projectQuery(projectId)}`),
    create: (data: Omit<Url, 'id' | 'created_at'>) =>
      request<Url>('/api/urls', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Url>) =>
      request<Url>(`/api/urls/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/api/urls/${id}`, { method: 'DELETE' }),
  },

  links: {
    list: (projectId: number | 'all') =>
      request<InternalLink[]>(`/api/links${projectQuery(projectId)}`),
    create: (data: Omit<InternalLink, 'id' | 'created_at'>) =>
      request<InternalLink>('/api/links', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<InternalLink>) =>
      request<InternalLink>(`/api/links/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/api/links/${id}`, { method: 'DELETE' }),
  },

  notes: {
    list: (projectId: number | 'all') =>
      request<Note[]>(`/api/notes${projectQuery(projectId)}`),
    create: (data: Omit<Note, 'id' | 'created_at'>) =>
      request<Note>('/api/notes', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Note>) =>
      request<Note>(`/api/notes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/api/notes/${id}`, { method: 'DELETE' }),
  },

  ai: {
    generate: (pageId: number, model: string) =>
      request<GenerateContentResponse>('/api/ai/generate', {
        method: 'POST',
        body: JSON.stringify({ page_id: pageId, model }),
      }),
  },
}