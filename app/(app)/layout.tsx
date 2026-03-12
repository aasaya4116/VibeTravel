import { createClient } from "@/lib/supabase/server"
import { AppHeader } from "@/components/app-header"
import { AISidebarWrapper } from "@/components/ai-sidebar-wrapper"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let familyVibe = null

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { data } = await supabase
        .from("family_vibes")
        .select("*")
        .eq("user_id", user.id)
        .single()
      familyVibe = data
    }
  } catch {
    // Allow unauthenticated access for exploration
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main>{children}</main>
      <AISidebarWrapper familyVibe={familyVibe} />
    </div>
  )
}
