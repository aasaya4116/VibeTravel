"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { MilestonePulse } from "@/components/milestone-pulse"
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  X,
  Sparkles,
  Users,
  Heart,
  Zap,
  ChevronLeft,
} from "lucide-react"
import type { FamilyVibe, Kid } from "@/lib/types"

interface VibeOnboardingProps {
  existingVibe: FamilyVibe | null
  isOnboarding?: boolean
}

const travelStyles = [
  "Cultural explorer",
  "Nature lover",
  "Foodie family",
  "Urban adventurer",
  "Beach & relaxation",
  "Off the beaten path",
  "History buff",
  "Art & design",
  "Active & outdoorsy",
  "Slow travel",
]

const sensoryOptions = [
  "Noise sensitive",
  "Crowd avoidant",
  "Needs quiet spaces",
  "Texture sensitive",
  "Light sensitive",
  "Needs movement breaks",
]

const dietaryOptions = [
  "Vegetarian",
  "Vegan",
  "Gluten-free",
  "Dairy-free",
  "Nut allergy",
  "Halal",
  "Kosher",
]

export function VibeOnboarding({ existingVibe, isOnboarding = false }: VibeOnboardingProps) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [showPulse, setShowPulse] = useState(false)

  const [familyName, setFamilyName] = useState(
    existingVibe?.family_name || ""
  )
  const [kids, setKids] = useState<Kid[]>(
    existingVibe?.kids || [{ name: "", age: 0 }]
  )
  const [travelStyle, setTravelStyle] = useState<string[]>(
    existingVibe?.travel_style || []
  )
  const [sensoryNeeds, setSensoryNeeds] = useState<string[]>(
    existingVibe?.sensory_needs || []
  )
  const [mobilityNotes, setMobilityNotes] = useState(
    existingVibe?.mobility_notes || ""
  )
  const [dietary, setDietary] = useState<string[]>(
    existingVibe?.dietary || []
  )
  const [pace, setPace] = useState<"slow" | "moderate" | "fast">(
    existingVibe?.pace || "moderate"
  )
  const [budgetPreference, setBudgetPreference] = useState<"free" | "$" | "$$" | "$$$" | "any">(
    existingVibe?.budget_preference || "any"
  )

  const isDirty = useMemo(() => {
    const initial = existingVibe
    if (!initial) {
      return (
        familyName !== "" ||
        kids.some((k) => k.name.trim() !== "") ||
        travelStyle.length > 0 ||
        sensoryNeeds.length > 0 ||
        mobilityNotes !== "" ||
        dietary.length > 0 ||
        pace !== "moderate"
      )
    }
    return (
      familyName !== (initial.family_name || "") ||
      JSON.stringify(kids) !== JSON.stringify(initial.kids || [{ name: "", age: 0 }]) ||
      JSON.stringify(travelStyle) !== JSON.stringify(initial.travel_style || []) ||
      JSON.stringify(sensoryNeeds) !== JSON.stringify(initial.sensory_needs || []) ||
      mobilityNotes !== (initial.mobility_notes || "") ||
      JSON.stringify(dietary) !== JSON.stringify(initial.dietary || []) ||
      pace !== (initial.pace || "moderate") ||
      budgetPreference !== (initial.budget_preference || "any")
    )
  }, [familyName, kids, travelStyle, sensoryNeeds, mobilityNotes, dietary, pace, budgetPreference, existingVibe])

  function handleBack() {
    if (isDirty) {
      const confirmed = window.confirm(
        "You have unsaved changes. Are you sure you want to leave?"
      )
      if (!confirmed) return
    }
    router.push("/profile")
  }

  const steps = [
    { title: "Your Family", icon: Users },
    { title: "Travel Style", icon: Heart },
    { title: "Needs & Pace", icon: Zap },
  ]

  function addKid() {
    setKids([...kids, { name: "", age: 0 }])
  }

  function removeKid(index: number) {
    setKids(kids.filter((_, i) => i !== index))
  }

  function updateKid(index: number, field: keyof Kid, value: string | number) {
    const updated = [...kids]
    updated[index] = { ...updated[index], [field]: value }
    setKids(updated)
  }

  function toggleItem(
    list: string[],
    setList: (v: string[]) => void,
    item: string
  ) {
    if (list.includes(item)) {
      setList(list.filter((i) => i !== item))
    } else {
      setList([...list, item])
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/family-vibe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          family_name: familyName,
          kids: kids.filter((k) => k.name.trim()),
          travel_style: travelStyle,
          sensory_needs: sensoryNeeds,
          mobility_notes: mobilityNotes,
          dietary,
          pace,
          budget_preference: budgetPreference,
        }),
      })

      if (res.status === 401) {
        router.push("/auth/login?next=/profile/vibe")
        return
      }
      if (!res.ok) throw new Error("Failed to save")

      toast.success("Family vibe saved!")
      setShowPulse(true)
      router.push(isOnboarding ? "/trips" : "/dashboard")
      router.refresh()
    } catch {
      toast.error("Failed to save your vibe profile")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
    {showPulse && (
      <MilestonePulse step="vibe_saved" onDismiss={() => setShowPulse(false)} />
    )}
    <div className="mx-auto max-w-2xl px-4 py-8 lg:py-12">
      {/* Back / skip link */}
      {isOnboarding ? (
        <div className="mb-6 flex justify-end">
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Skip for now
          </Link>
        </div>
      ) : (
        <button
          onClick={handleBack}
          className="mb-6 flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Profile
        </button>
      )}

      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary">
          <Sparkles className="h-4 w-4" />
          {isOnboarding ? "Welcome to VibeTravel" : existingVibe ? "Update Your Vibe" : "Set Your Vibe"}
        </div>
        <h1 className="font-serif text-3xl text-foreground">
          {isOnboarding ? "Let's set up your family profile" : "Tell us about your family"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {isOnboarding
            ? "This takes 2 minutes and makes every recommendation feel tailor-made for your family."
            : "This helps us find attractions that match your unique style."}
        </p>
      </div>

      {/* Steps indicator */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {steps.map((s, i) => (
          <button
            key={s.title}
            onClick={() => setStep(i)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              i === step
                ? "bg-primary text-primary-foreground"
                : i < step
                  ? "bg-primary/10 text-primary"
                  : "bg-secondary text-muted-foreground"
            }`}
          >
            <s.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{s.title}</span>
            <span className="sm:hidden">{i + 1}</span>
          </button>
        ))}
      </div>

      {/* Step content */}
      <div className="rounded-2xl border border-border bg-card p-6 lg:p-8">
        {step === 0 && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground">
                Family Name
              </label>
              <input
                type="text"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder="e.g., The Johnsons"
                className="rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">
                  Kids
                </label>
                <button
                  onClick={addKid}
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add kid
                </button>
              </div>
              <div className="flex flex-col gap-3">
                {kids.map((kid, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <input
                      type="text"
                      value={kid.name}
                      onChange={(e) => updateKid(i, "name", e.target.value)}
                      placeholder="Name"
                      className="flex-1 rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <input
                      type="number"
                      value={kid.age || ""}
                      onChange={(e) =>
                        updateKid(i, "age", parseInt(e.target.value) || 0)
                      }
                      placeholder="Age"
                      min={0}
                      max={18}
                      className="w-20 rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    {kids.length > 1 && (
                      <button
                        onClick={() => removeKid(i)}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                        aria-label="Remove kid"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-6">
            <div>
              <label className="mb-3 block text-sm font-medium text-foreground">
                How does your family travel? (Pick all that fit)
              </label>
              <div className="flex flex-wrap gap-2">
                {travelStyles.map((style) => (
                  <button
                    key={style}
                    onClick={() =>
                      toggleItem(travelStyle, setTravelStyle, style)
                    }
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      travelStyle.includes(style)
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-3 block text-sm font-medium text-foreground">
                Typical trip budget
              </label>
              <div className="flex gap-2">
                {([
                  { value: "free", label: "Free", desc: "Parks, museums, public spaces" },
                  { value: "$", label: "$", desc: "Budget-friendly" },
                  { value: "$$", label: "$$", desc: "Mid-range" },
                  { value: "$$$", label: "$$$", desc: "Premium experiences" },
                  { value: "any", label: "Mix", desc: "Varies by activity" },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setBudgetPreference(opt.value)}
                    className={`flex-1 rounded-xl px-2 py-3 text-sm font-medium transition-colors ${
                      budgetPreference === opt.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {opt.label}
                    <span className="mt-0.5 block text-[10px] font-normal opacity-70 leading-tight">
                      {opt.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-3 block text-sm font-medium text-foreground">
                Dietary needs
              </label>
              <div className="flex flex-wrap gap-2">
                {dietaryOptions.map((d) => (
                  <button
                    key={d}
                    onClick={() => toggleItem(dietary, setDietary, d)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      dietary.includes(d)
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-6">
            <div>
              <label className="mb-3 block text-sm font-medium text-foreground">
                Sensory considerations
              </label>
              <div className="flex flex-wrap gap-2">
                {sensoryOptions.map((s) => (
                  <button
                    key={s}
                    onClick={() =>
                      toggleItem(sensoryNeeds, setSensoryNeeds, s)
                    }
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      sensoryNeeds.includes(s)
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground">
                Mobility notes
              </label>
              <input
                type="text"
                value={mobilityNotes}
                onChange={(e) => setMobilityNotes(e.target.value)}
                placeholder="e.g., We always have a double stroller"
                className="rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="mb-3 block text-sm font-medium text-foreground">
                Travel pace
              </label>
              <div className="flex gap-2">
                {(["slow", "moderate", "fast"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPace(p)}
                    className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium capitalize transition-colors ${
                      pace === p
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {p}
                    <span className="mt-0.5 block text-xs font-normal opacity-70">
                      {p === "slow"
                        ? "1-2 things/day"
                        : p === "moderate"
                          ? "2-3 things/day"
                          : "4+ things/day"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          {step < steps.length - 1 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "Saving..." : isOnboarding ? "Done — Plan My Trip" : "Save My Vibe"}
              <Sparkles className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
    </>
  )
}
