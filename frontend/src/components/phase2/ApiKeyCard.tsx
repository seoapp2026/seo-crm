import { useState } from 'react'
import { phase2Api } from '../../api/phase2-client'

export function ApiKeyCard() {
  const [name, setName] = useState('n8n')
  const [canWrite, setCanWrite] = useState(false)
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const createKey = async () => {
    if (creating || createdKey) return
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Escribe un nombre para la clave.')
      return
    }
    setCreating(true)
    setError(null)
    setMessage(null)
    try {
      const result = await phase2Api.apiKeys.create(trimmedName, canWrite)
      setCreatedKey(result.api_key)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la clave API.')
    } finally {
      setCreating(false)
    }
  }

  const copyKey = async () => {
    if (!createdKey) return
    try {
      await navigator.clipboard.writeText(createdKey)
      setMessage('Clave copiada. Pégala en la credencial de n8n y después limpia el portapapeles.')
      setError(null)
    } catch {
      setError('No se pudo copiar automáticamente. Selecciona la clave y cópiala manualmente.')
    }
  }

  return (
    <section className="card card-pad" style={{ marginBottom: 16 }} aria-labelledby="api-key-heading">
      <h2 id="api-key-heading" style={{ fontSize: 15, marginBottom: 8 }}>Clave API para n8n</h2>
      <p className="t-sub" style={{ marginBottom: 12 }}>
        Crea una clave del CRM para usarla en n8n como credencial Header Auth, con la cabecera <code>X-API-Key</code>.
      </p>
      {!createdKey ? (
        <>
          <div className="field" style={{ maxWidth: 420, marginBottom: 12 }}>
            <label htmlFor="api-key-name">Nombre de la clave</label>
            <input id="api-key-name" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field" style={{ maxWidth: 420, marginBottom: 12 }}>
            <label htmlFor="api-key-access">Permisos</label>
            <select id="api-key-access" value={canWrite ? 'write' : 'read'} onChange={(e) => setCanWrite(e.target.value === 'write')}>
              <option value="read">Solo lectura (recomendado para la primera prueba)</option>
              <option value="write">Lectura y escritura</option>
            </select>
          </div>
          <p className="muted" style={{ marginBottom: 12 }}>
            Esta clave es global, no está limitada al proyecto seleccionado. Una clave con escritura puede modificar datos de todos los proyectos.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => void createKey()} disabled={creating}>
            {creating ? 'Generando…' : 'Generar clave API'}
          </button>
        </>
      ) : (
        <>
          <p role="status" style={{ marginBottom: 12 }}>
            Copia la clave ahora: solo se muestra una vez. No la envíes por mensajes ni la guardes en Notion.
          </p>
          <div className="field" style={{ marginBottom: 12 }}>
            <label htmlFor="generated-api-key">Clave generada</label>
            <input id="generated-api-key" className="mono" type="text" value={createdKey} readOnly autoComplete="off" onFocus={(e) => e.currentTarget.select()} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" className="btn btn-primary" onClick={() => void copyKey()}>Copiar clave</button>
            <button type="button" className="btn" onClick={() => { setCreatedKey(null); setMessage(null); setError(null) }}>Ya la he guardado</button>
          </div>
        </>
      )}
      {message && <p role="status" className="muted" style={{ marginTop: 12 }}>{message}</p>}
      {error && <p role="alert" className="sync-error" style={{ marginTop: 12 }}>{error}</p>}
    </section>
  )
}
