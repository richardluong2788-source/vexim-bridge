import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import type { Database } from "@/lib/supabase/types"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY!,
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

  const { pathname } = request.nextUrl

  // If user is logged in and visits /auth/login → send to root (root page handles role redirect)
  if (pathname.startsWith("/auth/login") && user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/"
    return NextResponse.redirect(redirectUrl)
  }

  // Protect /admin, /client, and /settings — unauthenticated users go to login.
  // /unsubscribe and /client-intake are intentionally excluded: these are
  // token-based public links that must work even when the user isn't logged in.
  // Note: match "/client" and "/client/" (not just startsWith) so "/client-intake"
  // isn't accidentally treated as a protected /client route.
  if (
    (pathname.startsWith("/admin") ||
      pathname === "/client" ||
      pathname.startsWith("/client/") ||
      pathname.startsWith("/settings")) &&
    !user
  ) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/auth/login"
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}
