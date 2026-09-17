import { performUnsubscribe } from "@/lib/notifications/unsubscribe"
import { UnsubscribeResult } from "@/components/settings/unsubscribe-result"

export const dynamic = "force-dynamic"

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const status = await performUnsubscribe(token)
  return <UnsubscribeResult status={status} />
}
