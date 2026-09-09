export default function Loading() {
  return (
    <div className="space-y-3">
      <div className="h-6 w-40 animate-pulse rounded bg-border/60" />
      <div className="h-4 w-24 animate-pulse rounded bg-border/40" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded border border-border bg-surface" />
        ))}
      </div>
    </div>
  )
}
