import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Null when the env vars are absent, the app then runs local-only, with the
 * event log living entirely in IndexedDB on the device. Everything works; there
 * is simply no mirror, which the sync badge says out loud rather than hiding.
 *
 * The anon key is public by design. Supabase's security model is Row Level
 * Security, not key secrecy, and the append-only trigger on rtr_event holds
 * regardless of who is connecting.
 */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null

export const hasSupabase = !!supabase

// ── Access code ─────────────────────────────────────────────
// Same model as the earlier engine: one shared secret typed once, no accounts,
// no auth flow for a 15-year-old to get stuck in. Every row carries it, and a
// parent seeing the same log means typing the same code.

const ACCESS_CODE_KEY = 'rtr_access_code'

export function getAccessCode(): string | null {
  return localStorage.getItem(ACCESS_CODE_KEY)
}

export function setAccessCode(code: string): void {
  localStorage.setItem(ACCESS_CODE_KEY, code.trim().toLowerCase())
}
