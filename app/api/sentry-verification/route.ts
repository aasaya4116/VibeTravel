import { captureUnexpectedApiError } from "@/lib/sentry-server"

export async function POST() {
  captureUnexpectedApiError(
    new Error("VibeTravel API Sentry verification"),
    {
      route: "/api/sentry-verification",
      operation: "verify_production_reporting",
    }
  )

  return Response.json(
    { error: "Intentional Sentry verification event." },
    { status: 500 }
  )
}
