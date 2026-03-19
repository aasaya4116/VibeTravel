"use client"

import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useState } from "react"
import {
  Search,
  Map,
  User,
  LogOut,
  Menu,
  X,
  LayoutDashboard,
} from "lucide-react"

function PlaneSVG({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M186.62 464H160a16 16 0 01-14.57-22.6l64.46-142.25L113.1 297l-35.3 42.77C71.07 348.2 65.7 352 52 352H34.08a17.66 17.66 0 01-14.7-7.06c-2.38-3.21-4.72-8.65-2.44-16.41l19.82-71 .18-.59-.18-.59-19.82-71c-2.28-7.76.06-13.2 2.44-16.41a17.66 17.66 0 0114.7-7.06H52c13.7 0 19.07 3.8 25.8 12.23l35.3 42.77 96.79-2.16-64.46-142.25A16 16 0 01160 48h26.62a16 16 0 0113.88 8L320 208.42l112.17-.57a79 79 0 0143.83 15.44c14 10.7 20 23.15 20 32.71s-6 22-20 32.71a79 79 0 01-43.83 15.44L320 303.58 200.5 456a16 16 0 01-13.88 8z" />
    </svg>
  )
}

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/search", label: "Explore", icon: Search },
  { href: "/trips", label: "Trips", icon: Map },
]

export function AppHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0a0a0f]/95 backdrop-blur supports-[backdrop-filter]:bg-[#0a0a0f]/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white">
                <PlaneSVG className="h-3.5 w-3.5 -rotate-45" />
              </div>
              <span className="font-serif text-lg text-white">VibeTravel</span>
            </Link>

            <nav className="hidden items-center gap-0.5 rounded-full border border-white/10 bg-white/5 px-2 py-1.5 backdrop-blur-md md:flex" aria-label="Main navigation">
              {navLinks.map((link) => {
                const isActive = pathname === link.href || pathname.startsWith(link.href + "/")
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-white/10 text-white"
                        : "text-white/50 hover:bg-white/8 hover:text-white/80"
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              })}
            </nav>
          </div>

          <div className="flex items-center gap-1">
            <Link
              href="/profile"
              className="hidden rounded-lg p-2 text-white/40 transition-colors hover:bg-white/8 hover:text-white/80 md:flex"
              aria-label="Profile"
            >
              <User className="h-5 w-5" />
            </Link>
            <button
              onClick={handleSignOut}
              className="hidden rounded-lg p-2 text-white/40 transition-colors hover:bg-white/8 hover:text-white/80 md:flex"
              aria-label="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("open-scout-feedback"))}
              className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/40 transition-colors hover:bg-white/10 hover:text-white/70 md:block"
            >
              Give feedback
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-lg p-2 text-white/50 transition-colors hover:bg-white/8 md:hidden"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 top-16 z-40 bg-[#0a0a0f] md:hidden">
          <nav className="flex flex-col p-4" aria-label="Mobile navigation">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(link.href + "/")
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-base font-medium transition-colors ${
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-white/50 hover:bg-white/8 hover:text-white/80"
                  }`}
                >
                  <link.icon className="h-5 w-5" />
                  {link.label}
                </Link>
              )
            })}
            <hr className="my-3 border-white/[0.06]" />
            <Link
              href="/profile"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-base font-medium text-white/50 transition-colors hover:bg-white/8 hover:text-white/80"
            >
              <User className="h-5 w-5" />
              Profile
            </Link>
            <button
              onClick={() => { setMobileMenuOpen(false); handleSignOut() }}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-base font-medium text-white/50 transition-colors hover:bg-white/8 hover:text-white/80"
            >
              <LogOut className="h-5 w-5" />
              Sign out
            </button>
          </nav>
        </div>
      )}
    </>
  )
}
