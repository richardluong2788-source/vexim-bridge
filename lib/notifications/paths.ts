/**
 * Canonical in-app destinations for notification CTAs.
 *
 * Opportunity detail lives as a sheet on the Kanban board — there is no
 * `/admin/opportunities/[id]` page. Engagements honour `?focus=`, and the work
 * queue is the "Đang xử lý" tab of the AE inbox (see
 * app/admin/ae-inbox/page.tsx); `/admin/engagements` still redirects there for
 * links already sent.
 */

export function pipelineOppPath(
  opportunityId: string,
  tab?: "status" | "replies",
): string {
  const params = new URLSearchParams({ opp: opportunityId })
  if (tab === "replies") params.set("tab", "replies")
  return `/admin/pipeline?${params.toString()}`
}

export function engagementFocusPath(engagementId: string): string {
  return `/admin/ae-inbox?tab=work&focus=${engagementId}`
}
