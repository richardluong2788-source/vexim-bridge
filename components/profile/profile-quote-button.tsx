"use client"

import { useState } from "react"
import { MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ProfileRequestQuoteDialog } from "./profile-request-quote-dialog"
import type { ClientProfileWithRelations } from "@/lib/supabase/types"

interface ProfileQuoteButtonProps {
  profile: ClientProfileWithRelations
  className?: string
  size?: "default" | "lg" | "sm"
  label?: string
}

/**
 * Shared "Request Quote" CTA button for the header card and CTA section,
 * avoiding duplicate dialog-open logic in multiple places.
 */
export function ProfileQuoteButton({
  profile,
  className,
  size = "default",
  label = "Request Quote",
}: ProfileQuoteButtonProps) {
  const [open, setOpen] = useState(false)

  if (profile.enable_request_quote === false) return null

  return (
    <>
      <Button size={size} className={cn(className)} onClick={() => setOpen(true)}>
        <MessageSquare className="w-4 h-4 mr-2" />
        {label}
      </Button>
      <ProfileRequestQuoteDialog profile={profile} open={open} onOpenChange={setOpen} />
    </>
  )
}
