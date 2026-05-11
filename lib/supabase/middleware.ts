import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import type { Database } from "@/lib/supabase/types"

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl

  // CRITICAL: Skip auth middleware entirely for webhook endpoints.
  // Webhooks use their own signature verification (RESEND_SIGNING_SECRET)
  // and cannot authenticate as Supabase users. Returning here prevents
  // any middleware redirect (307) that breaks external service integrations.
  if (pathname.startsWith("/api/webhooks/")) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh the session — IMPORTANT: do not run any redirects before this
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // If user is logged in and visits /auth/login → send to root (root page handles role redirect)
  if (pathname.startsWith("/auth/login") && user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/"
    return NextResponse.redirect(redirectUrl)
  }

  // Protect /admin, /client, and /settings — unauthenticated users go to login.
  // /unsubscribe is intentionally excluded: the email-based token link must
  // work even when the user isn't logged in.
  if (
    (pathname.startsWith("/admin") ||
      pathname.startsWith("/client") ||
      pathname.startsWith("/settings")) &&
    !user
  ) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/auth/login"
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}
