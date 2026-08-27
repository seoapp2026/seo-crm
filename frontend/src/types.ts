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
  gsc_site_url: string | null
  ga4_property_id: string | null
  wp_url?: string | null
  wp_username?: string | null
  wp_app_password?: string | null
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
  layout_template_text?: string | null
  created_at: string
}

export interface Page {
  id: number
  niche_id: number
  project_id: number
  parent_page_id?: number | null
  parent_title?: string | null
  title: string
  type: PageType
  state: PageState
  objective: string | null
  breadcrumb_label?: string | null
  h1?: string | null
  outline_json?: string | null
  seo_title?: string | null
  seo_description?: string | null
  wp_category?: string | null
  wp_tags_json?: string | null
  content_html?: string | null
  content_status?: string
  schema_json?: string | null
  export_ready?: boolean
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
  is_primary: boolean
  created_at: string
  cannibalized: boolean
  cannibalized_on?: string[]
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

export interface ContentDraft {
  id: number
  page_id: number
  draft_body: string | null
  meta_title: string | null
  meta_description: string | null
  content_html: string | null
  draft_kind: string
  source_prompt_id?: number | null
  context_used_json?: string | null
  model_used: string | null
  status: 'borrador' | 'en_revision' | 'aprobado' | 'publicado'
  created_at: string
}

export interface GenerateContentResponse {
  draft: ContentDraft
  rendered: string
}

export interface MaquetarResponse {
  draft: ContentDraft
  content_html: string
  page_updated: boolean
}

export interface AutoTagIntentResponse {
  updated_count: number
  informational_count: number
  commercial_count: number
  transactional_count: number
}

export interface ClusterItem {
  cluster_id: string
  cluster_name: string
  focus_keyword: string
  secondary_keywords: string[]
  suggested_title: string
  suggested_h1: string
  suggested_type: PageType
  intent: Intent
  keyword_ids: number[]
  existing_page_id?: number | null
  existing_page_title?: string | null
}

export interface ClusterSuggestionResponse {
  total_keywords_analyzed: number
  clusters_count: number
  clusters: ClusterItem[]
}

export interface ClusterApplyItem {
  cluster_name: string
  focus_keyword_id?: number | null
  keyword_ids: number[]
  existing_page_id?: number | null
  title: string
  h1?: string | null
  type: PageType
  parent_page_id?: number | null
  niche_id: number
}

export interface ClusterApplyResponse {
  created_pages_count: number
  updated_pages_count: number
  linked_keywords_count: number
  created_page_ids: number[]
}