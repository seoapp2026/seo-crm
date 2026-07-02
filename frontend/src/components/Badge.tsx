export function Badge({ label, cls }: { label: string; cls: string }) {
  return (
    <span className={`badge ${cls}`}>
      <span className="badge-dot" />
      {label}
    </span>
  )
}