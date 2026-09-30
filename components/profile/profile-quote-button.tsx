"use client"

import { useState } from "react"
import { MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Locale } from "@/lib/i18n/config"
import { getProfileCopy } from "@/lib/profile/translations"
import { ProfileRequestQuoteDialog } from "./profile-request-quote-dialog"
import type { ClientProfileWithRelations } from "@/lib/supabase/types"

interface ProfileQuoteButtonProps {
  profile: ClientProfileWithRelations
  locale: Locale
  className?: string
  size?: "default" | "lg" | "sm"
  label?: string
}

/** Shared quote CTA, with language-matched text and dialog. */
export function ProfileQuoteButton({
  profile,
  locale,
  className,
  size = "default",
  label,
}: ProfileQuoteButtonProps) {
  const [open, setOpen] = useState(false)
  const copy = getProfileCopy(locale)

  if (profile.enable_request_quote === false) return null

  return (
    <>
      <Button size={size} className={cn(className)} onClick={() => setOpen(true)}>
        <MessageSquare className="w-4 h-4 mr-2" />
        {label ?? copy.cta.requestQuote}
      </Button>
      <ProfileRequestQuoteDialog
        profile={profile}
        open={open}
        onOpenChange={setOpen}
        locale={locale}
      />
    </>
  )
}
