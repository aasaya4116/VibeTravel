"use client"

import { useState } from "react"
import Link from "next/link"
import { BrandMark } from "@/components/brand-mark"
import { createClient } from "@/lib/supabase/client"

function recoveryCallbackUrl() {
  const configured = process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL
  const callback = new URL(configured || "/auth/callback", window.location.origin)
  callback.searchParams.set("next", "/auth/reset-password")
  return callback.toString()
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error: resetError } = await createClient().auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: recoveryCallbackUrl() },
      )
      if (resetError) throw resetError
      setSent(true)
    } catch {
      setError("We couldn’t send the reset email. Check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex min-h-11 items-center gap-3 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="VibeTravel home">
            <BrandMark className="h-10 w-10 shrink-0" />
            <span className="font-serif text-3xl text-foreground">VibeTravel</span>
          </Link>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Account recovery
          </p>
          <h1 className="mt-2 font-serif text-3xl text-foreground">Find your way back</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            We’ll email you a secure link to choose a new password.
          </p>
        </div>

        <section className="card-soft rounded-2xl border border-border bg-card p-6 sm:p-8">
          {sent ? (
            <div aria-live="polite" className="text-center">
              <p className="font-serif text-2xl text-foreground">Check your inbox</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                If an account exists for <span className="font-medium text-foreground">{email.trim()}</span>,
                you’ll receive a password reset link shortly.
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="mt-4 inline-flex min-h-11 items-center justify-center text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Send to a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label htmlFor="email" className="text-sm font-medium text-foreground">Email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  className="min-h-11 rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {error ? (
                <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
              ) : null}

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="min-h-11 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition hover:-translate-y-px hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:translate-y-0 disabled:opacity-50 motion-reduce:transform-none motion-reduce:transition-none"
              >
                {loading ? "Sending secure link…" : "Email me a reset link"}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Remembered it?{" "}
            <Link href="/auth/login" className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Back to sign in
            </Link>
          </p>
        </section>
      </div>
    </main>
  )
}
