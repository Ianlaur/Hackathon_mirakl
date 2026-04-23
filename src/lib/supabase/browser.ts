'use client'

// MIRA — browser-side Supabase client factory (singleton).
// Used to subscribe to Realtime on decision_ledger so the dashboard updates live.
// Requires NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY in env.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cachedClient: SupabaseClient | null = null

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null

  cachedClient = createClient(url, anonKey, {
    realtime: { params: { eventsPerSecond: 10 } },
  })
  return cachedClient
}
