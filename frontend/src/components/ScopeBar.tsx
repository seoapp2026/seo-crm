import type { Project } from '../types'

export function ScopeBar({
  projects,
  value,
  onChange,
}: {
  projects: Project[]
  value: number | 'all'
  onChange: (v: number | 'all') => void
}) {
  return (
    <div className="scope-bar">
      <label>Proyecto</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value === 'all' ? 'all' : Number(e.target.value))}
      >
        <option value="all">Todos los proyectos</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>
        Filtra todo el sistema por proyecto
      </span>
    </div>
  )
}