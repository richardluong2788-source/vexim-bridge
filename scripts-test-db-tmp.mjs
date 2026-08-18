import { createClient } from "@supabase/supabase-js"

console.log("[v0] NEXT_PUBLIC_SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "SET" : "MISSING")
console.log("[v0] NEXT_PUBLIC_SUPABASE_ANON_KEY:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "SET" : "MISSING")
console.log("[v0] SUPABASE_ANON_KEY:", process.env.SUPABASE_ANON_KEY ? "SET" : "MISSING")
console.log("[v0] SUPABASE_PUBLISHABLE_KEY:", process.env.SUPABASE_PUBLISHABLE_KEY ? "SET" : "MISSING")
console.log("[v0] SUPABASE_SERVICE_ROLE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "SET" : "MISSING")
console.log("[v0] SUPABASE_SECRET_KEY:", process.env.SUPABASE_SECRET_KEY ? "SET" : "MISSING")

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY

if (!url || !key) {
  console.log("[v0] Missing url or key, cannot test connection")
  process.exit(1)
}

const supabase = createClient(url, key)

const { data, error } = await supabase
  .from("pg_stat_user_tables")
  .select("*")
  .limit(1)

if (error) {
  console.log("[v0] Query via table failed (expected, trying rpc):", error.message)
}

// Try a simple raw query using PostgREST schema listing
const { data: authTest, error: authError } = await supabase.auth.getSession()
console.log("[v0] Auth getSession error:", authError ? authError.message : "none")

process.exit(0)
