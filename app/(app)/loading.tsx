export default function AppLoading() {
  return (
    <div
      className="mx-auto min-h-[70vh] max-w-6xl px-4 py-8 lg:px-8 lg:py-12"
      role="status"
      aria-live="polite"
      aria-label="Loading your travel plans"
    >
      <div className="animate-pulse">
        <div className="h-3 w-32 rounded-full bg-primary/15" />
        <div className="mt-4 h-10 w-3/4 max-w-xl rounded-xl bg-muted" />
        <div className="mt-3 h-4 w-1/2 max-w-sm rounded-lg bg-muted" />

        <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <div className="h-64 rounded-[1.5rem] border border-border bg-muted/70" />
            <div className="h-14 rounded-2xl border border-border bg-card" />
            <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
              <div className="h-5 w-40 rounded bg-muted" />
              <div className="h-20 rounded-xl bg-muted/70" />
              <div className="h-20 rounded-xl bg-muted/70" />
            </div>
          </div>
          <div className="hidden space-y-4 lg:block">
            <div className="h-32 rounded-2xl border border-border bg-card" />
            <div className="h-56 rounded-2xl border border-border bg-card" />
          </div>
        </div>
      </div>
      <span className="sr-only">Loading your travel plans…</span>
    </div>
  )
}
