import { updateSession } from '@/lib/supabase/proxy'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  try {
    return await updateSession(request)
  } catch {
    // If Supabase auth fails, allow the request through rather than crashing
    return NextResponse.next({ request })
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * - public discovery/media APIs, or media handlers that authenticate once themselves
     */
    '/((?!_next/static|_next/image|favicon.ico|api/(?:search|destinations|destination-photo|place-photo|geocode|vlogs)(?:/|$)|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
