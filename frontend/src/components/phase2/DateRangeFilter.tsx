import type { DateRange } from '../../types/phase2'

interface Props {
  value: DateRange
  onChange: (v: DateRange) => void
}

const PRESETS: { label: string; days: number }[] = [
  { label: '7 días', days: 7 },
  { label: '28 días', days: 28 },
  { label: '90 días', days: 90 },
]

function daysAgoIso(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export function DateRangeFilter({ value, onChange }: Props) {
  const applyPreset = (days: number) => {
    onChange({ from: daysAgoIso(days), to: daysAgoIso(0) })
  }

  return (
    <div className="filter-row">
      <div className="filter-presets">
        {PRESETS.map((p) => (
          <button
            key={p.days}
            type="button"
            className="btn btn-sm"
            onClick={() => applyPreset(p.days)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="filter-dates">
        <input type="date" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} />
        <span className="muted">→</span>
        <input type="date" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} />
      </div>
    </div>
  )
}

export function defaultDateRange(days = 28): DateRange {
  return { from: daysAgoIso(days), to: daysAgoIso(0) }
}