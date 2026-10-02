import { createClient as createSupabaseClient, type User } from "@supabase/supabase-js"
import { createClient } from "./server"

export async function createRequestClient(request: Request) {
  const authorization = request.headers.get("authorization")
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  const supabase = token
    ? createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        }
      )
    : await createClient()

  const {
    data: { user },
  } = token ? await supabase.auth.getUser(token) : await supabase.auth.getUser()

  return { supabase, user: user as User | null }
}
