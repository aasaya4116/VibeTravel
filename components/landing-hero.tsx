"use client"

import Link from "next/link"
import { useEffect, useState, useRef } from "react"
import {
  Search,
  MapPin,
  Heart,
  Sparkles,
  ArrowRight,
  Check,
  ChevronDown,
  Clock,
  Baby,
  Shield,
  Star,
} from "lucide-react"

/* ── Helpers ── */

function FadeIn({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setTimeout(() => setVisible(true), delay)
      },
      { threshold: 0.1 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [delay])

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  )
}

function PlaneSVG({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M186.62 464H160a16 16 0 01-14.57-22.6l64.46-142.25L113.1 297l-35.3 42.77C71.07 348.2 65.7 352 52 352H34.08a17.66 17.66 0 01-14.7-7.06c-2.38-3.21-4.72-8.65-2.44-16.41l19.82-71 .18-.59-.18-.59-19.82-71c-2.28-7.76.06-13.2 2.44-16.41a17.66 17.66 0 0114.7-7.06H52c13.7 0 19.07 3.8 25.8 12.23l35.3 42.77 96.79-2.16-64.46-142.25A16 16 0 01160 48h26.62a16 16 0 0113.88 8L320 208.42l112.17-.57a79 79 0 0143.83 15.44c14 10.7 20 23.15 20 32.71s-6 22-20 32.71a79 79 0 01-43.83 15.44L320 303.58 200.5 456a16 16 0 01-13.88 8z" />
    </svg>
  )
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-white/8">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-5 text-left"
      >
        <span className="pr-4 font-medium text-white/80">{question}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-white/30 transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          open ? "max-h-48 pb-5" : "max-h-0"
        }`}
      >
        <p className="text-sm leading-relaxed text-white/40">{answer}</p>
      </div>
    </div>
  )
}

const CITIES = [
  "Paris", "Tokyo", "London", "New York", "Bali",
  "Singapore", "Barcelona", "Rome", "Sydney", "Dubai",
  "Amsterdam", "Kyoto", "Marrakech", "Prague", "Lisbon",
  "Bangkok", "Cape Town", "Santorini",
]

/* ── Main ── */

export function LandingHero() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  return (
    <div className="bg-[#09090d] text-white">

      {/* ══════════════════════════════════════════
          HERO — cinematic, full-bleed
      ══════════════════════════════════════════ */}
      <section className="relative flex min-h-screen flex-col overflow-hidden">

        {/* Background photo */}
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.pexels.com/photos/1231365/pexels-photo-1231365.jpeg?auto=compress&cs=tinysrgb&w=1800&q=90&fit=crop"
            alt=""
            className="h-full w-full object-cover object-center"
            loading="eager"
          />
          {/* Cinematic gradient layering */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-black/10" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/5 to-black/40" />
        </div>

        {/* Decorative glow orb */}
        <div className="pointer-events-none absolute -right-32 top-0 h-[500px] w-[500px] rounded-full bg-primary/15 blur-[120px]" />

        {/* ── Nav ── */}
        <header className="relative z-10 flex items-center justify-between px-6 py-6 lg:px-12">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
              <PlaneSVG className="h-4 w-4 -rotate-45" />
            </div>
            <span className="font-serif text-xl text-white">VibeTravel</span>
          </div>

          {/* Centre pill nav */}
          <nav className="hidden items-center gap-0.5 rounded-full border border-white/10 bg-white/5 px-2 py-2 backdrop-blur-md md:flex">
            <Link
              href="/search"
              className="rounded-full px-4 py-1.5 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              Explore
            </Link>
            <Link
              href="#how-it-works"
              className="rounded-full px-4 py-1.5 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              How it works
            </Link>
            <Link
              href="#faq"
              className="rounded-full px-4 py-1.5 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              FAQ
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="text-sm text-white/50 transition-colors hover:text-white"
            >
              Log In
            </Link>
            <Link
              href="/auth/sign-up"
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-primary/90 hover:scale-[1.02]"
            >
              Get Started ↗
            </Link>
          </div>
        </header>

        {/* ── Hero Content ── */}
        <div className="relative z-10 flex flex-1 items-end">
          <div className="mx-auto w-full max-w-6xl px-6 pb-16 lg:px-12 lg:pb-20">
            <div className="grid grid-cols-1 items-end gap-10 lg:grid-cols-2">

              {/* Left: Headline */}
              <div
                className={`transition-all duration-1000 ease-out ${
                  mounted ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
                }`}
              >
                <p className="mb-5 text-[11px] font-medium tracking-[0.25em] text-white/35 uppercase">
                  AI Family Travel Planner
                </p>
                <h1 className="font-serif text-5xl leading-[1.1] tracking-tight text-white md:text-6xl lg:text-7xl">
                  Your family&apos;s
                  <br />
                  next adventure,
                  <br />
                  <em className="italic text-primary">by vibe.</em>
                </h1>
                <p className="mt-6 max-w-sm text-base leading-relaxed text-white/55 md:text-lg">
                  AI that knows your kids&apos; ages, sensory needs, and travel pace.
                  Real plans. Real destinations.
                </p>

                {/* Kid-focus trust pills */}
                <div className="mt-5 flex flex-wrap gap-2">
                  {[
                    { emoji: "👶", label: "All ages" },
                    { emoji: "🛝", label: "Stroller access" },
                    { emoji: "🤫", label: "Sensory notes" },
                    { emoji: "🎡", label: "Kid-first picks" },
                  ].map(({ emoji, label }) => (
                    <span
                      key={label}
                      className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/50 backdrop-blur-sm"
                    >
                      <span>{emoji}</span>
                      {label}
                    </span>
                  ))}
                </div>

                <div className="mt-7 flex flex-wrap items-center gap-4">
                  <Link
                    href="/auth/sign-up"
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-white transition-all hover:bg-primary/90 hover:gap-3 active:scale-95"
                  >
                    Start Planning — It&apos;s Free
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/search"
                    className="text-sm text-white/40 underline-offset-4 transition-colors hover:text-white/70 hover:underline"
                  >
                    Browse destinations →
                  </Link>
                </div>
                <p className="mt-4 text-xs text-white/25">
                  No credit card. Set up in 30 seconds.
                </p>
              </div>

              {/* Right: Floating UI cards */}
              <div
                className={`hidden lg:flex flex-col items-end gap-3 transition-all duration-1000 delay-500 ease-out ${
                  mounted ? "translate-y-0 opacity-100" : "translate-y-16 opacity-0"
                }`}
              >
                {/* Attraction card mock */}
                <div className="card-float w-72 overflow-hidden rounded-2xl border border-white/10 bg-black/50 shadow-[0_25px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                  <div className="relative h-36 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=600&q=85&fit=crop"
                      alt="Ueno Park"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <div className="absolute bottom-2 left-3">
                      <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-medium text-gray-800">
                        Nature
                      </span>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="mb-1 flex items-center gap-1.5">
                      <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                      <span className="text-[10px] font-medium text-amber-400">4.8</span>
                      <span className="text-[10px] text-white/35">· ✓ Google</span>
                    </div>
                    <p className="text-sm font-medium text-white">Ueno Park</p>
                    <p className="mt-0.5 text-xs text-white/35">Tokyo, Japan</p>
                    <div className="mt-2.5 flex gap-1.5">
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                        Toddler-friendly
                      </span>
                      <span className="rounded-full border border-white/8 bg-white/5 px-2 py-0.5 text-[10px] text-white/40">
                        Free entry
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-3 text-[10px] text-white/30">
                      <span className="flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" /> 2–3 hrs
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-2.5 w-2.5" /> Ueno
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-white/25">
                      <Baby className="h-2.5 w-2.5" />
                      Best for ages 2–10
                    </div>
                  </div>
                </div>

                {/* Mini itinerary card */}
                <div className="card-float-slow w-60 rounded-xl border border-white/8 bg-black/50 p-4 shadow-xl backdrop-blur-xl">
                  <p className="mb-2.5 text-[9px] font-semibold tracking-[0.18em] text-white/25 uppercase">
                    Day 1 · Tokyo
                  </p>
                  {[
                    { time: "09:00", name: "Ueno Park", done: true },
                    { time: "12:00", name: "Lunch at Izakaya", done: false },
                    { time: "14:30", name: "Sensoji Temple", done: false },
                  ].map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center gap-2.5 border-b border-white/[0.04] py-1.5 last:border-0"
                    >
                      <span className="w-9 shrink-0 text-[10px] text-white/25">{item.time}</span>
                      <span
                        className={`flex-1 text-[11px] ${
                          item.done ? "text-white/20 line-through" : "text-white/60"
                        }`}
                      >
                        {item.name}
                      </span>
                      {item.done && (
                        <Check className="h-3 w-3 shrink-0 text-primary" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom editorial bar ── */}
        <div className="relative z-10 border-t border-white/[0.06] bg-black/25 backdrop-blur-sm">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3 text-xs text-white/25 lg:px-12">
            <span>50+ Cities Worldwide</span>
            <div className="hidden items-center gap-6 sm:flex">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" /> AI-Powered
              </span>
              <span className="flex items-center gap-1.5">
                <Shield className="h-3 w-3" /> Free to Use
              </span>
              <span className="flex items-center gap-1.5">
                <Baby className="h-3 w-3" /> Kid-Friendly
              </span>
            </div>
            <span>VibeTravel · 2026</span>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          CITIES MARQUEE
      ══════════════════════════════════════════ */}
      <div className="overflow-hidden border-y border-white/[0.05] bg-[#0c0c11] py-4">
        <div className="marquee-track flex w-max gap-8 text-sm text-white/18 font-serif">
          {[...CITIES, ...CITIES].map((city, i) => (
            <span key={i} className="flex shrink-0 items-center gap-8">
              {city}
              <span className="text-primary/25 text-xs">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          THE PROBLEM
      ══════════════════════════════════════════ */}
      <section className="bg-[#0d0d12] py-20 lg:py-32">
        <div className="mx-auto max-w-5xl px-6 lg:px-10">
          <FadeIn>
            <p className="mb-3 text-center text-[11px] font-medium tracking-[0.22em] text-white/25 uppercase">
              The Problem
            </p>
            <h2 className="mb-14 text-center font-serif text-3xl text-white md:text-4xl">
              Family trip planning is broken.
            </h2>
          </FadeIn>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              {
                icon: Clock,
                title: "Hours of research",
                desc: "Endless tabs, blog posts, and review sites just to find one place your toddler won't melt down at.",
              },
              {
                icon: Baby,
                title: "Generic recommendations",
                desc: "\"Top 10\" lists don't know your kid's age, sensory needs, or nap schedule.",
              },
              {
                icon: Sparkles,
                title: "Itineraries that fall apart",
                desc: "You pack in too much, skip nap time, and end up with cranky kids by 2pm.",
              },
            ].map(({ icon: Icon, title, desc }, i) => (
              <FadeIn key={title} delay={i * 80}>
                <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-6 transition-colors hover:border-white/10">
                  <Icon className="mb-4 h-6 w-6 text-white/20" />
                  <h3 className="mb-2 text-sm font-medium text-white/70">{title}</h3>
                  <p className="text-sm leading-relaxed text-white/30">{desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════════ */}
      <section id="how-it-works" className="bg-[#09090d] py-20 lg:py-32">
        <div className="mx-auto max-w-5xl px-6 lg:px-10">
          <FadeIn>
            <p className="mb-3 text-center text-[11px] font-medium tracking-[0.22em] text-white/25 uppercase">
              How It Works
            </p>
            <h2 className="mb-16 text-center font-serif text-3xl text-white md:text-4xl">
              Three steps. Thirty seconds.
            </h2>
          </FadeIn>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {[
              {
                n: "01",
                title: "Set your family vibe",
                desc: "Kids' ages, travel style, dietary needs, pace. Set it once — used everywhere.",
              },
              {
                n: "02",
                title: "Search any city",
                desc: "AI surfaces the best kid-friendly spots tailored exactly to your crew.",
              },
              {
                n: "03",
                title: "Get your itinerary",
                desc: "Save spots and AI builds a day-by-day plan that actually works.",
              },
            ].map(({ n, title, desc }, i) => (
              <FadeIn key={n} delay={i * 100}>
                <div className="group relative overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.02] p-8 transition-all hover:border-primary/20 hover:bg-primary/[0.03]">
                  <p className="mb-5 font-serif text-5xl font-bold text-white/[0.04] transition-colors group-hover:text-primary/8">
                    {n}
                  </p>
                  <h4 className="mb-2 text-sm font-medium text-white/75">{title}</h4>
                  <p className="text-sm leading-relaxed text-white/30">{desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FEATURES
      ══════════════════════════════════════════ */}
      <section className="bg-[#0d0d12] py-20 lg:py-32">
        <div className="mx-auto max-w-5xl px-6 lg:px-10">
          <FadeIn>
            <p className="mb-3 text-center text-[11px] font-medium tracking-[0.22em] text-white/25 uppercase">
              Why VibeTravel
            </p>
            <h2 className="mb-14 text-center font-serif text-3xl text-white md:text-4xl">
              AI that actually knows your family.
            </h2>
          </FadeIn>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              {
                icon: Heart,
                title: "Personalized Profiles",
                desc: "Set kids' ages, sensory preferences, and travel pace. Every result adapts to your family.",
              },
              {
                icon: Search,
                title: "Vibe-Based Search",
                desc: "Filter by age, budget, category, and stroller access — all AI-powered.",
              },
              {
                icon: MapPin,
                title: "Smart Itineraries",
                desc: "Day-by-day plans that respect nap times, energy, and sensory needs.",
              },
            ].map(({ icon: Icon, title, desc }, i) => (
              <FadeIn key={title} delay={i * 100}>
                <div className="group rounded-2xl border border-white/[0.05] bg-white/[0.02] p-7 transition-all hover:border-primary/20">
                  <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h4 className="mb-2 text-sm font-medium text-white/75">{title}</h4>
                  <p className="text-sm leading-relaxed text-white/30">{desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>

          {/* Benefits grid */}
          <FadeIn delay={200}>
            <div className="mt-5 rounded-2xl border border-white/[0.05] bg-white/[0.015] p-8">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {[
                  { title: "Nap-time aware itineraries", desc: "AI schedules around your toddler's rhythm, not against it." },
                  { title: "Sensory-friendly filters", desc: "Find quiet spots, stroller access, and calm spaces instantly." },
                  { title: "One profile, every trip", desc: "Set your family's vibe once — personalized results everywhere." },
                  { title: "AI travel assistant", desc: "Ask questions, get backup plans, find kid-friendly restaurants on the fly." },
                ].map(({ title, desc }) => (
                  <div key={title} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white/65">{title}</p>
                      <p className="mt-0.5 text-xs text-white/28">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          CITY LIST
      ══════════════════════════════════════════ */}
      <section className="border-y border-white/[0.05] bg-[#09090d] py-14">
        <FadeIn>
          <p className="mb-7 text-center text-[11px] font-medium tracking-[0.22em] text-white/20 uppercase">
            Built for families visiting
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {["Paris", "London", "Tokyo", "New York", "Singapore", "Barcelona", "Bali", "Rome"].map(
              (city) => (
                <span
                  key={city}
                  className="cursor-default font-serif text-xl text-white/18 transition-colors hover:text-white/45"
                >
                  {city}
                </span>
              )
            )}
          </div>
          <p className="mt-6 text-center text-xs text-white/18">...and 50+ more cities worldwide</p>
        </FadeIn>
      </section>

      {/* ══════════════════════════════════════════
          FAQ
      ══════════════════════════════════════════ */}
      <section id="faq" className="bg-[#0d0d12] py-20 lg:py-32">
        <div className="mx-auto max-w-2xl px-6 lg:px-10">
          <FadeIn>
            <p className="mb-3 text-center text-[11px] font-medium tracking-[0.22em] text-white/25 uppercase">
              FAQ
            </p>
            <h2 className="mb-10 text-center font-serif text-3xl text-white md:text-4xl">
              Got questions?
            </h2>
          </FadeIn>
          <FadeIn delay={100}>
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] px-6">
              <FAQItem
                question="Is VibeTravel free?"
                answer="Yes! Creating an account, setting your family profile, searching attractions, and building trips is completely free. We may introduce premium features in the future, but the core experience will always be free."
              />
              <FAQItem
                question="How does the AI know what's good for my kids?"
                answer="When you set your family vibe, you tell us your kids' ages, sensory needs, dietary requirements, and travel pace. Our AI uses this to filter and rank every attraction specifically for your family — not just generic 'family-friendly' labels."
              />
              <FAQItem
                question="What cities are supported?"
                answer="VibeTravel works in 50+ cities worldwide including Paris, London, Tokyo, New York, Singapore, Rome, Barcelona, and many more. Our AI can search for attractions in any city — even smaller ones."
              />
              <FAQItem
                question="Can I use it without an account?"
                answer="You can browse and search for attractions without an account. To save attractions, build trips, and get personalized recommendations based on your family profile, you'll need a free account."
              />
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FINAL CTA — cinematic
      ══════════════════════════════════════════ */}
      <section className="relative overflow-hidden py-28 lg:py-40">
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1600&q=85&fit=crop"
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/78" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#09090d] via-transparent to-transparent" />
        </div>
        <FadeIn>
          <div className="relative z-10 mx-auto max-w-2xl px-6 text-center lg:px-10">
            <Sparkles className="mx-auto mb-5 h-6 w-6 text-primary" />
            <h2 className="font-serif text-4xl text-white md:text-5xl">
              Ready to plan your next
              <br className="hidden sm:block" />{" "}
              family adventure?
            </h2>
            <p className="mx-auto mt-5 max-w-md text-base text-white/40">
              No commitment, no credit card. Set your family&apos;s vibe and start
              exploring in seconds.
            </p>
            <Link
              href="/auth/sign-up"
              className="mt-9 inline-flex items-center gap-2 rounded-full bg-primary px-10 py-4 text-base font-semibold text-white transition-all hover:bg-primary/90 hover:gap-3 active:scale-95"
            >
              Get Started Free
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </FadeIn>
      </section>

      {/* ══════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════ */}
      <footer className="border-t border-white/[0.05] bg-[#09090d] py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 sm:flex-row lg:px-10">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-primary">
              <PlaneSVG className="h-3 w-3 -rotate-45" />
            </div>
            <span className="font-serif text-sm text-white/40">VibeTravel</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-white/25">
            <Link href="/search" className="transition-colors hover:text-white/55">Explore</Link>
            <Link href="/auth/login" className="transition-colors hover:text-white/55">Sign In</Link>
            <Link href="/auth/sign-up" className="transition-colors hover:text-white/55">Sign Up</Link>
          </div>
        </div>
      </footer>

      {/* ── Animations ── */}
      <style jsx>{`
        .card-float {
          animation: cardFloat 7s ease-in-out infinite;
        }
        .card-float-slow {
          animation: cardFloat 9s ease-in-out infinite;
          animation-delay: 2s;
        }
        @keyframes cardFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .marquee-track {
          animation: marquee 30s linear infinite;
          will-change: transform;
        }
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}
