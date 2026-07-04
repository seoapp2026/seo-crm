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

export type AssistantSlug =
  | 'seo_architect'
  | 'keyword_classifier'
  | 'content_generator'
  | 'competitor_analyst'
  | 'continuous_optimizer'

export interface AiPrompt {
  id: number
  slug: AssistantSlug
  name: string
  description: string
  system_prompt: string
  model_default: string
  updated_at: string
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
  meta_title: string
  meta_description: string
  content_type: string
  h1: string
  status: string
  niche_name: string
}

export interface WpExportBundle {
  project_name: string
  exported_at: string
  pages: WpExportItem[]
}

export interface AssistantRunRequest {
  assistant: AssistantSlug
  project_id: number
  page_id?: number
  niche_id?: number
  competitor_id?: number
  extra_context?: string
  model?: string
}

export interface AssistantRunResponse {
  assistant: AssistantSlug
  rendered: string
  model_used: string
  used_metrics: boolean
}

export interface DateRange {
  from: string
  to: string
}