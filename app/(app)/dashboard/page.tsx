import { Suspense } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardContent } from "@/components/dashboard-content"
import { ArticlesSidebar, ArticlesSidebarSkeleton } from "@/components/articles-sidebar"
// Articles powered by Tavily — add TAVILY_API_KEY to .env.local
import type { Trip, FamilyVibe } from "@/lib/types"

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let profile = null
  let trips: Trip[] = []
  let familyVibe: FamilyVibe | null = null

  if (user) {
    const [profileRes, tripsRes, vibeRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("trips").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("family_vibes").select("*").eq("user_id", user.id).single(),
    ])
    profile = profileRes.data
    trips = tripsRes.data ?? []
    familyVibe = vibeRes.data
  }

  // First-time users: no vibe and no trips → guide through onboarding
  if (!familyVibe && trips.length === 0) {
    redirect("/profile/vibe?onboarding=true")
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_340px]">
      {/* Main content */}
      <div className="min-w-0">
        <DashboardContent
          profile={profile}
          trips={trips}
          familyVibe={familyVibe}
        />
      </div>

      {/* Articles sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:border-l lg:border-border lg:px-6 lg:py-8 sticky top-0 max-h-screen overflow-y-auto">
        <Suspense fallback={<ArticlesSidebarSkeleton />}>
          <ArticlesSidebar />
        </Suspense>
      </aside>
    </div>
  )
}
