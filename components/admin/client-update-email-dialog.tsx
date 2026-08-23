"use client"

import { useState, useTransition, useEffect } from "react"
import { toast } from "sonner"
import { Send, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldLabel } from "@/components/ui/field"
import { sendClientUpdateEmail } from "@/app/admin/opportunities/client-email-actions"
import { maskBuyer, toLeadInput } from "@/lib/protection/mask"
import type { OpportunityWithClient } from "@/lib/supabase/types"
import type { Stage } from "@/lib/supabase/types"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  opportunity: OpportunityWithClient
}

/**
 * Dialog for AE to send a status update email to the client (Vietnamese exporter).
 * Auto-fills content from the opportunity's status fields (next_step, client_action_required).
 */
export function ClientUpdateEmailDialog({ open, onOpenChange, opportunity }: Props) {
  const [pending, startTransition] = useTransition()

  // Form state
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")

  // Auto-fill when dialog opens
  useEffect(() => {
    if (open && opportunity) {
      // Apply protection masking based on pipeline stage
      const lead = opportunity.leads
      const stage = (opportunity.stage ?? "new") as Stage
      const maskedBuyer = lead
        ? maskBuyer(
            toLeadInput({ ...lead, company_name: lead.company_name ?? "Buyer" }),
            stage,
            opportunity.buyer_code
          )
        : null

      // Use masked display name (code at early stages, real name at later stages)
      const buyerDisplayName = maskedBuyer?.displayName ?? opportunity.buyer_code ?? "Buyer"
      const clientName = opportunity.profiles?.company_name ?? "Client"

      // Build subject
      setSubject(`Cập nhật tiến độ: ${buyerDisplayName}`)

      // Build body from status fields
      const parts: string[] = []
      parts.push(`Kính gửi ${clientName},`)
      parts.push("")
      parts.push(`Đây là cập nhật mới nhất về cơ hội với ${buyerDisplayName}:`)
      parts.push("")

      if (opportunity.next_step) {
        parts.push(`📋 Bước tiếp theo đội ngũ đang triển khai:`)
        parts.push(opportunity.next_step)
        parts.push("")
      }

      if (opportunity.client_action_required) {
        parts.push(`⚡ Cần bạn chuẩn bị:`)
        parts.push(opportunity.client_action_required)
        parts.push("")
      }

      if (opportunity.target_close_date) {
        parts.push(`📅 Ngày dự kiến chốt: ${opportunity.target_close_date}`)
        parts.push("")
      }

      parts.push("Vui lòng liên hệ nếu cần thêm thông tin.")
      parts.push("")
      parts.push("Trân trọng,")
      parts.push("Đội ngũ Vexim Trade")

      setBody(parts.join("\n"))
    }
  }, [open, opportunity])

  const clientEmail = opportunity.profiles?.email

  // Compute masked buyer name for display in dialog (outside useEffect for JSX use)
  const leadForUI = opportunity.leads
  const stageForUI = (opportunity.stage ?? "new") as Stage
  const maskedBuyerForDisplay = leadForUI
    ? maskBuyer(
        toLeadInput({ ...leadForUI, company_name: leadForUI.company_name ?? "Buyer" }),
        stageForUI,
        opportunity.buyer_code
      )
    : null
  const buyerDisplayNameForUI = maskedBuyerForDisplay?.displayName ?? opportunity.buyer_code ?? "buyer"

  async function handleSend() {
    if (!clientEmail) {
      toast.error("Client không có email")
      return
    }

    if (!subject.trim() || !body.trim()) {
      toast.error("Vui lòng nhập tiêu đề và nội dung")
      return
    }

    startTransition(async () => {
      const result = await sendClientUpdateEmail({
        opportunityId: opportunity.id,
        clientId: opportunity.client_id,
        to: clientEmail,
        subject: subject.trim(),
        body: body.trim(),
      })

      if (result.ok) {
        toast.success("Đã gửi email cho client")
        onOpenChange(false)
      } else {
        toast.error(result.error ?? "Gửi email thất bại")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] grid-rows-[auto_1fr_auto] gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Gửi cập nhật cho Client</DialogTitle>
          <DialogDescription>
            Thông báo cho {opportunity.profiles?.company_name ?? "client"} về tiến độ cơ hội với{" "}
            {buyerDisplayNameForUI}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto px-6 py-4">
          {/* To field (read-only) */}
          <Field>
            <FieldLabel>Gửi đến</FieldLabel>
            <Input
              value={clientEmail ?? "Không có email"}
              disabled
              className="bg-muted"
            />
          </Field>

          {/* Subject */}
          <Field>
            <FieldLabel>Tiêu đề</FieldLabel>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Tiêu đề email..."
            />
          </Field>

          {/* Body */}
          <Field>
            <FieldLabel>Nội dung</FieldLabel>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Nội dung email..."
              rows={12}
              className="resize-none font-mono text-sm"
            />
          </Field>
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Hủy
          </Button>
          <Button onClick={handleSend} disabled={pending || !clientEmail}>
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang gửi...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Gửi email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
