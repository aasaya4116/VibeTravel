import { AppState, Platform } from "react-native"
import { createClient } from "@supabase/supabase-js"
import { authStorage } from "./storage"

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "VibeTravel mobile is missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy mobile/.env.example to mobile/.env.local."
  )
}

export const supabase = createClient(
  supabaseUrl ?? "https://configuration-required.supabase.co",
  supabaseAnonKey ?? "configuration-required",
  {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
)

if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh()
    else supabase.auth.stopAutoRefresh()
  })
}

export function hasSupabaseConfiguration() {
  return Boolean(supabaseUrl && supabaseAnonKey)
}
