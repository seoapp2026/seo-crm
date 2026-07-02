/** Must match backend `app.constants.API_PREFIX` */
const API_PATH = '/api/seo-crm'

const configured = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '')

/**
 * - Monolith deploy: `/api/seo-crm` (same origin)
 * - Split deploy: `https://api-seo-crm.up.railway.app/api/seo-crm`
 */
export const API_BASE = configured && configured.length > 0 ? configured : API_PATH