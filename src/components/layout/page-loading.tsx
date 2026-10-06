export function PageLoading({ rows = 6 }: { rows?: number }) {
  return (
    <div
      className="mx-auto max-w-6xl animate-pulse px-4 py-8"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="h-7 w-48 rounded bg-muted" />
      <div className="mt-6 grid gap-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="h-12 rounded-md bg-muted/60" />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
