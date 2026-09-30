import { AppHeader } from "@/components/app-header"
import { AISidebarWrapper } from "@/components/ai-sidebar-wrapper"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main>{children}</main>
      <AISidebarWrapper />
    </div>
  )
}
