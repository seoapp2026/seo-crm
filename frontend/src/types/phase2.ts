export type GoogleService = 'gsc' | 'ga4' | 'ads'

export interface GoogleAuth {
  id: number
  project_id: number
  service: GoogleService
  account_email: string | null
  property_id: string | null
  property_label: string | null
  connected: boolean
  last_sync_at: string | null
  token_expires_at: string | null
}

export interface GscSite {
  site_url: string
  permission_level: string
}

export interface GscDataRow {
  id: number
  project_id: number
  url_id: number | null
  page_url: string
  date: string
  impressions: number
  clicks: number
  ctr: number
  position: number
}

export interface AnalyticsDataRow {
  id: number
  project_id: number
  page_path: string
  date: string
  sessions: number
  users: number
  bounce_rate: number
  avg_engagement_time: number
}

export type AdsCompetition = 'LOW' | 'MEDIUM' | 'HIGH'

export interface AdsKeyword {
  id: number
  project_id: number
  term: string
  volume: number
  competition: AdsCompetition
  cpc_low: number
  cpc_high: number
  synced_at: string
}

export interface Competitor {
  id: number
  project_id: number
  domain: string
  niche_id: number | null
  notes: string | null
  pages_tracked: number
  created_at: string
}

export type AssistantSlug = string

export interface AiPrompt {
  id: number
  slug: string
  name: string
  description: string
  system_prompt: string
  model_default: string
  sort_order: number
  is_system: boolean
  project_id: number | null
  updated_at: string
}

export interface AiPromptCreate {
  slug: string
  name: string
  description?: string
  system_prompt: string
  model_default?: string
  sort_order?: number
  is_system?: boolean
  project_id?: number | null
}

export interface AiPromptReorderItem {
  id: number
  sort_order: number
}

export type SyncJobStatus = 'idle' | 'running' | 'success' | 'error'
export type SyncJobType = 'gsc' | 'ga4' | 'ads'

export interface SyncJob {
  id: number
  project_id: number
  job_type: SyncJobType
  schedule: string
  schedule_cron: string
  status: SyncJobStatus
  last_run_at: string | null
  next_run_at: string | null
  last_error: string | null
  records_synced: number
  enabled: boolean
}

export type PerformanceTrend = 'up' | 'down' | 'stable'
export type PerformanceStatus = 'winning' | 'declining' | 'needs_work' | 'stable'

export interface PagePerformance {
  page_id: number
  page_title: string
  page_url: string
  impressions_28d: number
  clicks_28d: number
  ctr_28d: number
  position_28d: number
  sessions_28d: number
  bounce_rate_28d: number
  trend: PerformanceTrend
  trend_pct: number
  status: PerformanceStatus
  sparkline_clicks: number[]
}

export interface PerformanceSummary {
  winning: number
  declining: number
  needs_work: number
  stable: number
  total_clicks_28d: number
  total_impressions_28d: number
  total_sessions_28d: number
  avg_position_28d: number
  pages: PagePerformance[]
}

export interface WpExportItem {
  page_id: number
  title: string
  slug: string
  h1?: string | null
  meta_title?: string | null
  meta_description?: string | null
  focus_keyword?: string | null
  secondary_keywords?: string[]
  content_html?: string | null
  content_type: string
  status: string
  content_status?: string
  export_ready?: boolean
  niche_name: string
  wp_category?: string | null
  wp_tags?: string[]
  parent_slug?: string | null
  parent_title?: string | null
  schema_json?: string | null
}

export interface WpExportBundle {
  project_name: string
  exported_at: string
  pages: WpExportItem[]
}

export interface WpPushRequest {
  project_id: number
  page_ids?: number[] | null
  post_type?: 'pages' | 'posts'
  post_status?: 'draft' | 'publish'
  wp_url?: string | null
  wp_username?: string | null
  wp_app_password?: string | null
}

export interface WpPushResultItem {
  page_id: number
  title: string
  wp_post_id?: number | null
  wp_url?: string | null
  status: 'success' | 'error' | 'skipped'
  message?: string | null
}

export interface WpPushResponse {
  total_pushed: number
  success_count: number
  error_count: number
  items: WpPushResultItem[]
}

export interface WpTestConnectionRequest {
  project_id?: number | null
  wp_url?: string | null
  wp_username?: string | null
  wp_app_password?: string | null
}

export interface WpTestConnectionResponse {
  success: boolean
  site_name?: string | null
  site_url?: string | null
  message: string
}

export interface AssistantRunRequest {
  assistant?: string
  prompt_id?: number
  prompt_slug?: string
  project_id: number
  page_id?: number
  niche_id?: number
  competitor_id?: number
  extra_context?: string
  model?: string
}

export interface AssistantRunResponse {
  assistant: string
  prompt_id?: number | null
  prompt_name?: string | null
  rendered: string
  model_used: string
  used_metrics: boolean
  context_used?: Record<string, any> | null
}

export interface ContextPreviewRequest {
  prompt_id?: number | null
  prompt_slug?: string | null
  assistant?: string | null
  project_id: number
  page_id?: number | null
  niche_id?: number | null
  competitor_id?: number | null
  extra_context?: string | null
  model?: string | null
}

export interface ContextPreviewResponse {
  prompt_id?: number | null
  prompt_name: string
  prompt_slug: string
  model: string
  system_prompt: string
  user_prompt: string
  full_prompt_text: string
  word_count: number
  estimated_tokens: number
  resolved_entities: Record<string, any>
}

export interface DateRange {
  from: string
  to: string
}

export type ResearchJobStatus = 'queued' | 'running' | 'done' | 'error'
export type PageTypeCode = 'TSG' | 'TSR' | 'TSA'

export interface Product {
  id: number
  project_id: number
  name: string
  brand: string | null
  sku: string | null
  features: string | null
  price: number | null
  currency: string
  stock_notes: string | null
  opinions: string | null
  source_url: string | null
  provider?: string
  external_id?: string | null
  image_url?: string | null
  affiliate_url?: string | null
  rating?: string | null
  created_at: string
  updated_at: string
}

export interface ResearchCaps {
  max_competitors: number
  max_seed_keywords: number
  max_keywords_stored: number
  max_serp_queries: number
  max_serp_results_per_query: number
  max_page_snapshots: number
  max_backlinks_per_domain: number
  max_referring_domains: number
  max_link_gaps: number
  soft_monthly_eur: number
  hard_monthly_eur: number
  credentials_configured: boolean
  force_stub: boolean
}

export interface ResearchBudget {
  year_month: string
  runs_count: number
  spend_eur: number
  soft_monthly_eur: number
  hard_monthly_eur: number
  soft_warning: boolean
  hard_blocked: boolean
}

export interface ResearchJob {
  id: number
  project_id: number
  site_url: string | null
  competitor_urls: string[]
  seed_keywords: string[]
  country: string
  language: string
  page_type: PageTypeCode
  status: ResearchJobStatus
  error_message: string | null
  estimated_cost_eur: number
  actual_cost_eur: number
  ai_report: string | null
  used_stub: boolean
  started_at: string | null
  finished_at: string | null
  created_at: string
}

export interface ResearchKeywordRow {
  id: number
  term: string
  volume: number
  intent: string | null
  cpc: number
  competition: string | null
  source: string
}

export interface ResearchSerpRow {
  id: number
  query: string
  position: number
  url: string
  title: string | null
  domain: string | null
}

export interface ResearchPageSnapshot {
  id: number
  url: string
  title: string | null
  meta_description: string | null
  h1_json: string
  h2_json: string
  h3_json: string
  links_json: string
}

export interface ResearchBacklinkSummary {
  id: number
  domain: string
  is_target: boolean
  backlinks_count: number
  referring_domains: number
  sample_json: string
}

export interface ResearchLinkGap {
  id: number
  domain: string
  linked_to_competitor: string
  note: string | null
}

export interface ResearchOpportunity {
  id: number
  kind: string
  title: string
  detail: string | null
  priority: number
}

export interface ResearchJobDetail extends ResearchJob {
  keywords: ResearchKeywordRow[]
  serp_rows: ResearchSerpRow[]
  page_snapshots: ResearchPageSnapshot[]
  backlink_summaries: ResearchBacklinkSummary[]
  link_gaps: ResearchLinkGap[]
  opportunities: ResearchOpportunity[]
}

export interface ResearchJobCreate {
  project_id: number
  site_url?: string | null
  competitor_urls: string[]
  seed_keywords: string[]
  country: string
  language: string
  page_type: PageTypeCode
}

// --- W7 Interfaces ---

export interface ProductItem {
  name: string
  brand?: string | null
  model?: string | null
  badge?: string | null
  price?: string | null
  rating?: string | null
  image_url?: string | null
  pros: string[]
  cons: string[]
  specs: Record<string, string>
  cta_text: string
  affiliate_url?: string | null
}

export interface ComparisonTableGenerateRequest {
  products: ProductItem[]
  table_title?: string | null
  show_badges?: boolean
  show_pros_cons?: boolean
  show_ratings?: boolean
  target_page_id?: number | null
}

export interface ComparisonTableGenerateResponse {
  html_table: string
  preview_cards_html: string
  spec_columns: string[]
  products_count: number
}

export interface CompetitorHeadingItem {
  level: number
  tag: string
  text: string
}

export interface CompetitorScrapeRequest {
  url?: string | null
  raw_html?: string | null
  project_id: number
  niche_id?: number | null
}

export interface CompetitorScrapeResponse {
  title: string
  meta_description?: string | null
  h1?: string | null
  headings: CompetitorHeadingItem[]
  word_count: number
  detected_products: ProductItem[]
  detected_keywords: string[]
  has_comparison_table: boolean
  extracted_summary: string
}

// --- W8 Rank Math Interfaces ---

export interface RankMathImportResponse {
  total_rows: number
  updated_count: number
  skipped_count: number
  error_count: number
  messages: string[]
}

export interface RankMathBulkSyncResponse {
  analyzed_count: number
  updated_titles_count: number
  updated_descriptions_count: number
}

// --- Official Product Providers (Amazon & eBay) & Structure Importer ---

export interface ProviderStatusItem {
  provider: string
  name: string
  configured: boolean
  marketplace: string
  using_stub: boolean
  partner_tag?: string | null
  campaign_id?: string | null
}

export interface ProductProviderStatus {
  providers: ProviderStatusItem[]
}

export interface ProductSearchItem {
  provider: string
  external_id: string
  name: string
  brand?: string | null
  price?: number | null
  currency: string
  image_url?: string | null
  rating?: string | null
  affiliate_url?: string | null
  features?: string | null
  availability?: string | null
  is_prime?: boolean
  condition?: string | null
}

export interface ProductSearchRequest {
  provider?: 'all' | 'amazon' | 'ebay'
  query: string
  limit?: number
  project_id?: number | null
}

export interface ProductSearchResponse {
  query: string
  provider_used: string
  total_found: number
  is_stub: boolean
  results: ProductSearchItem[]
}

export interface ProductImportRequest {
  project_id: number
  provider: string
  external_id?: string | null
  name: string
  brand?: string | null
  price?: number | null
  currency?: string
  image_url?: string | null
  rating?: string | null
  affiliate_url?: string | null
  features?: string | null
  opinions?: string | null
  stock_notes?: string | null
}

export interface ProductImportResponse {
  imported: boolean
  message: string
  product: Product
}

export interface StructureImportItem {
  title: string
  slug: string
  niche_name: string
  parent_slug?: string | null
  page_type?: 'TSG' | 'TSR' | 'TSA'
  h1?: string | null
  seo_title?: string | null
  seo_description?: string | null
  focus_keyword?: string | null
}

export interface StructureImportRequest {
  project_id?: number | null
  project_name?: string | null
  csv_content?: string | null
  items?: StructureImportItem[] | null
}

export interface StructureImportResponse {
  project_id: number
  project_name: string
  niches_created: number
  pages_created: number
  urls_created: number
  silos_linked: number
  keywords_linked: number
  errors: string[]
}