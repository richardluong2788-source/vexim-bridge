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
 * Nut CTA "Yeu cau bao gia" dung chung cho header card va CTA section,
 * de tranh lap logic mo dialog o nhieu noi.
 */
export function ProfileQuoteButton({
  profile,
  className,
  size = "default",
  label = "Yêu cầu báo giá qua Vexim",
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
