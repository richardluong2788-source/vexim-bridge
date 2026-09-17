import { type NextRequest, NextResponse } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

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
