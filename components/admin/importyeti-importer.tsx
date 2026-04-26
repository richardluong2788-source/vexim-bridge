"use client"

/**
 * ImportYeti AI buyer importer — client component.
 *
 * Three-step flow that mirrors the existing /admin/leads/import experience:
 *   1. Paste — admin drops raw text from importyeti.com.
 *   2. Preview — AI parses → table with risk + dedup badges per row.
 *   3. Commit — bulk insert into the buyer directory. NO client assignment.
 */

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft,
  Boxes,
  CheckCircle2,
  ClipboardPaste,
  ExternalLink,
  Globe2,
  Info,
  Loader2,
  Sparkles,
  Truck,
  Users,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { assessCountryRisk, type RiskLevel } from "@/lib/risk/country-risk"
import {
  previewImportYeti,
  commitImportYetiPreview,
  type ImportYetiPreviewRow,
} from "@/app/admin/buyers/import-importyeti/actions"

// Stays in sync with the parser cap. Used to show a soft progress bar so
// admins know they have not exceeded the AI Gateway window.
const MAX_INPUT_CHARS = 60_000

const RISK_STYLE: Record<RiskLevel, string> = {
  low: "border-chart-4/40 bg-chart-4/10 text-chart-4",
  medium: "border-chart-5/40 bg-chart-5/10 text-chart-5",
  high: "border-destructive/40 bg-destructive/10 text-destructive",
}

interface Props {
  locale: "vi" | "en"
}

export function ImportYetiImporter({ locale }: Props) {
  const router = useRouter()
  const [raw, setRaw] = useState("")
  const [rows, setRows] = useState<ImportYetiPreviewRow[] | null>(null)
  const [stats, setStats] = useState<{
    total: number
    newCount: number
    duplicateCount: number
    inputCharCount: number
  } | null>(null)
  const [previewing, startPreview] = useTransition()
  const [committing, startCommit] = useTransition()

  // ----- Localised copy -----
  const L = useMemo(() => buildLocale(locale), [locale])

  const charCount = raw.length
  const overLimit = charCount > MAX_INPUT_CHARS

  // -------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------
  function handlePreview() {
    if (!raw.trim()) {
      toast.error(L.errorEmpty)
      return
    }
    if (overLimit) {
      toast.error(L.errorTooLong)
      return
    }
    startPreview(async () => {
      const res = await previewImportYeti(raw)
      if (!res.ok) {
        toast.error(L.errorMap[res.error] ?? L.errorGeneric)
        return
      }
      setRows(res.rows)
      setStats(res.stats)
      if (res.stats.newCount === 0) {
        toast.warning(L.allDuplicates)
      } else {
        toast.success(L.previewReady.replace("{n}", String(res.stats.newCount)))
      }
    })
  }

  function handleCommit() {
    if (!rows) return
    const newRows = rows.filter((r) => r.status === "new")
    if (newRows.length === 0) {
      toast.error(L.errorNoRows)
      return
    }
    startCommit(async () => {
      const res = await commitImportYetiPreview({ rows })
      if (!res.ok) {
        toast.error(L.errorMap[res.error] ?? L.errorGeneric)
        return
      }
      toast.success(L.committed.replace("{n}", String(res.created)))
      router.push("/admin/buyers")
    })
  }

  function handleReset() {
    setRaw("")
    setRows(null)
    setStats(null)
  }

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.back()}
        className="w-fit gap-1"
      >
        <ArrowLeft className="h-4 w-4" />
        {L.back}
      </Button>

      {/* STEP 1 — paste */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardPaste className="h-4 w-4 text-primary" />
            {L.step1Title}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{L.step1Hint}</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="rounded-md bg-muted/40 border border-border p-3 text-xs text-muted-foreground leading-relaxed">
            <div className="flex gap-2 items-start">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="font-medium text-foreground">{L.howToTitle}</p>
                <ol className="list-decimal pl-4 space-y-0.5">
                  <li>{L.howToStep1}</li>
                  <li>{L.howToStep2}</li>
                  <li>{L.howToStep3}</li>
                </ol>
                <p className="pt-1 text-muted-foreground/80">
                  {L.legalNote}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="iy-raw">{L.pasteLabel}</Label>
            <Textarea
              id="iy-raw"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={12}
              placeholder={L.pastePlaceholder}
              className="font-mono text-xs leading-relaxed"
              disabled={previewing}
            />
            <div className="flex items-center justify-between text-[11px]">
              <span
                className={cn(
                  "text-muted-foreground",
                  overLimit && "text-destructive font-medium",
                )}
              >
                {charCount.toLocaleString()} / {MAX_INPUT_CHARS.toLocaleString()} {L.chars}
              </span>
              {raw.trim() && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {L.clear}
                </button>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handlePreview}
              disabled={previewing || !raw.trim() || overLimit}
              className="gap-1.5"
            >
              {previewing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {L.parsing}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {L.parseWithAi}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* STEP 2 — preview */}
      {rows && stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              {L.step2Title}
            </CardTitle>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3 text-chart-1" />
                {L.statsNew}: {stats.newCount}
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <XCircle className="h-3 w-3 text-chart-5" />
                {L.statsDuplicate}: {stats.duplicateCount}
              </Badge>
              <Badge variant="outline">
                {L.statsTotal}: {stats.total}
              </Badge>
              <Badge variant="outline" className="text-muted-foreground">
                {stats.inputCharCount.toLocaleString()} {L.charsParsed}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{L.emptyResult}</p>
            ) : (
              <div className="overflow-x-auto border border-border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="w-[60px]">#</TableHead>
                      <TableHead>{L.colStatus}</TableHead>
                      <TableHead>{L.colCompany}</TableHead>
                      <TableHead>{L.colCountry}</TableHead>
                      <TableHead>{L.colShipments}</TableHead>
                      <TableHead>{L.colKeywords}</TableHead>
                      <TableHead>{L.colSuppliers}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <PreviewRow key={row.idx} row={row} L={L} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* STEP 3 — commit */}
      {rows && stats && stats.newCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              {L.step3Title}
            </CardTitle>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {L.step3Hint}
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleReset} disabled={committing}>
                {L.startOver}
              </Button>
              <Button onClick={handleCommit} disabled={committing} className="gap-1.5">
                {committing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {L.saving}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    {L.commit.replace("{n}", String(stats.newCount))}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Row sub-component — kept inline because it's only used here.
// ---------------------------------------------------------------------------
function PreviewRow({
  row,
  L,
}: {
  row: ImportYetiPreviewRow
  L: ReturnType<typeof buildLocale>
}) {
  const risk = assessCountryRisk(row.data.country)
  const isDup = row.status === "duplicate_company"

  return (
    <TableRow className={cn("align-top", isDup && "opacity-70")}>
      <TableCell className="text-muted-foreground text-xs">
        {row.idx + 1}
      </TableCell>

      <TableCell>
        {isDup ? (
          <Badge
            variant="outline"
            className="border-chart-5/40 bg-chart-5/10 text-chart-5 text-[10px]"
          >
            {L.dupLabel}
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="border-chart-1/40 bg-chart-1/10 text-chart-1 text-[10px]"
          >
            {L.newLabel}
          </Badge>
        )}
      </TableCell>

      <TableCell>
        <div className="flex flex-col gap-1 min-w-[180px]">
          <span className="text-sm font-medium text-foreground">
            {row.data.companyName}
          </span>
          {isDup && row.existingLeadId && (
            <Link
              href={`/admin/buyers/${row.existingLeadId}`}
              target="_blank"
              className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 w-fit"
            >
              {L.viewExisting}
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
          {row.data.importAddress && (
            <span className="text-[11px] text-muted-foreground line-clamp-2 max-w-[260px]">
              {row.data.importAddress}
            </span>
          )}
          {row.data.website && (
            <span className="text-[11px] text-muted-foreground truncate max-w-[260px]">
              {row.data.website}
            </span>
          )}
        </div>
      </TableCell>

      <TableCell>
        {row.data.country ? (
          <div className="flex flex-col gap-1">
            <span className="text-sm inline-flex items-center gap-1.5">
              <Globe2 className="h-3.5 w-3.5 text-muted-foreground" />
              {row.data.country}
            </span>
            <Badge
              variant="outline"
              className={`w-fit text-[10px] uppercase tracking-wide ${RISK_STYLE[risk.level]}`}
            >
              {L.riskLabel[risk.level]}
            </Badge>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </TableCell>

      <TableCell>
        {row.data.shipmentCount12mo != null ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground inline-flex items-center gap-1">
              <Truck className="h-3.5 w-3.5 text-muted-foreground" />
              {row.data.shipmentCount12mo.toLocaleString()}
            </span>
            <span className="text-[10px] text-muted-foreground">{L.last12mo}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
        {row.data.importPorts.length > 0 && (
          <div className="text-[11px] text-muted-foreground mt-1 max-w-[160px] truncate">
            {row.data.importPorts.slice(0, 2).join(", ")}
            {row.data.importPorts.length > 2
              ? ` +${row.data.importPorts.length - 2}`
              : ""}
          </div>
        )}
      </TableCell>

      <TableCell>
        <div className="flex flex-col gap-1 max-w-[200px]">
          {row.data.productKeywords.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {row.data.productKeywords.slice(0, 3).map((kw) => (
                <Badge
                  key={kw}
                  variant="secondary"
                  className="font-normal text-[10px] py-0 px-1.5"
                >
                  {kw}
                </Badge>
              ))}
              {row.data.productKeywords.length > 3 && (
                <Badge variant="outline" className="font-normal text-[10px] py-0 px-1.5">
                  +{row.data.productKeywords.length - 3}
                </Badge>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
          {row.data.hsCodes.length > 0 && (
            <div className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
              <Boxes className="h-3 w-3" />
              HS: {row.data.hsCodes.slice(0, 2).join(", ")}
              {row.data.hsCodes.length > 2 ? ` +${row.data.hsCodes.length - 2}` : ""}
            </div>
          )}
        </div>
      </TableCell>

      <TableCell>
        {row.data.topSuppliers.length === 0 ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <div className="flex flex-col gap-0.5 text-xs max-w-[220px]">
            {row.data.topSuppliers.slice(0, 3).map((s, i) => (
              <span key={`${s.name}-${i}`} className="truncate">
                <span className="text-foreground">{s.name}</span>
                {s.country && (
                  <span className="text-muted-foreground"> · {s.country}</span>
                )}
              </span>
            ))}
            {row.data.topSuppliers.length > 3 && (
              <span className="text-[10px] text-muted-foreground">
                +{row.data.topSuppliers.length - 3} {L.moreSuppliers}
              </span>
            )}
          </div>
        )}
      </TableCell>
    </TableRow>
  )
}

// ---------------------------------------------------------------------------
// Localisation map. Inline because none of these strings are reused
// elsewhere — no need to pollute the global dictionary.
// ---------------------------------------------------------------------------
function buildLocale(locale: "vi" | "en") {
  const vi = {
    back: "Quay lại",
    step1Title: "1. Dán dữ liệu từ ImportYeti",
    step1Hint:
      "Mở importyeti.com, vào trang công ty buyer, copy toàn bộ trang rồi dán vào đây.",
    howToTitle: "Hướng dẫn nhanh",
    howToStep1:
      'Mở importyeti.com trong trình duyệt của bạn và đăng nhập (nếu cần).',
    howToStep2:
      "Vào trang công ty buyer (vd: importyeti.com/company/some-buyer-inc).",
    howToStep3: "Bấm Ctrl+A → Ctrl+C, sau đó Ctrl+V vào ô bên dưới.",
    legalNote:
      "Lưu ý: hệ thống KHÔNG tự cào ImportYeti. Bạn phải tự copy nội dung từ trình duyệt của mình để tuân thủ điều khoản sử dụng của họ.",
    pasteLabel: "Dán nội dung trang ImportYeti tại đây",
    pastePlaceholder:
      "Ví dụ:\nAcme Foods Inc — US Import & Buyer Data\n127 shipments in last 12 months\nTop suppliers: Mekong Seafood Co. (Vietnam), ...",
    chars: "ký tự",
    clear: "Xoá",
    parseWithAi: "Phân tích bằng AI",
    parsing: "Đang phân tích...",
    step2Title: "2. Xem trước kết quả AI bóc tách",
    step3Title: "3. Lưu vào danh bạ buyer",
    step3Hint:
      "Các buyer mới sẽ được lưu vào /admin/buyers với nguồn = ImportYeti. Bạn có thể gán cho client Việt Nam sau từ trang chi tiết buyer.",
    statsNew: "Buyer mới",
    statsDuplicate: "Đã tồn tại",
    statsTotal: "Tổng",
    charsParsed: "ký tự đã phân tích",
    emptyResult: "Không tìm thấy buyer nào trong nội dung đã dán.",
    allDuplicates:
      "Tất cả buyer trong nội dung đã dán đã có trong danh bạ rồi.",
    colStatus: "Trạng thái",
    colCompany: "Công ty",
    colCountry: "Quốc gia & rủi ro",
    colShipments: "Lô hàng & cảng",
    colKeywords: "Sản phẩm",
    colSuppliers: "Top supplier hiện tại",
    newLabel: "Mới",
    dupLabel: "Trùng",
    viewExisting: "Xem buyer đã có",
    last12mo: "12 tháng gần nhất",
    moreSuppliers: "supplier khác",
    riskLabel: { low: "Rủi ro thấp", medium: "Trung bình", high: "Cao" } as Record<
      RiskLevel,
      string
    >,
    startOver: "Làm lại từ đầu",
    saving: "Đang lưu...",
    commit: "Lưu {n} buyer mới",
    committed: "Đã lưu {n} buyer vào danh bạ.",
    previewReady: "AI bóc tách được {n} buyer mới.",
    errorEmpty: "Vui lòng dán nội dung từ ImportYeti trước.",
    errorTooLong: "Nội dung dán quá dài. Vui lòng cắt bớt.",
    errorNoRows: "Không có buyer mới nào để lưu.",
    errorGeneric: "Có lỗi xảy ra. Vui lòng thử lại.",
    errorMap: {
      unauthorized: "Bạn không có quyền thực hiện thao tác này.",
      input_empty: "Vui lòng dán nội dung từ ImportYeti trước.",
      input_too_long: "Nội dung dán quá dài. Vui lòng cắt bớt.",
      ai_failed: "AI Gateway lỗi. Vui lòng thử lại sau.",
      no_buyers_found:
        "AI không tìm thấy buyer nào. Bạn đã copy đúng trang ImportYeti chưa?",
      db_failed: "Lỗi cơ sở dữ liệu. Vui lòng thử lại.",
      no_rows: "Không có buyer mới nào để lưu.",
    } as Record<string, string>,
  }

  const en = {
    back: "Back",
    step1Title: "1. Paste the ImportYeti page",
    step1Hint:
      "Open importyeti.com, go to a buyer's company page, copy the whole page and paste it here.",
    howToTitle: "Quick steps",
    howToStep1: "Open importyeti.com in your own browser (sign in if needed).",
    howToStep2:
      "Visit a buyer's company page (e.g. importyeti.com/company/some-buyer-inc).",
    howToStep3: "Press Ctrl+A → Ctrl+C, then paste with Ctrl+V below.",
    legalNote:
      "Note: this tool does NOT scrape ImportYeti. You must copy the content yourself from your own browser to stay within their terms of service.",
    pasteLabel: "Paste the ImportYeti page content here",
    pastePlaceholder:
      "Example:\nAcme Foods Inc — US Import & Buyer Data\n127 shipments in last 12 months\nTop suppliers: Mekong Seafood Co. (Vietnam), ...",
    chars: "chars",
    clear: "Clear",
    parseWithAi: "Parse with AI",
    parsing: "Parsing...",
    step2Title: "2. Review the AI extraction",
    step3Title: "3. Save to buyer directory",
    step3Hint:
      "New buyers are saved to /admin/buyers with source = ImportYeti. You can assign them to a Vietnamese client later from the buyer detail page.",
    statsNew: "New buyers",
    statsDuplicate: "Already exist",
    statsTotal: "Total",
    charsParsed: "chars parsed",
    emptyResult: "No buyers found in the pasted content.",
    allDuplicates: "Every buyer in the pasted content already exists in the directory.",
    colStatus: "Status",
    colCompany: "Company",
    colCountry: "Country & risk",
    colShipments: "Shipments & ports",
    colKeywords: "Products",
    colSuppliers: "Top suppliers today",
    newLabel: "New",
    dupLabel: "Duplicate",
    viewExisting: "View existing buyer",
    last12mo: "last 12 months",
    moreSuppliers: "more",
    riskLabel: { low: "Low risk", medium: "Medium", high: "High" } as Record<
      RiskLevel,
      string
    >,
    startOver: "Start over",
    saving: "Saving...",
    commit: "Save {n} new buyers",
    committed: "Saved {n} buyers to the directory.",
    previewReady: "AI extracted {n} new buyers.",
    errorEmpty: "Please paste content from ImportYeti first.",
    errorTooLong: "Pasted content is too long. Please trim it.",
    errorNoRows: "No new buyers to save.",
    errorGeneric: "Something went wrong. Please try again.",
    errorMap: {
      unauthorized: "You do not have permission to do this.",
      input_empty: "Please paste content from ImportYeti first.",
      input_too_long: "Pasted content is too long. Please trim it.",
      ai_failed: "AI Gateway error. Please try again later.",
      no_buyers_found:
        "AI could not find any buyer in the pasted content. Did you copy the right ImportYeti page?",
      db_failed: "Database error. Please try again.",
      no_rows: "No new buyers to save.",
    } as Record<string, string>,
  }

  return locale === "vi" ? vi : en
}
