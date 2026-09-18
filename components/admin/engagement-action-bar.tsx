"use client"

/**
 * Engagement action bar — one place that knows what an AE can DO with a
 * pre-opportunity buyer, rendered by both surfaces that show a buyer in flight:
 *
 *   1. the AE inbox card (/admin/engagements) — `EngagementStageActions` for
 *      the stage-driven buttons, `EngagementAdminActions` for the header row;
 *   2. the buyer profile's "Phân tích" tab (/admin/buyers/[id]) —
 *      `BuyerEngagementBar`, which shows the stage, how long the buyer has been
 *      sitting in it, a deep link to the next action, and the same admin
 *      actions in a compact "Khác" menu.
 *
 * Which buttons a stage offers is decided by lib/buyers/engagement-stages.ts, so
 * the two screens cannot drift apart.
 *
 * DESIGN NOTE — why the profile does not re-implement "Soạn email mở đầu"
 * ------------------------------------------------------------------------
 * The stage dialogs (requirement email, requirements form, shortlist builder,
 * convert) are large and tightly coupled to the inbox: they read the client
 * list, the AI email generator, the sharing link state. Duplicating them onto
 * the profile would mean shipping a second copy of that machinery. The profile
 * therefore offers the stage's next step as a deep link into the inbox
 * (`/admin/engagements?focus=<id>`, which expands and highlights the card) and
 * keeps the actions that ARE self-contained — transfer / return / drop — as
 * real buttons. The inbox keeps every button exactly where the AE expects it.
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeftRight,
  ArrowRight,
  ChevronDown,
  ClipboardList,
  Clock,
  Inbox,
  Link2,
  Loader2,
  Mail,
  RotateCw,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  dropEngagement,
  listTransferCandidateAEs,
  transferEngagement,
  type TransferCandidateAE,
} from "@/app/admin/ae-inbox/engagement-actions"
import { returnBuyerToInbox } from "@/app/admin/buyers/assignment-actions"
import {
  getPrimaryStageAction,
  getStageActions,
  STAGE_LABELS,
  stageActionContextFromEngagement,
  type ShortlistVersionLike,
  type StageActionKey,
} from "@/lib/buyers/engagement-stages"

/**
 * Everything the bar needs about an engagement. Structurally satisfied by the
 * inbox's `Engagement` rows (they carry more fields) so no adapter is needed.
 */
export interface EngagementActionTarget {
  id: string
  account_manager_id: string
  stage: string
  updated_at?: string | null
  leads?: { company_name?: string | null } | null
  buyer_engagement_shortlist_versions?: ShortlistVersionLike[] | null
}

/** Icons live here, next to the UI, so the stage map itself stays plain data. */
const STAGE_ACTION_ICONS: Record<StageActionKey, LucideIcon> = {
  draft_opening_email: Mail,
  record_requirements_offline: ClipboardList,
  record_requirements: ClipboardList,
  resend_email: RotateCw,
  pick_suppliers: Sparkles,
  approve_shortlist: Link2,
  new_shortlist_version: Sparkles,
  convert_to_opportunity: ArrowRight,
}

// ---------------------------------------------------------------------------
// Stage actions — the buttons that move the pipeline forward
// ---------------------------------------------------------------------------

/**
 * Renders the buttons this stage offers, in order. The caller decides what each
 * key does (the inbox opens the matching dialog); nothing about the stage logic
 * lives in the caller.
 */
export function EngagementStageActions({
  engagement,
  locale,
  onAction,
}: {
  engagement: EngagementActionTarget
  locale: "vi" | "en"
  onAction: (key: StageActionKey) => void
}) {
  const actions = getStageActions(
    engagement.stage,
    stageActionContextFromEngagement(engagement),
  )

  if (actions.length === 0) return null

  return (
    <>
      {actions.map((action) => {
        const Icon = STAGE_ACTION_ICONS[action.key]
        return (
          <Button
            key={action.key}
            size="sm"
            variant={action.variant}
            className="gap-2"
            onClick={() => onAction(action.key)}
          >
            <Icon className="h-4 w-4" />
            {locale === "vi" ? action.labelVi : action.labelEn}
          </Button>
        )
      })}
    </>
  )
}

// ---------------------------------------------------------------------------
// Administrative actions — transfer / return to shared inbox / drop
//
// Stage-independent: they apply to any open engagement, which is why they live
// in the card header (inbox) and in the profile's "Khác" menu. Each one owns its
// dialog, so callers never juggle three pieces of dialog state.
// ---------------------------------------------------------------------------

export function EngagementAdminActions({
  engagement,
  locale,
  layout = "inline",
  onDone,
}: {
  engagement: EngagementActionTarget
  locale: "vi" | "en"
  /** "inline" = the inbox header row of ghost buttons; "menu" = a "Khác"
   *  dropdown, for surfaces where three more buttons would crowd the layout. */
  layout?: "inline" | "menu"
  /** Called after a successful action, in addition to router.refresh(). */
  onDone?: () => void
}) {
  const router = useRouter()
  const [transferOpen, setTransferOpen] = useState(false)
  const [returnOpen, setReturnOpen] = useState(false)
  const [dropOpen, setDropOpen] = useState(false)

  const t = (vi: string, en: string) => (locale === "vi" ? vi : en)

  const finish = () => {
    setTransferOpen(false)
    setReturnOpen(false)
    setDropOpen(false)
    // Re-render the current route so the engagement's new stage/owner shows up
    // wherever this bar is mounted.
    router.refresh()
    onDone?.()
  }

  const items = [
    {
      key: "transfer",
      icon: ArrowLeftRight,
      label: t("Chuyển buyer", "Transfer"),
      destructive: false,
      open: () => setTransferOpen(true),
    },
    {
      key: "return",
      icon: Inbox,
      label: t("Trả về inbox", "Return"),
      title: t(
        "Trả buyer về hộp thư chung để AE khác nhận",
        "Return this buyer to the shared inbox for another AE to claim",
      ),
      destructive: false,
      open: () => setReturnOpen(true),
    },
    {
      key: "drop",
      icon: X,
      label: t("Hủy buyer", "Drop"),
      destructive: true,
      open: () => setDropOpen(true),
    },
  ] as const

  return (
    <>
      {layout === "inline" ? (
        <>
          {items.map((item) => {
            const Icon = item.icon
            return (
              <Button
                key={item.key}
                type="button"
                variant="ghost"
                size="sm"
                className={
                  item.destructive
                    ? "gap-1 text-muted-foreground hover:text-destructive"
                    : "gap-1 text-muted-foreground hover:text-foreground"
                }
                title={"title" in item ? item.title : undefined}
                onClick={item.open}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Button>
            )
          })}
        </>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="gap-1">
              {t("Khác", "More")}
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {items.map((item) => {
              const Icon = item.icon
              return (
                <DropdownMenuItem
                  key={item.key}
                  variant={item.destructive ? "destructive" : "default"}
                  onSelect={item.open}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {transferOpen && (
        <TransferEngagementDialog
          engagement={engagement}
          locale={locale}
          onClose={() => setTransferOpen(false)}
          onTransferred={finish}
        />
      )}

      {returnOpen && (
        <ReturnToInboxDialog
          engagement={engagement}
          locale={locale}
          onClose={() => setReturnOpen(false)}
          onReturned={finish}
        />
      )}

      {dropOpen && (
        <DropEngagementDialog
          engagement={engagement}
          locale={locale}
          onClose={() => setDropOpen(false)}
          onDropped={finish}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Buyer profile bar — stage + next step + admin menu, at the top of "Phân tích"
// ---------------------------------------------------------------------------

/**
 * Compact bar shown on the buyer profile. Turns the profile from a dead end
 * ("here is the analysis — now go find the buyer in the inbox") into "here is
 * where this buyer is, and here is the next thing to do".
 *
 * Only rendered for people who can actually act on the engagement (its owning
 * AE, or an admin) — the deep link would otherwise land on an inbox that does
 * not contain this buyer.
 */
export function BuyerEngagementBar({
  engagement,
  buyerId,
  companyName,
  locale,
}: {
  engagement: EngagementActionTarget
  buyerId: string
  /** Buyer company name, for the dialogs' copy (may be missing on old rows). */
  companyName: string | null
  locale: "vi" | "en"
}) {
  const t = (vi: string, en: string) => (locale === "vi" ? vi : en)
  const context = stageActionContextFromEngagement(engagement)
  const nextAction = getPrimaryStageAction(engagement.stage, context)
  const stageInfo = STAGE_LABELS[engagement.stage]

  // Same computation as the inbox card, so "12 ngày ở giai đoạn này" means the
  // same thing on both screens.
  const daysInStage = engagement.updated_at
    ? Math.floor((Date.now() - new Date(engagement.updated_at).getTime()) / (24 * 60 * 60 * 1000))
    : 0

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/30 p-3">
      <Badge variant="outline" className="text-xs">
        {stageInfo ? (locale === "vi" ? stageInfo.vi : stageInfo.en) : engagement.stage}
      </Badge>

      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        {daysInStage <= 0
          ? t("Mới hôm nay", "Started today")
          : t(
              `${daysInStage} ngày ở giai đoạn này`,
              `${daysInStage} day${daysInStage === 1 ? "" : "s"} in this stage`,
            )}
      </span>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {/* Deep link, not a duplicate dialog: the stage dialogs (email, form,
            shortlist, convert) live with the inbox card that feeds them. The
            `focus` param expands the card and rings it, so this is one click
            into the exact action rather than a hunt. */}
        <Button asChild size="sm" variant={nextAction ? "default" : "outline"} className="gap-2">
          <Link href={`/admin/engagements?focus=${engagement.id}`}>
            {nextAction
              ? t(
                  `Việc tiếp theo: ${nextAction.labelVi}`,
                  `Next: ${nextAction.labelEn}`,
                )
              : t("Mở trong Đang xử lý", "Open in In progress")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>

        <EngagementAdminActions
          engagement={{ ...engagement, leads: { company_name: companyName } }}
          locale={locale}
          layout="menu"
        />
      </div>

      {/* Anchors the admin menu to this buyer for screen readers. */}
      <span className="sr-only">
        {t(
          `Hành động cho buyer ${companyName ?? buyerId}`,
          `Actions for buyer ${companyName ?? buyerId}`,
        )}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

function DropEngagementDialog({
  engagement,
  locale,
  onClose,
  onDropped,
}: {
  engagement: EngagementActionTarget
  locale: "vi" | "en"
  onClose: () => void
  onDropped: () => void
}) {
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  const t = (vi: string, en: string) => (locale === "vi" ? vi : en)

  const handleDrop = async () => {
    setSaving(true)
    const result = await dropEngagement(engagement.id, reason)
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(t("Đã hủy buyer này", "Buyer dropped"))
    onDropped()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Hủy buyer này?", "Drop this buyer?")}</DialogTitle>
          <DialogDescription>
            {t(
              `Buyer ${engagement.leads?.company_name} sẽ được đưa ra khỏi danh sách đang xử lý.`,
              `${engagement.leads?.company_name} will be removed from your in-progress list.`,
            )}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("Lý do (tùy chọn)...", "Reason (optional)...")}
          rows={3}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("Không hủy", "Keep it")}
          </Button>
          <Button variant="destructive" onClick={handleDrop} disabled={saving}>
            {t("Xác nhận hủy", "Confirm drop")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Transfer the engagement to another AE — covers the case where LR routed the
 * buyer by industry match, but the buyer's actual product ask doesn't fit any
 * client this AE manages.
 */
function TransferEngagementDialog({
  engagement,
  locale,
  onClose,
  onTransferred,
}: {
  engagement: EngagementActionTarget
  locale: "vi" | "en"
  onClose: () => void
  onTransferred: () => void
}) {
  const [candidates, setCandidates] = useState<TransferCandidateAE[] | null>(null)
  const [loadingCandidates, setLoadingCandidates] = useState(true)
  const [targetId, setTargetId] = useState<string>("")
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  const t = (vi: string, en: string) => (locale === "vi" ? vi : en)

  useEffect(() => {
    let active = true
    setLoadingCandidates(true)
    listTransferCandidateAEs(engagement.account_manager_id).then((result) => {
      if (!active) return
      setCandidates(result.ok ? result.data : [])
      setLoadingCandidates(false)
    })
    return () => {
      active = false
    }
  }, [engagement.account_manager_id])

  const handleTransfer = async () => {
    if (!targetId) {
      toast.error(t("Vui lòng chọn AE nhận buyer", "Please choose a receiving AE"))
      return
    }
    if (!reason.trim()) {
      toast.error(t("Vui lòng nhập lý do chuyển", "Please enter a transfer reason"))
      return
    }
    setSaving(true)
    const result = await transferEngagement(engagement.id, targetId, reason)
    setSaving(false)
    if (!result.ok) {
      const transferErrors: Record<string, string> = {
        ae_at_capacity: t(
          "AE nhận đã đạt giới hạn buyer đang xử lý",
          "The receiving AE has reached their active-buyer cap",
        ),
        not_your_engagement: t("Bạn không sở hữu buyer này", "You don't own this buyer"),
        already_owned_by_target: t("Buyer này đã thuộc về AE được chọn", "This buyer already belongs to the selected AE"),
        target_not_ae: t("Người được chọn không phải AE", "The selected person is not an AE"),
        engagement_already_closed: t("Buyer đã đóng", "This buyer is already closed"),
      }
      toast.error(transferErrors[result.error] ?? result.error)
      return
    }
    toast.success(t("Đã chuyển buyer cho AE khác", "Buyer transferred"))
    onTransferred()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Chuyển buyer cho AE khác", "Transfer buyer to another AE")}</DialogTitle>
          <DialogDescription>
            {t(
              `Dùng khi buyer ${engagement.leads?.company_name ?? ""} hỏi sản phẩm không khớp với client bạn đang quản lý. Buyer sẽ được gán cho AE khác, kèm lý do để AE đó nắm bối cảnh.`,
              `Use this when ${engagement.leads?.company_name ?? "this buyer"} is asking for a product none of your clients cover. The buyer moves to another AE, along with the reason for context.`,
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("Chuyển cho", "Transfer to")}</Label>
            <Select value={targetId} onValueChange={setTargetId} disabled={loadingCandidates}>
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    loadingCandidates
                      ? t("Đang tải danh sách AE...", "Loading AEs...")
                      : t("Chọn AE nhận buyer", "Choose a receiving AE")
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {(candidates ?? []).map((ae) => (
                  <SelectItem key={ae.id} value={ae.id}>
                    {ae.fullName || ae.companyName || ae.id}
                    {" — "}
                    {t(
                      `${ae.activeEngagementCount} buyer đang xử lý`,
                      `${ae.activeEngagementCount} in progress`,
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t("Lý do chuyển", "Transfer reason")}</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t(
                "Ví dụ: Buyer hỏi sản phẩm khác ngành với client tôi đang quản lý...",
                "E.g. Buyer is asking for a product outside my clients' category...",
              )}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("Hủy", "Cancel")}
          </Button>
          <Button onClick={handleTransfer} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />}
            {t("Chuyển buyer", "Transfer buyer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Return a claimed buyer to the shared inbox — the AE cannot work this buyer
 * (wrong industry / overload) and releases it so any AE can claim it again,
 * instead of just dropping it into a dead end.
 */
function ReturnToInboxDialog({
  engagement,
  locale,
  onClose,
  onReturned,
}: {
  engagement: EngagementActionTarget
  locale: "vi" | "en"
  onClose: () => void
  onReturned: () => void
}) {
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  const t = (vi: string, en: string) => (locale === "vi" ? vi : en)

  const handleReturn = async () => {
    if (!reason.trim()) {
      toast.error(t("Vui lòng nhập lý do trả buyer", "Please enter a reason"))
      return
    }
    setSaving(true)
    const result = await returnBuyerToInbox({
      engagementId: engagement.id,
      reason,
    })
    setSaving(false)
    if (!result.ok) {
      const copy: Record<string, string> = {
        not_your_engagement: t("Bạn không sở hữu buyer này", "You don't own this buyer"),
        engagement_already_closed: t("Buyer đã đóng", "This buyer is already closed"),
        reason_required: t("Vui lòng nhập lý do", "Reason is required"),
      }
      toast.error(copy[result.error] ?? result.error)
      return
    }
    toast.success(t("Đã trả buyer về hộp thư chung", "Buyer returned to the shared inbox"))
    onReturned()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Trả buyer về hộp thư chung?", "Return buyer to shared inbox?")}</DialogTitle>
          <DialogDescription>
            {t(
              `Buyer ${engagement.leads?.company_name ?? ""} sẽ được gỡ khỏi danh sách của bạn và xuất hiện lại trong hộp thư chung để AE khác nhận. Hãy ghi rõ lý do để AE tiếp theo nắm bối cảnh.`,
              `${engagement.leads?.company_name ?? "This buyer"} will leave your queue and reappear in the shared inbox for another AE to claim. Explain why so the next AE has context.`,
            )}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t(
            "Ví dụ: Tôi đang quá tải, buyer cần AE am hiểu ngành gỗ...",
            "E.g. I am at capacity; this buyer needs an AE covering timber...",
          )}
          rows={3}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("Hủy", "Cancel")}
          </Button>
          <Button onClick={handleReturn} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Inbox className="h-4 w-4" />}
            {t("Trả về hộp thư", "Return to inbox")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
