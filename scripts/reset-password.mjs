import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error("[v0] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const userId = "39017b0e-50d8-4e7d-9197-f1d8f6aba107"
const newPassword = "Anthai@88"

const { data, error } = await supabase.auth.admin.updateUserById(userId, {
  password: newPassword,
})

if (error) {
  console.error("[v0] Update failed:", error.message)
  process.exit(1)
}

console.log("[v0] Password updated successfully for user:", data.user.email)
