"use client"

/**
 * Bulk lead importer — Sprint D.
 *
 * Admins paste a tab-separated or CSV block (headers: company, contact, email,
 * phone, linkedin, industry, country, website, notes). We parse, preview with
 * dedup vs existing leads, optionally enrich via Apollo.io, and commit on
 * approval.
 */

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Upload,
  Users,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sparkles,
  Info,
  ArrowLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/components/i18n/language-provider"
import {
  previewBulkImport,
  commitBulkImport,
  type PreviewRow,
  type RawImportRow,
} from "@/app/admin/leads/import/actions"

type ClientRow = {
  id: string
  full_name: string | null
  company_name: string | null
  industry: string | null
  fda_registration_number: string | null
}

interface Props {
  clients: ClientRow[]
  apolloConfigured: boolean
}

export function BulkLeadImporter({ clients, apolloConfigured }: Props) {
  const router = useRouter()
  const { t } = useTranslation()
  const s = t.admin.bulkImport

  const [raw, setRaw] = useState("")
  const [useEnrichment, setUseEnrichment] = useState(apolloConfigured)
  const [selectedClientId, setSelectedClientId] = useState<string>("")
  const [preview, setPreview] = useState<PreviewRow[] | null>(null)
  const [stats, setStats] = useState<{
    total: number
    valid: number
    duplicates: number
    invalid: number
  } | null>(null)
  const [previewing, startPreview] = useTransition()
  const [committing, startCommit] = useTransition()

  const selectedClient = clients.find((c) => c.id === selectedClientId) ?? null
  const compliant = !!selectedClient?.fda_registration_number?.trim()

  function parseRows(input: string): RawImportRow[] {
    const lines = input
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    if (lines.length === 0) return []

    // Detect delimiter: tab wins, otherwise comma.
    const delim = lines[0].includes("\t") ? "\t" : ","

    // Treat first row as header if it contains the word "company" (case-insensitive).
    const firstIsHeader = /company/i.test(lines[0])
    const dataLines = firstIsHeader ? lines.slice(1) : lines

    return dataLines.map((line) => {
      const cells = line.split(delim).map((c) => c.trim())
      const [
        companyName = "",
        contactPerson = "",
        contactEmail = "",
        contactPhone = "",
        linkedinUrl = "",
        industry = "",
        country = "",
        website = "",
        notes = "",
      ] = cells
      return {
        companyName,
        contactPerson: contactPerson || null,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
        linkedinUrl: linkedinUrl || null,
        industry: industry || null,
        country: country || null,
        website: website || null,
        notes: notes || null,
      }
    })
  }

  function handlePreview() {
    const rows = parseRows(raw)
    if (rows.length === 0) {
      toast.error(s.errorEmpty)
      return
    }
    startPreview(async () => {
      const res = await previewBulkImport(rows, { enrich: useEnrichment })
      if (!res.ok) {
        toast.error(s.errorPreview)
        return
      }
      setPreview(res.rows)
      setStats(res.stats)
      toast.success(s.previewReady.replace("{n}", String(res.stats.valid)))
    })
  }

  function handleCommit() {
    if (!selectedClientId || !preview) return
    if (!compliant) {
      toast.error(s.errorCompliance)
      return
    }
    startCommit(async () => {
      const res = await commitBulkImport({
        clientId: selectedClientId,
        rows: preview,
      })
      if (!res.ok) {
        toast.error(s.errorCommit)
        return
      }
      toast.success(
        s.committed
          .replace("{leads}", String(res.leadsCreated))
          .replace("{opps}", String(res.opportunitiesCreated)),
      )
      router.push("/admin/pipeline")
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.back()}
        className="w-fit gap-1"
      >
        <ArrowLeft className="h-4 w-4" />
        {s.back}
      </Button>

      {/* STEP 1: Paste */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            {s.step1}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{s.step1Hint}</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="rounded-md bg-muted/40 border border-border p-3 text-xs text-muted-foreground leading-relaxed">
            <div className="flex gap-2 items-start">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-foreground">{s.formatTitle}</p>
                <p className="mt-1">
                  <code className="text-[11px]">
                    {s.formatColumns}
                  </code>
                </p>
                <p className="mt-1">{s.formatExample}</p>
                <code className="block mt-1 text-[11px] font-mono">
                  Acme Foods&nbsp;&nbsp;Jane Doe&nbsp;&nbsp;jane@acme.com&nbsp;&nbsp;&nbsp;&nbsp;...
                </code>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bulk-raw">{s.pasteLabel}</Label>
            <Textarea
              id="bulk-raw"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={10}
              placeholder={s.pastePlaceholder}
              className="font-mono text-xs leading-relaxed"
              disabled={previewing}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="enrich"
              checked={useEnrichment}
              onCheckedChange={(v) => setUseEnrichment(Boolean(v))}
              disabled={!apolloConfigured || previewing}
            />
            <Label
              htmlFor="enrich"
              className={cn(
                "text-sm font-normal flex items-center gap-1.5",
                !apolloConfigured && "text-muted-foreground",
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {apolloConfigured ? s.enrichOn : s.enrichUnavailable}
            </Label>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handlePreview}
              disabled={previewing || !raw.trim()}
              className="gap-1.5"
            >
              {previewing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {s.analyzing}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  {s.preview}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* STEP 2: Preview */}
      {preview && stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              {s.step2}
            </CardTitle>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3 text-chart-1" />
                {s.statsNew}: {stats.valid}
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <AlertTriangle className="h-3 w-3 text-chart-5" />
                {s.statsDuplicate}: {stats.duplicates}
              </Badge>
              {stats.invalid > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {s.statsInvalid}: {stats.invalid}
                </Badge>
              )}
              <Badge variant="outline">
                {s.statsTotal}: {stats.total}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="overflow-x-auto border border-border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">#</TableHead>
                    <TableHead>{s.colStatus}</TableHead>
                    <TableHead>{s.colCompany}</TableHead>
                    <TableHead>{s.colContact}</TableHead>
                    <TableHead>{s.colEmail}</TableHead>
                    <TableHead>{s.colCountry}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((row) => (
                    <TableRow
                      key={row.idx}
                      className={cn(
                        row.status === "new" && "bg-chart-1/5",
                        row.status !== "new" && "opacity-60",
                      )}
                    >
                      <TableCell className="text-muted-foreground text-xs">
                        {row.idx + 1}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} labels={s.statuses} />
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {row.raw.companyName}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.enriched.contactPerson ?? row.raw.contactPerson ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.enriched.contactEmail ?? row.raw.contactEmail ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.enriched.country ?? row.raw.country ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 3: Assign + commit */}
      {preview && stats && stats.valid > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              {s.step3}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{s.step3Hint}</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="client-select">{s.client}</Label>
              <Select
                value={selectedClientId}
                onValueChange={setSelectedClientId}
              >
                <SelectTrigger id="client-select">
                  <SelectValue placeholder={s.selectClient} />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.company_name ?? c.full_name ?? c.id}
                      {!c.fda_registration_number?.trim() ? (
                        <span className="text-destructive ml-2 text-xs">
                          ({s.notFda})
                        </span>
                      ) : null}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedClient && !compliant && (
              <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{s.errorCompliance}</p>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={handleCommit}
                disabled={committing || !compliant || !selectedClientId}
                className="gap-1.5"
              >
                {committing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {s.committing}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    {s.commit.replace("{n}", String(stats.valid))}
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

function StatusBadge({
  status,
  labels,
}: {
  status: PreviewRow["status"]
  labels: {
    new: string
    duplicate_email: string
    duplicate_company: string
    invalid: string
  }
}) {
  const variant = {
    new: "bg-chart-1/10 text-chart-1 border-chart-1/30",
    duplicate_email: "bg-chart-5/10 text-chart-5 border-chart-5/30",
    duplicate_company: "bg-chart-5/10 text-chart-5 border-chart-5/30",
    invalid: "bg-destructive/10 text-destructive border-destructive/30",
  }[status]
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
        variant,
      )}
    >
      {labels[status]}
    </span>
  )
}
