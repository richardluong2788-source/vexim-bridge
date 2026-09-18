import { NextResponse } from "next/server"
import { performUnsubscribe } from "@/lib/notifications/unsubscribe"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * RFC 8058 one-click unsubscribe.
 *
 * Gmail / Yahoo POST `List-Unsubscribe=One-Click` to the URL advertised in
 * the List-Unsubscribe header. Must return 200 on success so the ESP
 * treats the opt-out as confirmed.
 *
 * GET is supported so a rewritten human URL still works; it performs the
 * opt-out then redirects to the branded result page.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const status = await performUnsubscribe(token)
  if (status === "success") {
    return new NextResponse("OK", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  }
  return new NextResponse("Invalid token", { status: 404 })
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  await performUnsubscribe(token)
  const origin = new URL(request.url).origin
  return NextResponse.redirect(new URL(`/unsubscribe/${encodeURIComponent(token)}`, origin), 303)
}
