import type { GoogleAuth, GoogleService } from '../../types/phase2'

const SERVICE_META: Record<GoogleService, { title: string; desc: string; icon: string }> = {
  gsc: {
    title: 'Search Console',
    desc: 'Impresiones, clicks, CTR y posición por URL · histórico diario',
    icon: 'GSC',
  },
  ga4: {
    title: 'Google Analytics 4',
    desc: 'Sesiones, usuarios, rebote y tiempo de engagement por página',
    icon: 'GA4',
  },
  ads: {
    title: 'Keyword Planner',
    desc: 'Volumen, competencia y CPC estimado · Google Ads API',
    icon: 'Ads',
  },
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
}

interface Props {
  auth: GoogleAuth
  onConnect: () => void
  onDisconnect: () => void
  connectBlockedReason?: string | null
}

export function ConnectionCard({ auth, onConnect, onDisconnect, connectBlockedReason }: Props) {
  const meta = SERVICE_META[auth.service]

  return (
    <div className={`conn-card${auth.connected ? ' connected' : ''}`}>
      <div className="conn-head">
        <div className="conn-icon">{meta.icon}</div>
        <div>
          <div className="conn-title">{meta.title}</div>
          <div className="conn-desc">{meta.desc}</div>
        </div>
        <span className={`badge ${auth.connected ? 'b-green' : 'b-gray'}`}>
          <span className="badge-dot" />
          {auth.connected ? 'Conectado' : 'Sin conectar'}
        </span>
      </div>

      {auth.connected ? (
        <div className="conn-body">
          <div className="conn-meta">
            <span><strong>Cuenta:</strong> {auth.account_email}</span>
            <span><strong>Propiedad:</strong> {auth.property_label || auth.property_id}</span>
            <span><strong>Última sync:</strong> {fmtDate(auth.last_sync_at)}</span>
          </div>
          <button type="button" className="btn btn-sm btn-danger" onClick={onDisconnect}>
            Desconectar
          </button>
        </div>
      ) : (
        <div className="conn-body">
          <p className="muted" style={{ flex: 1 }}>
            {connectBlockedReason
              ? connectBlockedReason
              : auth.service === 'ads'
                ? 'Conecta la cuenta de Google Ads (Keyword Planner) vía OAuth2. Requiere GOOGLE_ADS_DEVELOPER_TOKEN en el servidor.'
                : 'Conecta vía OAuth2 para sincronizar datos en segundo plano.'}
          </p>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={onConnect}
            disabled={Boolean(connectBlockedReason)}
          >
            Conectar OAuth
          </button>
        </div>
      )}
    </div>
  )
}