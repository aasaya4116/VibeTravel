"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  User,
  Mail,
  Sparkles,
  Users,
  Heart,
  Utensils,
  Zap,
  Edit,
  Accessibility,
  LogOut,
} from "lucide-react"
import type { Profile, FamilyVibe } from "@/lib/types"

interface ProfileViewProps {
  profile: Profile | null
  familyVibe: FamilyVibe | null
  userEmail: string
}

export function ProfileView({
  profile,
  familyVibe,
  userEmail,
}: ProfileViewProps) {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-8 lg:py-12">
      <h1 className="mb-8 font-serif text-3xl text-foreground">Profile</h1>

      {/* Account info */}
      <div className="mb-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <User className="h-4 w-4" />
          Account
        </h2>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <span className="text-lg font-medium">
                {(profile?.display_name || "U")[0].toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-medium text-foreground">
                {profile?.display_name || "User"}
              </p>
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                {userEmail}
              </p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </div>

      {/* Family Vibe */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            Family Vibe
          </h2>
          <Link
            href="/profile/vibe"
            className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <Edit className="h-3.5 w-3.5" />
            {familyVibe ? "Edit" : "Set up"}
          </Link>
        </div>

        {familyVibe ? (
          <div className="flex flex-col gap-5">
            {familyVibe.family_name && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">
                  {familyVibe.family_name}
                </span>
              </div>
            )}

            {familyVibe.kids && familyVibe.kids.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Kids
                </p>
                <div className="flex flex-wrap gap-2">
                  {familyVibe.kids.map((kid, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground"
                    >
                      {kid.name}, age {kid.age}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {familyVibe.travel_style && familyVibe.travel_style.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <Heart className="h-3.5 w-3.5" />
                  Travel Style
                </p>
                <div className="flex flex-wrap gap-2">
                  {familyVibe.travel_style.map((s) => (
                    <span
                      key={s}
                      className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm text-primary"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {familyVibe.dietary && familyVibe.dietary.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <Utensils className="h-3.5 w-3.5" />
                  Dietary
                </p>
                <div className="flex flex-wrap gap-2">
                  {familyVibe.dietary.map((d) => (
                    <span
                      key={d}
                      className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Zap className="h-3.5 w-3.5" />
                Pace: <span className="capitalize text-foreground">{familyVibe.pace}</span>
              </span>
              {familyVibe.mobility_notes && (
                <span className="flex items-center gap-1">
                  <Accessibility className="h-3.5 w-3.5" />
                  {familyVibe.mobility_notes}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <Sparkles className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="font-medium text-foreground">No vibe set yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tell us about your family to get personalized recommendations.
            </p>
            <Link
              href="/profile/vibe"
              className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Set Your Vibe
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
