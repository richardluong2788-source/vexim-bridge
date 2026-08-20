"use client"

import { useState, useTransition } from "react"
import { Check, Heart, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { markShortlistInterest } from "./actions"

export function InterestButton({
  token,
  shortlistId,
  initialInterested,
}: {
  token: string
  shortlistId: string
  initialInterested: boolean | null
}) {
  const [interested, setInterested] = useState(initialInterested)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleClick = () => {
    setError(null)
    startTransition(async () => {
      const result = await markShortlistInterest(token, shortlistId, true)
      if (result.ok) {
        setInterested(true)
      } else {
        setError(result.error)
      }
    })
  }

  if (interested) {
    return (
      <Button
        size="sm"
        variant="secondary"
        disabled
        className={cn("gap-1.5 pointer-events-none border border-primary/30 bg-primary/10 text-primary")}
      >
        <Check className="h-3.5 w-3.5" />
        Interested
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <Button size="sm" onClick={handleClick} disabled={pending} className="gap-1.5">
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Heart className="h-3.5 w-3.5" />}
        I&apos;m interested
      </Button>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  )
}
