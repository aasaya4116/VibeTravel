export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-12">
      {/* Greeting skeleton */}
      <div className="mb-10">
        <div className="h-9 w-56 animate-pulse rounded-lg bg-muted" />
        <div className="mt-3 h-5 w-72 animate-pulse rounded-lg bg-muted" />
      </div>

      {/* Quick actions skeleton */}
      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex animate-pulse items-center gap-4 rounded-2xl border border-border bg-card p-5"
          >
            <div className="h-12 w-12 shrink-0 rounded-xl bg-muted" />
            <div className="flex-1">
              <div className="h-4 w-32 rounded bg-muted" />
              <div className="mt-2 h-3 w-48 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>

      {/* Smart Itinerary Builder skeleton */}
      <div className="mb-10">
        <div className="animate-pulse rounded-2xl border border-border bg-card p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 shrink-0 rounded-2xl bg-muted" />
            <div className="flex-1">
              <div className="h-5 w-48 rounded bg-muted" />
              <div className="mt-3 h-4 w-full rounded bg-muted" />
              <div className="mt-2 h-4 w-3/4 rounded bg-muted" />
            </div>
          </div>
        </div>
      </div>

      {/* Trips section skeleton */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="h-6 w-28 animate-pulse rounded bg-muted" />
          <div className="h-5 w-20 animate-pulse rounded bg-muted" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl border border-border bg-card p-5"
            >
              <div className="mb-3 h-5 w-16 rounded-full bg-muted" />
              <div className="h-5 w-40 rounded bg-muted" />
              <div className="mt-2 h-4 w-28 rounded bg-muted" />
              <div className="mt-3 h-3 w-36 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
