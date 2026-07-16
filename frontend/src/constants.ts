export const APP = {
  name: 'SEO CRM',
  tagline: 'Nichos, datos e IA supervisada',
  description:
    'SEO operations platform for teams: projects, niches, pages, keywords, Search Console, Analytics, and supervised AI.',
  themeColor: '#1f2723',
  locale: 'es',
} as const

export const NICHE_STATES: Record<string, { label: string; cls: string }> = {
  nuevo: { label: 'Nuevo', cls: 'b-gray' },
  prueba: { label: 'En prueba', cls: 'b-blue' },
  'señales': { label: 'Con señales', cls: 'b-amber' },
  escalando: { label: 'Escalando', cls: 'b-green' },
  dormido: { label: 'Dormido', cls: 'b-gray' },
}

export const MONETIZATION: Record<string, string> = {
  afiliacion: 'Afiliación',
  adsense: 'AdSense',
  mixto: 'Mixto',
  leads: 'Leads',
}

export const PAGE_TYPES: Record<string, { label: string; desc: string }> = {
  TSG: { label: 'Guía (TSG)', desc: 'Contenido informacional / guía pilar' },
  TSR: { label: 'Comparativa (TSR)', desc: 'Comparativa / contenido comercial' },
  TSA: { label: 'Reseña (TSA)', desc: 'Reseña de producto individual' },
}

export const PAGE_STATES: Record<string, { label: string; cls: string }> = {
  borrador: { label: 'Borrador', cls: 'b-gray' },
  en_revision: { label: 'En revisión', cls: 'b-amber' },
  publicado: { label: 'Publicado', cls: 'b-green' },
  optimizado: { label: 'Optimizado', cls: 'b-blue' },
}

export const INTENTS: Record<string, { label: string; cls: string }> = {
  informacional: { label: 'Informacional', cls: 'b-blue' },
  comercial: { label: 'Comercial', cls: 'b-amber' },
  transaccional: { label: 'Transaccional', cls: 'b-green' },
}

export const INDEX_STATES: Record<string, { label: string; cls: string }> = {
  indexada: { label: 'Indexada', cls: 'b-green' },
  pendiente: { label: 'Pendiente', cls: 'b-amber' },
  noindex: { label: 'No index', cls: 'b-gray' },
}

export const ROUTES = [
  { group: 'Trabajo' },
  { id: 'dashboard', label: 'Panel', crumb: 'Panel', sub: 'Resumen general' },
  { id: 'projects', label: 'Proyectos', crumb: 'Proyectos', sub: 'Agrupación de nichos y webs' },
  { id: 'niches', label: 'Nichos', crumb: 'Nichos', sub: 'Unidad estratégica principal' },
  { id: 'pages', label: 'Páginas', crumb: 'Páginas', sub: 'Contenido planificado (TSG / TSR / TSA)' },
  { id: 'keywords', label: 'Palabras clave', crumb: 'Palabras clave', sub: 'Asignación e intención de búsqueda' },
  { id: 'urls', label: 'URLs', crumb: 'URLs', sub: 'Ejecución publicada e indexación' },
  { group: 'SEO' },
  { id: 'links', label: 'Enlazado interno', crumb: 'Enlazado interno', sub: 'Enlaces internos y páginas huérfanas' },
  { id: 'notes', label: 'Notas', crumb: 'Notas', sub: 'Notas estratégicas' },
  { group: 'Asistente' },
  { id: 'ai', label: 'Generador IA', crumb: 'Generador de contenido IA', sub: 'Borradores con ChatGPT · siempre revisión manual' },
  { group: 'Datos' },
  { id: 'performance', label: 'Rendimiento', crumb: 'Panel de rendimiento', sub: 'Páginas ganadoras, en caída y prioridades' },
  { id: 'gsc-data', label: 'Search Console', crumb: 'Datos Search Console', sub: 'Impresiones, clicks, CTR y posición por URL' },
  { id: 'analytics-data', label: 'Analytics', crumb: 'Datos Google Analytics', sub: 'Sesiones, usuarios, rebote y engagement' },
  { id: 'ads-keywords', label: 'Keywords Ads', crumb: 'Google Ads Keyword Planner', sub: 'Volumen, competencia y CPC' },
  { group: 'Integraciones' },
  { id: 'integrations', label: 'Google OAuth', crumb: 'Integraciones Google', sub: 'Search Console, Analytics y Ads' },
  { id: 'sync', label: 'Sincronización', crumb: 'Sincronización en segundo plano', sub: 'Trabajos programados e histórico' },
  { id: 'competitors', label: 'Competidores', crumb: 'Competidores', sub: 'Dominios rivales por nicho' },
  { group: 'IA avanzada' },
  { id: 'assistants', label: 'Asistentes IA', crumb: 'Asistentes IA especializados', sub: '5 asistentes con prompts editables' },
  { id: 'prompts', label: 'Editor de prompts', crumb: 'Editor de prompts IA', sub: 'Prompts en base de datos · nunca hardcodeados' },
  { group: 'Publicación' },
  { id: 'wordpress', label: 'WordPress', crumb: 'Puente WordPress', sub: 'Exportar estructura · publicación manual' },
] as const