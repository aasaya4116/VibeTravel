import { createClient } from "@/lib/supabase/server"
import { TripsOverview } from "@/components/trips-overview"
import type { Trip } from "@/lib/types"

export default async function TripsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let trips: Trip[] = []

  if (user) {
    const { data: t } = await supabase
      .from("trips")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
    trips = t ?? []
  }

  return <TripsOverview trips={trips} isLoggedIn={!!user} />
}
