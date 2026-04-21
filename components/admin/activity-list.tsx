"use client"

import { useTranslation } from "@/components/i18n/language-provider"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Badge } from "@/components/ui/badge"
import { Activity as ActivityIcon, ArrowRight, FileText, PlusCircle, MessageSquare } from "lucide-react"
import type { Stage } from "@/lib/supabase/types"

export interface ActivityListItem {
  id: string
  action_type: string
  description: string | null
  created_at: string
  performer?: { full_name: string | null; email: string | null } | null
  opportunity?: {
    id: string
    stage: Stage
    lead: { company_name: string } | null
    client: { company_name: string | null; full_name: string | null } | null
  } | null
}

interface ActivityListProps {
  items: ActivityListItem[]
  showOpportunity?: boolean
  showPerformer?: boolean
}

const ACTION_ICON: Record<string, typeof ActivityIcon> = {
  lead_created: PlusCircle,
  opportunity_created: ArrowRight,
  stage_changed: FileText,
  note_added: MessageSquare,
}

export function ActivityList({
  items,
  showOpportunity = true,
  showPerformer = true,
}: ActivityListProps) {
  const { t, locale } = useTranslation()

  if (items.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <ActivityIcon className="h-8 w-8 text-muted-foreground" />
          <EmptyTitle>{t.admin.activities.empty}</EmptyTitle>
          <EmptyDescription>{t.admin.activities.emptyDesc}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(locale === "vi" ? "vi-VN" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })

  return (
    <ul className="flex flex-col">
      {items.map((item) => {
        const Icon = ACTION_ICON[item.action_type] ?? ActivityIcon
        const actionLabel =
          t.admin.activities.actionTypes[item.action_type as keyof typeof t.admin.activities.actionTypes] ??
          item.action_type
        const performerName =
          item.performer?.full_name ?? item.performer?.email ?? null
        const buyer = item.opportunity?.lead?.company_name
        const client =
          item.opportunity?.client?.company_name ?? item.opportunity?.client?.full_name

        return (
          <li
            key={item.id}
            className="flex gap-4 py-4 border-b border-border last:border-b-0"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-sm font-medium text-foreground">
                  {actionLabel}
                </span>
                {showOpportunity && buyer ? (
                  <Badge variant="outline" className="font-normal">
                    {buyer}
                    {client ? ` → ${client}` : ""}
                  </Badge>
                ) : null}
              </div>
              {item.description ? (
                <p className="text-sm text-muted-foreground break-words">
                  {item.description}
                </p>
              ) : null}
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <time dateTime={item.created_at}>{formatDate(item.created_at)}</time>
                {showPerformer && performerName ? (
                  <span>
                    · {t.admin.activities.performedBy} {performerName}
                  </span>
                ) : null}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
