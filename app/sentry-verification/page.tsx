"use client"

import * as Sentry from "@sentry/nextjs"
import { useState } from "react"

export default function SentryVerificationPage() {
  const [browserStatus, setBrowserStatus] = useState("Ready")
  const [apiStatus, setApiStatus] = useState("Ready")

  async function verifyBrowserReporting() {
    setBrowserStatus("Sending…")
    const eventId = Sentry.captureException(
      new Error("VibeTravel browser Sentry verification")
    )
    const delivered = await Sentry.flush(2_000)
    setBrowserStatus(delivered ? `Sent (${eventId})` : "Timed out")
  }

  async function verifyApiReporting() {
    setApiStatus("Sending…")
    const response = await fetch("/api/sentry-verification", { method: "POST" })
    setApiStatus(response.status === 500 ? "Sent" : `Unexpected ${response.status}`)
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-8 px-6 py-16">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
          Temporary diagnostics
        </p>
        <h1 className="font-serif text-4xl">Sentry verification</h1>
        <p className="text-muted-foreground">
          Send privacy-safe browser and API test errors, then remove this page.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          className="rounded-xl bg-primary px-5 py-4 font-semibold text-primary-foreground"
          onClick={verifyBrowserReporting}
          type="button"
        >
          Browser event · {browserStatus}
        </button>
        <button
          className="rounded-xl border border-border bg-background px-5 py-4 font-semibold"
          onClick={verifyApiReporting}
          type="button"
        >
          API event · {apiStatus}
        </button>
      </div>
    </main>
  )
}
