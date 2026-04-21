import { createClient } from "@supabase/supabase-js"
import type { Database } from "./types"

/**
 * Service-role Supabase client. Bypasses RLS.
 *
 * ONLY use from trusted server-only code:
 *   - Cron jobs
 *   - Admin API routes that have already verified the caller's role
 *
 * NEVER expose the returned client to the browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase service role env vars (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)",
    )
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
