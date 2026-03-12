import { createClient } from "@/lib/supabase/server"
import { ProfileView } from "@/components/profile-view"

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let profile = null
  let familyVibe = null

  if (user) {
    const { data: p } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()
    profile = p

    const { data: v } = await supabase
      .from("family_vibes")
      .select("*")
      .eq("user_id", user.id)
      .single()
    familyVibe = v
  }

  return <ProfileView profile={profile} familyVibe={familyVibe} userEmail={user?.email ?? "guest"} />
}
