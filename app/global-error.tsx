"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    // v11's environment-neutral entrypoint intentionally exposes only APIs
    // common to every runtime in its types. captureException is present in the
    // browser export selected by Next.js.
    ;(Sentry as typeof Sentry & { captureException: (exception: unknown) => string }).captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <main className="flex min-h-screen items-center justify-center px-6 py-16">
          <section className="w-full max-w-lg rounded-3xl border bg-card p-8 text-center shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              VibeTravel
            </p>
            <h1 className="mt-3 text-3xl font-semibold">We hit an unexpected detour.</h1>
            <p className="mt-3 text-muted-foreground">
              Your trip data is safe. Reload the page to keep planning.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground"
            >
              Reload VibeTravel
            </button>
          </section>
        </main>
      </body>
    </html>
  )
}
