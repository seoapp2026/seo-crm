export function Sparkline({ values, width = 72, height = 24 }: { values: number[]; width?: number; height?: number }) {
  if (!values.length) return <span className="muted">—</span>
  const max = Math.max(1, ...values)
  const step = width / Math.max(values.length - 1, 1)
  const points = values
    .map((v, i) => {
      const x = i * step
      const y = height - (v / max) * (height - 4) - 2
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg width={width} height={height} className="sparkline" aria-hidden>
      <polyline fill="none" stroke="var(--accent)" strokeWidth="2" points={points} />
    </svg>
  )
}