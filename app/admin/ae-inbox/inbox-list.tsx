"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Building2,
  Check,
  Clock,
  Globe,
  Sparkles,
  User,
  X,
  ChevronDown,
  AlertTriangle,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { acceptMatch, rejectMatch } from "@/app/admin/buyers/matching-actions"
import type { Role } from "@/lib/supabase/types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InboxItem {
  id: string
  lead_id: string
  account_manager_id: string
  status: string
  priority: string
  rejection_reason: string | null
  created_at: string
  expires_at: string
  leads: {
    id: string
    company_name: string
    contact_person: string | null
    country: string | null
    industry: string | null
  } | null
  profiles: {
    id: string
    full_name: string | null
    email: string | null
  } | null
  ae_match_scores: {
    id: string
    total_score: number
    product_match_score: number
    industry_match_score: number
    fda_compliance_score: number
    workload_score: number
    win_rate_score: number
    country_match_score: number
    factors: Record<string, unknown>
  } | null
}

interface Client {
  id: string
  full_name: string | null
  company_name: string | null
  fda_expires_at: string | null
}

interface InboxListProps {
  items: InboxItem[]
  clients: Client[]
  locale: "vi" | "en"
  currentRole: Role
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InboxList({
  items,
  clients,
  locale,
  currentRole,
}: InboxListProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [selectedClients, setSelectedClients] = useState<
    Record<string, string>
  >({})

  // Lead Researcher has read-only access to monitor matching outcomes
  // for the buyers they sourced. Claim/accept/reject controls are hidden
  // because LR has no client portfolio to assign buyers to.
  const isReadOnly = currentRole === "lead_researcher"

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Sparkles className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">
          {locale === "vi" ? "Inbox trống" : "Inbox is empty"}
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          {locale === "vi"
            ? "Chưa có buyer nào được AI đề xuất. Khi Lead Researcher thêm buyer mới, hệ thống sẽ tự động match và hiển thị ở đây."
            : "No AI-matched buyers yet. When Lead Researcher adds new buyers, the system will auto-match and show them here."}
        </p>
      </div>
    )
  }

  const handleAccept = (item: InboxItem) => {
    const clientId = selectedClients[item.id]
    if (!clientId) {
      toast.error(
        locale === "vi"
          ? "Vui lòng chọn client trước"
          : "Please select a client first"
      )
      return
    }

    startTransition(async () => {
      const result = await acceptMatch({
        inboxItemId: item.id,
        clientId,
      })

      if (result.ok) {
        toast.success(
          locale === "vi"
            ? "Đã tạo opportunity thành công"
            : "Opportunity created successfully"
        )
        router.refresh()
      } else {
        toast.error(
          locale === "vi" ? `Lỗi: ${result.error}` : `Error: ${result.error}`
        )
      }
    })
  }

  const handleReject = (item: InboxItem) => {
    setSelectedItem(item)
    setRejectReason("")
    setRejectDialogOpen(true)
  }

  const confirmReject = () => {
    if (!selectedItem) return

    startTransition(async () => {
      const result = await rejectMatch({
        inboxItemId: selectedItem.id,
        reason: rejectReason || undefined,
      })

      if (result.ok) {
        toast.success(
          locale === "vi" ? "Đã từ chối đề xuất" : "Match rejected"
        )
        setRejectDialogOpen(false)
        router.refresh()
      } else {
        toast.error(
          locale === "vi" ? `Lỗi: ${result.error}` : `Error: ${result.error}`
        )
      }
    })
  }

  const priorityColors: Record<string, string> = {
    high: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    medium: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    low: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(
      locale === "vi" ? "vi-VN" : "en-US",
      {
        month: "short",
        day: "numeric",
      }
    )
  }

  const daysUntilExpiry = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - Date.now()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  return (
    <>
      <div className="grid gap-4">
        {items.map((item) => {
          const lead = item.leads
          const score = item.ae_match_scores
          const ae = item.profiles
          const daysLeft = daysUntilExpiry(item.expires_at)

          return (
            <Card
              key={item.id}
              className={cn(
                "transition-all",
                pending && "opacity-50 pointer-events-none"
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">
                        {lead?.company_name || "Unknown Buyer"}
                      </h3>
                      <Badge
                        variant="outline"
                        className={cn(priorityColors[item.priority])}
                      >
                        {item.priority === "high"
                          ? locale === "vi"
                            ? "Ưu tiên cao"
                            : "High priority"
                          : item.priority === "medium"
                            ? locale === "vi"
                              ? "Trung bình"
                              : "Medium"
                            : locale === "vi"
                              ? "Thấp"
                              : "Low"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      {lead?.industry && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5" />
                          {lead.industry}
                        </span>
                      )}
                      {lead?.country && (
                        <span className="flex items-center gap-1">
                          <Globe className="h-3.5 w-3.5" />
                          {lead.country}
                        </span>
                      )}
                      {lead?.contact_person && (
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          {lead.contact_person}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {score && (
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="text-2xl font-bold text-primary">
                          {score.total_score.toFixed(0)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {daysLeft <= 2 ? (
                        <span className="text-amber-600 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {daysLeft <= 0
                            ? locale === "vi"
                              ? "Hết hạn"
                              : "Expired"
                            : locale === "vi"
                              ? `${daysLeft} ngày còn lại`
                              : `${daysLeft} days left`}
                        </span>
                      ) : (
                        <span>
                          {locale === "vi"
                            ? `Hết hạn ${formatDate(item.expires_at)}`
                            : `Expires ${formatDate(item.expires_at)}`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Score breakdown */}
                {score && (
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <ChevronDown className="h-4 w-4" />
                      {locale === "vi"
                        ? "Xem chi tiết điểm"
                        : "View score breakdown"}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3">
                      <div className="grid gap-2">
                        <ScoreBar
                          label={
                            locale === "vi" ? "Sản phẩm" : "Product Match"
                          }
                          value={score.product_match_score}
                          weight={25}
                        />
                        <ScoreBar
                          label={locale === "vi" ? "Ngành hàng" : "Industry"}
                          value={score.industry_match_score}
                          weight={20}
                        />
                        <ScoreBar
                          label={locale === "vi" ? "FDA" : "FDA Compliance"}
                          value={score.fda_compliance_score}
                          weight={10}
                        />
                        <ScoreBar
                          label={locale === "vi" ? "Workload" : "Workload"}
                          value={score.workload_score}
                          weight={20}
                        />
                        <ScoreBar
                          label={locale === "vi" ? "Win Rate" : "Win Rate"}
                          value={score.win_rate_score}
                          weight={20}
                        />
                        <ScoreBar
                          label={locale === "vi" ? "Quốc gia" : "Country"}
                          value={score.country_match_score}
                          weight={5}
                        />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* AE info for admins */}
                {currentRole !== "account_executive" && ae && (
                  <div className="text-sm text-muted-foreground">
                    {locale === "vi" ? "Đề xuất cho: " : "Matched to: "}
                    <span className="font-medium text-foreground">
                      {ae.full_name || ae.email}
                    </span>
                  </div>
                )}

                {/* Actions — hidden for read-only viewers (Lead Researcher) */}
                {isReadOnly ? (
                  <div className="flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>
                      {locale === "vi"
                        ? "Chế độ chỉ xem — chỉ AE được chấp nhận / từ chối đề xuất."
                        : "Read-only — only AEs can accept or reject matches."}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <Select
                      value={selectedClients[item.id] || ""}
                      onValueChange={(v) =>
                        setSelectedClients((prev) => ({ ...prev, [item.id]: v }))
                      }
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue
                          placeholder={
                            locale === "vi" ? "Chọn client..." : "Select client..."
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground text-center">
                            {locale === "vi"
                              ? "Không có client FDA hợp lệ"
                              : "No FDA-valid clients"}
                          </div>
                        ) : (
                          clients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.company_name || client.full_name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>

                    <Button
                      onClick={() => handleAccept(item)}
                      disabled={!selectedClients[item.id] || pending}
                      className="gap-2"
                    >
                      <Check className="h-4 w-4" />
                      {locale === "vi" ? "Chấp nhận" : "Accept"}
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => handleReject(item)}
                      disabled={pending}
                      className="gap-2"
                    >
                      <X className="h-4 w-4" />
                      {locale === "vi" ? "Từ chối" : "Reject"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {locale === "vi" ? "Từ chối đề xuất" : "Reject Match"}
            </DialogTitle>
            <DialogDescription>
              {locale === "vi"
                ? `Bạn có chắc muốn từ chối ${selectedItem?.leads?.company_name}? Lý do sẽ được lưu để cải thiện AI.`
                : `Are you sure you want to reject ${selectedItem?.leads?.company_name}? Your reason will help improve AI matching.`}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder={
              locale === "vi"
                ? "Lý do từ chối (tùy chọn)..."
                : "Reason for rejection (optional)..."
            }
            rows={3}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
            >
              {locale === "vi" ? "Hủy" : "Cancel"}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={pending}
            >
              {locale === "vi" ? "Xác nhận từ chối" : "Confirm Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ---------------------------------------------------------------------------
// Score Bar Component
// ---------------------------------------------------------------------------

function ScoreBar({
  label,
  value,
  weight,
}: {
  label: string
  value: number
  weight: number
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-24 shrink-0">
        {label} ({weight}%)
      </span>
      <Progress value={value} className="h-2 flex-1" />
      <span className="text-xs font-medium w-8 text-right">{value}</span>
    </div>
  )
}
