"use client"

import { useState, useTransition } from "react"
import { Check, FileText, Loader2, MessageSquare, Package, ThumbsUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { markShortlistInterest } from "./actions"
import type { BuyerActionValue } from "./types"

const ACTION_LABEL: Partial<Record<BuyerActionValue, string>> = {
  requested_info: "Request info",
  requested_sample: "Request sample",
  requested_meeting: "Schedule a call",
  interested_no_details: "Interested",
  requested_order_discussion: "Discuss an order",
}

const ACTION_CONFIRMATION: Partial<Record<BuyerActionValue, string>> = {
  requested_info: "We've let your account manager know you'd like more information.",
  requested_sample: "We've let your account manager know you'd like to request a sample.",
  requested_meeting: "We've let your account manager know you'd like to schedule a call.",
  interested_no_details: "We've noted your interest and your account manager will follow up.",
  requested_order_discussion: "We've let your account manager know you'd like to discuss placing an order.",
}

export function InterestButton({
  token,
  shortlistItemId,
  initialAction,
}: {
  token: string
  shortlistItemId: string
  initialAction: BuyerActionValue | null
}) {
  const [action, setAction] = useState<BuyerActionValue | null>(initialAction)
  const [pendingAction, setPendingAction] = useState<BuyerActionValue | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleClick = (value: BuyerActionValue) => {
    setError(null)
    setPendingAction(value)
    startTransition(async () => {
      const result = await markShortlistInterest(token, shortlistItemId, value)
      if (result.ok) {
        setAction(value)
      } else {
        setError(result.error)
      }
      setPendingAction(null)
    })
  }

  const hasResponded = action && action !== "viewed_only"

  if (hasResponded) {
    return (
      <div className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary">
        <Check className="h-3.5 w-3.5 shrink-0" />
        {ACTION_CONFIRMATION[action] ?? "Thanks — your account manager has been notified."}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        <ActionChip
          label={ACTION_LABEL.interested_no_details!}
          icon={ThumbsUp}
          onClick={() => handleClick("interested_no_details")}
          loading={pending && pendingAction === "interested_no_details"}
          disabled={pending}
          primary
        />
        <ActionChip
          label={ACTION_LABEL.requested_info!}
          icon={MessageSquare}
          onClick={() => handleClick("requested_info")}
          loading={pending && pendingAction === "requested_info"}
          disabled={pending}
        />
        <ActionChip
          label={ACTION_LABEL.requested_sample!}
          icon={Package}
          onClick={() => handleClick("requested_sample")}
          loading={pending && pendingAction === "requested_sample"}
          disabled={pending}
        />
        <ActionChip
          label={ACTION_LABEL.requested_meeting!}
          icon={FileText}
          onClick={() => handleClick("requested_meeting")}
          loading={pending && pendingAction === "requested_meeting"}
          disabled={pending}
        />
      </div>
      <button
        type="button"
        onClick={() => handleClick("requested_order_discussion")}
        disabled={pending}
        className="self-start text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50"
      >
        {pending && pendingAction === "requested_order_discussion" ? "Sending..." : "I'd like to discuss placing an order"}
      </button>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  )
}

function ActionChip({
  label,
  icon: Icon,
  onClick,
  loading,
  disabled,
  primary,
}: {
  label: string
  icon: typeof ThumbsUp
  onClick: () => void
  loading: boolean
  disabled: boolean
  primary?: boolean
}) {
  return (
    <Button
      size="sm"
      variant={primary ? "default" : "outline"}
      onClick={onClick}
      disabled={disabled}
      className={cn("gap-1.5 text-xs")}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
      {label}
    </Button>
  )
}
