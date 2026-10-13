"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BrandMark } from "@/components/brand-mark"
import { createClient } from "@/lib/supabase/client"

function passwordError(password: string, confirmation: string) {
  if (password.length < 6) return "Use at least 6 characters."
  if (password !== confirmation) return "The passwords don’t match."
  return null
}

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [checkingSession, setCheckingSession] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [complete, setComplete] = useState(false)

  useEffect(() => {
    let active = true
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setHasSession(Boolean(data.session))
      setCheckingSession(false)
    })
    return () => { active = false }
  }, [])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const validationError = passwordError(password, confirmation)
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const { error: updateError } = await createClient().auth.updateUser({ password })
      if (updateError) throw updateError
      setComplete(true)
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : ""
      setError(
        /session|expired|invalid/i.test(message)
          ? "This reset link has expired. Request a new one to continue."
          : "We couldn’t update your password. Please try again.",
      )
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
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Secure your account</p>
          <h1 className="mt-2 font-serif text-3xl text-foreground">Choose a new password</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">One small step, then your travel plans are waiting.</p>
        </div>

        <section className="card-soft rounded-2xl border border-border bg-card p-6 sm:p-8">
          {checkingSession ? (
            <p aria-live="polite" className="text-center text-sm text-muted-foreground">Opening your secure link…</p>
          ) : complete ? (
            <div aria-live="polite" className="text-center">
              <p className="font-serif text-2xl text-foreground">Password updated</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Your account is secure and ready for the next adventure.</p>
              <button
                type="button"
                onClick={() => router.replace("/dashboard")}
                className="mt-6 min-h-11 w-full rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition hover:-translate-y-px hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transform-none motion-reduce:transition-none"
              >
                Continue to VibeTravel
              </button>
            </div>
          ) : !hasSession ? (
            <div className="text-center">
              <p role="alert" className="font-serif text-2xl text-foreground">This link is no longer active</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Password reset links expire for your security.</p>
              <Link
                href="/auth/forgot-password"
                className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition hover:-translate-y-px hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transform-none motion-reduce:transition-none"
              >
                Request a new link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label htmlFor="password" className="text-sm font-medium text-foreground">New password</label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={6}
                  required
                  className="min-h-11 rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground">At least 6 characters.</p>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="confirmation" className="text-sm font-medium text-foreground">Confirm new password</label>
                <input
                  id="confirmation"
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  minLength={6}
                  required
                  className="min-h-11 rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {error ? <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

              <button
                type="submit"
                disabled={loading || !password || !confirmation}
                className="min-h-11 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition hover:-translate-y-px hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:translate-y-0 disabled:opacity-50 motion-reduce:transform-none motion-reduce:transition-none"
              >
                {loading ? "Updating password…" : "Update password"}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  )
}
