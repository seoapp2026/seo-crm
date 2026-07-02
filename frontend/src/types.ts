export type NicheState = 'nuevo' | 'prueba' | 'señales' | 'escalando' | 'dormido'
export type Monetization = 'afiliacion' | 'adsense' | 'mixto' | 'leads'
export type PageType = 'TSG' | 'TSR' | 'TSA'
export type PageState = 'borrador' | 'en_revision' | 'publicado' | 'optimizado'
export type Intent = 'informacional' | 'comercial' | 'transaccional'
export type IndexedStatus = 'indexada' | 'pendiente' | 'noindex'

export interface Project {
  id: number
  name: string
  description: string | null
  created_at: string
}

export interface Niche {
  id: number
  project_id: number
  name: string
  topic: string | null
  state: NicheState
  monetization: Monetization
  notes: string | null
  created_at: string
}

export interface Page {
  id: number
  niche_id: number
  project_id: number
  title: string
  type: PageType
  state: PageState
  objective: string | null
  created_at: string
}

export interface Keyword {
  id: number
  page_id: number
  niche_id: number
  project_id: number
  term: string
  intent: Intent
  note: string | null
  created_at: string
  cannibalized: boolean
}

export interface Url {
  id: number
  page_id: number
  niche_id: number
  project_id: number
  slug: string
  indexed: IndexedStatus
  status: string | null
  created_at: string
}

export interface InternalLink {
  id: number
  project_id: number
  from_page_id: number
  to_page_id: number
  anchor: string | null
  created_at: string
}

export interface Note {
  id: number
  project_id: number
  title: string
  body: string | null
  created_at: string
}

export interface DashboardStats {
  projects: number
  niches: number
  pages: number
  keywords: number
  urls: number
  published_pages: number
  draft_pages: number
  scaling_niches: number
  niche_by_state: { state: string; count: number }[]
  recent_pages: Page[]
  orphan_pages: Page[]
  cannibalized_terms: string[]
}

export interface GenerateContentResponse {
  draft: {
    id: number
    page_id: number
    draft_body: string | null
    meta_title: string | null
    meta_description: string | null
    model_used: string | null
    status: string
    created_at: string
  }
  rendered: string
}