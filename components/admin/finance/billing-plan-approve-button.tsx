"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { approveBillingPlanAction } from "@/app/admin/finance/billing-plans/actions"

/**
 * Finance-only: approve a draft billing plan (proposed by SR) → active.
 * From this moment the monthly-retainer cron starts billing the client.
 */
export function BillingPlanApproveButton({ planId }: { planId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleApprove() {
    setError(null)
    startTransition(async () => {
      const result = await approveBillingPlanAction(planId)
      if (!result.ok) {
        setError(
          result.error === "active_plan_exists"
            ? "Khách hàng này đã có gói đang active. Hãy tạm dừng gói cũ trước."
            : "Không duyệt được. Vui lòng thử lại.",
        )
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        className="gap-1.5"
        onClick={handleApprove}
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Check className="h-3.5 w-3.5" />
        )}
        Duyệt &amp; kích hoạt
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
