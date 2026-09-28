import { performUnsubscribe } from "@/lib/notifications/unsubscribe"
import { UnsubscribeResult } from "@/components/settings/unsubscribe-result"
import type { Metadata } from "next"
import { NOINDEX } from "@/lib/seo/alternates"

export const dynamic = "force-dynamic"

// One-click links sit in every recipient's email; indexing them would hand the
// token (and thus the unsubscribe action) to anyone who searched for it.
export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: NOINDEX,
}

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const status = await performUnsubscribe(token)
  return <UnsubscribeResult status={status} />
}
