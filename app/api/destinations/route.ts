import { NextRequest, NextResponse } from "next/server"
import { getDashboardDestinationOptions } from "@/lib/dashboard-destinations"

export async function GET(req: NextRequest) {
  const query = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100)
  const options = getDashboardDestinationOptions([], query)
    .slice(0, query ? 8 : 12)
    .map((option) => ({
      label: option.label,
      city: option.city,
      region: option.region,
      imageUrl: option.imageUrl,
      recognized: true,
      recommended: option.recommended,
    }))

  return NextResponse.json(
    { options },
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" } }
  )
}

