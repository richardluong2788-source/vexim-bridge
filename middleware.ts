import { type NextRequest, NextResponse } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"
import { DEFAULT_LOCALE } from "@/lib/i18n/config"
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_HEADER,
  isPublicPath,
  splitLocalePrefix,
} from "@/lib/i18n/routing"

export async function middleware(request: NextRequest) {
  // RFC 8058 one-click: Gmail POSTs to the List-Unsubscribe URL. That URL
  // is advertised as /unsubscribe/[token] (human page). Next cannot host
  // route.ts next to page.tsx, so rewrite the POST onto the API handler.
  if (request.method === "POST") {
    const match = request.nextUrl.pathname.match(/^\/unsubscribe\/([^/]+)\/?$/)
    if (match) {
      const url = request.nextUrl.clone()
      url.pathname = `/api/unsubscribe/${match[1]}`
      return NextResponse.rewrite(url)
    }
  }

  const { locale, pathname } = splitLocalePrefix(request.nextUrl.pathname)

  // The locale header is ours to set. A value sent by the client must never
  // survive, or a caller could pin its own locale — and therefore its own
  // canonical URL — on any page.
  const forwarded = new Headers(request.headers)
  forwarded.delete(LOCALE_HEADER)
  if (locale) forwarded.set(LOCALE_HEADER, locale)

  // `/vi/admin/...` has no route, and leaving it to 404 naturally would also
  // hide it from the /admin auth rule below. Reject it here so a locale prefix
  // can never widen what the public rules allow.
  if (locale && !isPublicPath(pathname)) {
    return new NextResponse(null, { status: 404 })
  }

  if (locale && locale !== DEFAULT_LOCALE) {
    // /vi/<public path> -> the unprefixed route, rendered in Vietnamese. The
    // cookie is synced too, so the logged-in app (which has no prefix) keeps
    // showing the language the visitor picked on the marketing site.
    const url = request.nextUrl.clone()
    url.pathname = pathname
    const response = NextResponse.rewrite(url, { request: { headers: forwarded } })
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: LOCALE_COOKIE_MAX_AGE,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })
    return response
  }

  if (locale === DEFAULT_LOCALE) {
    // /en/<path> is the same document as /<path> — redirect instead of serving
    // two URLs for one page. Temporary (307) on purpose while the public URL
    // layout is still moving; promote to 308 once the locale tree is settled.
    const url = request.nextUrl.clone()
    url.pathname = pathname
    return NextResponse.redirect(url, 307)
  }

  // Public surfaces (catalog, supplier profiles, share/shortlist/invoice tokens,
  // legal, the landing page) render the same thing for everyone: an anonymous
  // crawl and a logged-in AE. Skipping updateSession here removes a
  // `auth.getUser()` round-trip per page view — and every one of those pages
  // that needs a session (currently only the landing page's role redirect)
  // resolves it itself, refreshing the token on the way.
  if (isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next({ request: { headers: forwarded } })
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Image files (.svg, .png, .jpg, etc.)
     * - /api/* (all API routes - webhooks, cron, etc.) - MUST be first in negative lookahead
     */
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
