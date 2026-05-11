import { type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    // Exclude static files, images, and webhook routes from middleware
    // Webhooks must bypass auth middleware entirely — they use their own
    // signature verification (RESEND_SIGNING_SECRET) and are called by
    // external services that cannot authenticate as Supabase users.
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
