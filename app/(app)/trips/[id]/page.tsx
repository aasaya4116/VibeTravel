import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { TripDetail } from "@/components/trip-detail"
import { ArticlesSidebar, ArticlesSidebarSkeleton } from "@/components/articles-sidebar"
import { getWikipediaImage } from "@/lib/wikipedia-image"
import { buildTripSummary } from "@/lib/trip-summary"
import type { TripReadinessState } from "@/lib/types"

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) notFound()

  const [tripRes, savedRes, vibeRes, readinessRes] = await Promise.all([
    supabase.from("trips").select("*").eq("id", id).eq("user_id", user.id).single(),
    supabase.from("saved_attractions").select("*").eq("user_id", user.id).eq("trip_id", id),
    supabase.from("family_vibes").select("*").eq("user_id", user.id).single(),
    supabase
      .from("trip_readiness")
      .select("currency, budget_target, bookings, checklist")
      .eq("trip_id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
  ])

  if (!tripRes.data) notFound()

  const trip = tripRes.data
  const familyVibe = vibeRes.data

  // Keep the page fast: the summary is derived locally while only the cached
  // destination image may require an external lookup.
  const tripSummary = buildTripSummary(trip, familyVibe)
  const bannerImage = await getWikipediaImage(trip.destination)

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_340px]">
      <div className="min-w-0">
        <TripDetail
          trip={trip}
          savedAttractions={savedRes.data ?? []}
          bannerImage={bannerImage}
          tripSummary={tripSummary}
          initialReadiness={(readinessRes.data as TripReadinessState | null) ?? null}
          familyVibe={familyVibe}
        />
      </div>

      <aside className="hidden lg:flex lg:flex-col lg:border-l lg:border-border lg:px-6 lg:py-8 sticky top-0 max-h-screen overflow-y-auto">
        <Suspense fallback={<ArticlesSidebarSkeleton />}>
          <ArticlesSidebar destination={trip.destination} />
        </Suspense>
      </aside>
    </div>
  )
}
