import Link from "next/link"
import type { ReactNode } from "react"
import { BrandMark } from "@/components/brand-mark"

export function PublicLegalPage({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string
  title: string
  updated?: string
  children: ReactNode
}) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/80">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-2 font-serif text-xl" aria-label="VibeTravel home">
            <BrandMark className="h-8 w-8 shrink-0" />
            <span>VibeTravel</span>
          </Link>
          <Link href="/auth/login" className="text-sm font-medium text-primary hover:underline">Sign in</Link>
        </div>
      </header>
      <article className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
        <h1 className="mt-3 font-serif text-4xl sm:text-5xl">{title}</h1>
        {updated ? <p className="mt-3 text-sm text-muted-foreground">Last updated {updated}</p> : null}
        <div className="mt-10 space-y-8 text-[15px] leading-7 text-muted-foreground">{children}</div>
      </article>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-4xl flex-wrap gap-5 px-5 py-6 text-xs text-muted-foreground">
          <Link href="/privacy" className="hover:text-primary">Privacy</Link>
          <Link href="/terms" className="hover:text-primary">Terms</Link>
          <Link href="/support" className="hover:text-primary">Support</Link>
        </div>
      </footer>
    </main>
  )
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-xl font-semibold text-foreground">{title}</h2>
      <div>{children}</div>
    </section>
  )
}
