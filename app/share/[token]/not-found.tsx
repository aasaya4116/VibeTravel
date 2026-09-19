import Link from "next/link"
import { Link2Off, Sparkles } from "lucide-react"

export default function SharedTripNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center card-soft sm:p-10">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Link2Off className="h-5 w-5" />
        </span>
        <h1 className="mt-5 font-serif text-3xl text-foreground">This trip link isn’t available</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          The trip owner may have stopped sharing it, or the link may be incomplete. Ask them for a new link.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Sparkles className="h-4 w-4" />
          Visit VibeTravel
        </Link>
      </div>
    </main>
  )
}
