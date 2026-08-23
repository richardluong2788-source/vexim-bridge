/**
 * GET /api/export/clients/[id]/blackbox — CSV "hộp đen" của MỘT client.
 *
 * Ai được export: AE/Lead Researcher chỉ khi họ sở hữu client này
 * (profiles.account_manager_id), Admin/Super Admin/Finance export mọi client
 * (OWNERSHIP_BYPASS) — dùng chung `lib/auth/scope.ts`, không cần quyền mới.
 *
 * Query params:
 *   ?period=30d|90d|quarter|year|all   (mặc định "quarter")
 *
 * Output: một file CSV gồm 3 khối nối liền nhau (tổng quan theo kỳ, danh
 * sách deal đã chạm trong kỳ, nhật ký sự kiện thô trong kỳ) — đủ để mở bằng
 * Excel/Sheets và lọc/pivot tiếp.
 */
import { NextResponse } from "next/server"
import { getCurrentRole } from "@/lib/auth/guard"
import { CAPS, can } from "@/lib/auth/permissions"
import { ownershipScopeFor, isClientOwned } from "@/lib/auth/scope"
import { getClientBlackbox } from "@/lib/analytics/client-blackbox"
import { parsePeriod, resolvePeriod } from "@/lib/analytics/constants"
import { toCsv, csvResponseHeaders, type CsvColumn } from "@/lib/export/csv"
import type {
  BlackboxActivityRow,
  BlackboxOpportunityRow,
} from "@/lib/analytics/client-blackbox"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function fmtHours(h: number | null): string {
  return h === null ? "" : `${h}`
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params

  const current = await getCurrentRole()
  if (!current) return NextResponse.json({ error: "unauthenticated" }, { status: 401 })

  const seeAll = can(current.role, CAPS.ANALYTICS_VIEW_ALL)
  const seeOwn = can(current.role, CAPS.ANALYTICS_VIEW_OWN)
  if (!seeAll && !seeOwn) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const scope = ownershipScopeFor(current.role, current.userId)
  const owned = await isClientOwned(scope, current.admin, clientId)
  if (!owned) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const periodValue = parsePeriod(searchParams.get("period") ?? undefined)
  const period = resolvePeriod(periodValue, "vi")

  const data = await getClientBlackbox(clientId, period)
  if (!data) return NextResponse.json({ error: "notFound" }, { status: 404 })

  // ---- Section 1: Tổng quan theo kỳ -------------------------------------
  const overviewRows = [
    { label: "Client", value: data.clientName },
    { label: "Kỳ báo cáo", value: data.periodLabel },
    { label: "Đơn mới trong kỳ", value: data.totals.opened },
    { label: "Chốt thành công (won)", value: data.totals.won },
    { label: "Thất bại (lost)", value: data.totals.lost },
    { label: "Đang chạy (snapshot)", value: data.totals.inProgress },
    { label: "Tỉ lệ thắng (%)", value: data.totals.winRatePct ?? "" },
    { label: "TB thời gian AE phản hồi client (giờ)", value: fmtHours(data.totals.avgClientResponseHours) },
    { label: "Số yêu cầu client trong kỳ", value: data.totals.clientRequestsInPeriod },
    { label: "TB thời gian buyer phản hồi (giờ)", value: fmtHours(data.totals.avgBuyerResponseHours) },
    { label: "Số phản hồi buyer trong kỳ", value: data.totals.buyerRepliesInPeriod },
  ]
  const overviewCols: CsvColumn<(typeof overviewRows)[number]> = {
    header: "",
    value: () => "",
  }
  const overviewCsv = toCsv(overviewRows, [
    { header: "Chỉ số", value: (r) => r.label },
    { header: "Giá trị", value: (r) => r.value },
  ])
  void overviewCols

  // ---- Section 2: Danh sách deal đã chạm trong kỳ ------------------------
  const oppColumns: CsvColumn<BlackboxOpportunityRow>[] = [
    { header: "Buyer", value: (r) => r.buyerName },
    { header: "Giai đoạn hiện tại", value: (r) => r.stageLabel },
    { header: "Kết quả", value: (r) => (r.outcome === "won" ? "Thắng" : r.outcome === "lost" ? "Thua" : "Đang chạy") },
    { header: "Ngày tạo", value: (r) => r.createdAt },
    { header: "Ngày đóng", value: (r) => r.closedAt ?? "" },
    { header: "Giá trị tiềm năng (USD)", value: (r) => r.potentialValue ?? "" },
    { header: "Ghi chú AE (proxy lý do thua)", value: (r) => r.aeNote ?? "" },
    { header: "Opportunity ID", value: (r) => r.opportunityId },
  ]
  const oppCsv = toCsv(data.opportunities, oppColumns)

  // ---- Section 3: Nhật ký sự kiện thô trong kỳ ---------------------------
  const activityColumns: CsvColumn<BlackboxActivityRow>[] = [
    { header: "Thời gian", value: (r) => r.occurredAt },
    { header: "Loại sự kiện", value: (r) => r.actionLabel },
    { header: "Mã sự kiện (raw)", value: (r) => r.actionType },
    { header: "Buyer liên quan", value: (r) => r.buyerName ?? "" },
    { header: "Người thực hiện", value: (r) => r.performedByName ?? "" },
    { header: "Chi tiết", value: (r) => r.description ?? "" },
    { header: "Opportunity ID", value: (r) => r.opportunityId ?? "" },
  ]
  const activityCsv = toCsv(data.activities, activityColumns)

  // Strip the BOM from the 2nd/3rd blocks so it doesn't appear mid-file,
  // and separate sections with a title line + blank line.
  const stripBom = (s: string) => (s.startsWith("\uFEFF") ? s.slice(1) : s)
  const csv = [
    overviewCsv,
    "",
    `"=== DANH SÁCH DEAL (${data.opportunities.length}) ==="`,
    stripBom(oppCsv),
    "",
    `"=== NHẬT KÝ SỰ KIỆN (${data.activities.length}) ==="`,
    stripBom(activityCsv),
  ].join("\r\n")

  const stamp = new Date().toISOString().slice(0, 10)
  const safeName = data.clientName.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase().slice(0, 40)
  return new NextResponse(csv, {
    status: 200,
    headers: csvResponseHeaders(`vexim-blackbox-${safeName}-${stamp}.csv`),
  })
}
