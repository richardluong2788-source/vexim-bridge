"use client"

/**
 * Engagement action bar — one place that knows what an AE can DO with a
 * pre-opportunity buyer, rendered by both surfaces that show a buyer in flight:
 *
 *   1. the AE inbox card, historically — the inbox is a worklist now and does
 *      not mount this bar at all;
 *   2. the buyer profile's "Phân tích" tab (/admin/buyers/[id]) —
 *      `BuyerEngagementBar`: the same buttons, with the stage's primary action
 *      leading as "Việc tiếp theo". The buyer's stage, days in stage and reply
 *      count live in the page header and the tab badges, not here — a bar that
 *      repeats the header is just a second row of chrome above the buttons.
 *
 * Which buttons a stage offers is decided by lib/buyers/engagement-stages.ts.
 *
 * DESIGN NOTE — the dialogs are shared, not duplicated
 * ------------------------------------------------------------------------
 * The stage dialogs (requirement email, requirements form, shortlist builder,
 * convert) are large and stateful. They live once, in
 * components/admin/engagement-stage-dialogs.tsx, behind `EngagementStageDialogHost`
 * — dialogs open it with `emailVariant="dialog"`, the profile bar with
 * `"sheet"` so the analysis stays visible while writing. Both surfaces pass an
 * engagement row loaded with ENGAGEMENT_SELECT, from
 * lib/buyers/engagement-queries.ts — so a dialog can never be handed a
 * half-loaded row on one screen and a full one on the other.
 *
 * The inbox does not mount this at all (it is a worklist: peek, then open the
 * buyer's page), so the profile is the one place these buttons render — which
 * is the actual guarantee that the two surfaces cannot show different actions.
 */

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeftRight,
  ArrowRight,
  ChevronDown,
  ClipboardList,
  Inbox,
  Link2,
  Mail,
  RotateCw,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react"
import {
  DropEngagementDialog,
  EngagementStageDialogHost,
  ReturnToInboxDialog,
  TransferEngagementDialog,
} from "@/components/admin/engagement-stage-dialogs"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  getStageActions,
  stageActionContextFromEngagement,
  type StageActionKey,
} from "@/lib/buyers/engagement-stages"
import type {
  Engagement,
  EngagementActionTarget,
  EngagementClient,
} from "@/lib/buyers/engagement-types"
export type { EngagementActionTarget }

/** Icons live here, next to the UI, so the stage map itself stays plain data. */
const STAGE_ACTION_ICONS: Record<StageActionKey, LucideIcon> = {
  draft_opening_email: Mail,
  record_decline: X,
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
  nextStepFirst = false,
}: {
  engagement: EngagementActionTarget
  locale: "vi" | "en"
  onAction: (key: StageActionKey) => void
  /**
   * Lead with the stage's primary action, labelled "Việc tiếp theo: …".
   *
   * The inbox lists a stage's actions in their canonical order (the stage map
   * sometimes puts a secondary one first, e.g. shortlist_ready offers "chọn nhà
   * cung" before "duyệt & gửi"). The profile bar is a next-step prompt rather
   * than a menu, so there the priority has to be the first thing read.
   */
  nextStepFirst?: boolean
}) {
  const actions = getStageActions(
    engagement.stage,
    stageActionContextFromEngagement(engagement),
  )

  if (actions.length === 0) return null

  // Stable sort: the primary action moves to the front, everything else keeps
  // the order the stage map gave it.
  const ordered = nextStepFirst
    ? [...actions].sort((a, b) => Number(!!b.primary) - Number(!!a.primary))
    : actions

  return (
    <>
      {ordered.map((action) => {
        const Icon = STAGE_ACTION_ICONS[action.key]
        const framed = nextStepFirst && !!action.primary
        return (
          <Button
            key={action.key}
            size="sm"
            variant={framed ? "default" : action.variant}
            className="gap-2"
            onClick={() => onAction(action.key)}
          >
            <Icon className="h-4 w-4" />
            {framed
              ? locale === "vi"
                ? `Việc tiếp theo: ${action.labelVi}`
                : `Next: ${action.labelEn}`
              : locale === "vi"
                ? action.labelVi
                : action.labelEn}
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
  emailContextHints = [],
  clients = [],
}: {
  /** FULL engagement row (ENGAGEMENT_SELECT) — the sheet/dialogs need the
   *  shortlist versions, share links and replies, not just the stage. */
  engagement: Engagement
  /** Assignable clients, for the shortlist builder. */
  clients?: EngagementClient[]
  buyerId: string
  /** Buyer company name, for the dialogs' copy (may be missing on old rows). */
  companyName: string | null
  locale: "vi" | "en"
  /** Talking points / tips to keep in view inside the email panel. */
  emailContextHints?: string[]
}) {
  const router = useRouter()
  const t = (vi: string, en: string) => (locale === "vi" ? vi : en)

  // EVERY stage action now runs here, through the same shared dialogs the inbox
  // uses. The AE no longer leaves the buyer they are reading to record
  // requirements, build the shortlist or create the opportunities — which was
  // the whole point of the tab: one page per buyer, no round trip to the queue.
  // The composer opens as a side panel so the analysis stays visible while
  // writing; the rest are ordinary modals.
  const [stageAction, setStageAction] = useState<StageActionKey | null>(null)

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-3">
      {/* Deliverables only — no badges. The buyer's stage, days in stage and
          reply count are in the page header and the tab badges; repeating them
          here made a second row of chrome above the buttons. */}
      <EngagementStageActions
        engagement={engagement}
        locale={locale}
        onAction={setStageAction}
        nextStepFirst
      />

      <EngagementAdminActions
        engagement={{ ...engagement, leads: { company_name: companyName } }}
        locale={locale}
        layout="menu"
      />

      {/* Anchors the admin menu to this buyer for screen readers. */}
      <span className="sr-only">
        {t(
          `Hành động cho buyer ${companyName ?? buyerId}`,
          `Actions for buyer ${companyName ?? buyerId}`,
        )}
      </span>

      <EngagementStageDialogHost
        action={stageAction}
        engagement={engagement}
        clients={clients}
        locale={locale}
        emailVariant="sheet"
        emailContextHints={emailContextHints}
        onClose={() => setStageAction(null)}
        onDone={() => {
          setStageAction(null)
          // The stage moved (email sent, requirements saved, shortlist built,
          // deals created), so re-render to show the new next step.
          router.refresh()
        }}
      />
    </div>
  )
}
