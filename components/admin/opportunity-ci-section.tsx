"use client"

/**
 * Commercial Intelligence Panel (Ngăn Tình báo Thương mại)
 *
 * Displays verified commercial intelligence data for an opportunity.
 * This is filled in by Lead Researcher/Account Executive to prove
 * the buyer meets the import history criterion.
 *
 * Shows:
 * - Main HS Code (Mã HS Code chính)
 * - Import History Summary (Tóm tắt lịch sử nhập khẩu)
 * - Main Competitors (Đối thủ cạnh tranh chính)
 */

import { useEffect, useState, useTransition } from "react"
import { BarChart3, Edit2, Save, X, AlertCircle, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { useTranslation } from "@/components/i18n/language-provider"
import { getCIByOpportunityId, createOrUpdateCI } from "@/app/admin/opportunities/ci-actions"
import type { CommercialIntelligence } from "@/lib/supabase/types"

interface Props {
  opportunityId: string
  open: boolean
}

export function OpportunityCISection({ opportunityId, open }: Props) {
  const { t } = useTranslation()
  const [ci, setCi] = useState<CommercialIntelligence | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()

  // Form state
  const [form, setForm] = useState({
    main_hs_code: "",
    import_history_summary: "",
    main_competitors: "",
  })

  // Load CI data when sheet opens
  useEffect(() => {
    if (!open) return
    let cancelled = false

    setLoading(true)
    getCIByOpportunityId(opportunityId)
      .then((res) => {
        if (cancelled) return
        if (!res.ok) {
          toast.error("Failed to load commercial intelligence")
          return
        }
        setCi(res.ci)
        if (res.ci) {
          setForm({
            main_hs_code: res.ci.main_hs_code || "",
            import_history_summary: res.ci.import_history_summary || "",
            main_competitors: res.ci.main_competitors || "",
          })
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, opportunityId])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await createOrUpdateCI({
        opportunityId,
        main_hs_code: form.main_hs_code.trim() || null,
        import_history_summary: form.import_history_summary.trim() || null,
        main_competitors: form.main_competitors.trim() || null,
      })

      if (!res.ok) {
        toast.error("Failed to save commercial intelligence")
        return
      }

      setCi(res.ci)
      setEditing(false)
      toast.success("Commercial intelligence saved successfully")
    })
  }

  const s = t.admin?.ci || {
    sectionTitle: "Commercial Intelligence",
    sectionSubtitle: "Verified trade intelligence (Được xác minh bởi Bên A trước khi bàn giao)",
    mainHSCode: "Main HS Code (Mã HS Code chính)",
    mainHSCodeHelp: "Primary harmonized tariff code from customs records",
    importHistory: "Import History Summary (Tóm tắt lịch sử nhập khẩu)",
    importHistoryHelp: "Description of buyer's import patterns and volume",
    mainCompetitors: "Main Competitors (Đối thủ cạnh tranh chính)",
    mainCompetitorsHelp: "Key suppliers/competitors the buyer currently uses",
    edit: "Edit",
    save: "Save",
    cancel: "Cancel",
    saving: "Saving...",
    loading: "Loading...",
    noData: "No commercial intelligence data yet",
    verified: "Verified by",
  }

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">{s.sectionTitle}</h3>
            <p className="text-xs text-muted-foreground">{s.sectionSubtitle}</p>
          </div>
        </div>
        {!editing && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setEditing(true)}
            className="gap-1.5"
          >
            <Edit2 className="h-3.5 w-3.5" />
            {s.edit}
          </Button>
        )}
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Spinner className="h-4 w-4" />
          <span className="text-xs text-muted-foreground ml-2">{s.loading}</span>
        </div>
      ) : editing ? (
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="main_hs_code">{s.mainHSCode}</FieldLabel>
                  <Input
                    id="main_hs_code"
                    value={form.main_hs_code}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, main_hs_code: e.target.value }))
                    }
                    placeholder="e.g. 1905.30"
                    disabled={pending}
                  />
                  <FieldDescription>{s.mainHSCodeHelp}</FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="import_history">{s.importHistory}</FieldLabel>
                  <Textarea
                    id="import_history"
                    value={form.import_history_summary}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, import_history_summary: e.target.value }))
                    }
                    placeholder="e.g. Imports 50+ containers/year of instant noodles from Vietnam, Thailand..."
                    rows={3}
                    disabled={pending}
                  />
                  <FieldDescription>{s.importHistoryHelp}</FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="main_competitors">{s.mainCompetitors}</FieldLabel>
                  <Textarea
                    id="main_competitors"
                    value={form.main_competitors}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, main_competitors: e.target.value }))
                    }
                    placeholder="e.g. Maruchan (Japan), Acecook (Vietnam), Samyang (Korea)"
                    rows={3}
                    disabled={pending}
                  />
                  <FieldDescription>{s.mainCompetitorsHelp}</FieldDescription>
                </Field>
              </FieldGroup>

              <div className="flex items-center gap-2 justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(false)}
                  disabled={pending}
                >
                  <X className="h-4 w-4" />
                  {s.cancel}
                </Button>
                <Button type="submit" size="sm" disabled={pending}>
                  {pending ? (
                    <>
                      <Spinner className="h-3.5 w-3.5" />
                      {s.saving}
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      {s.save}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : ci ? (
        <Card>
          <CardContent className="pt-6 flex flex-col gap-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-green-900">Verified CI Data</p>
                <p className="text-xs text-green-700 mt-0.5">
                  This opportunity has verified commercial intelligence.
                </p>
              </div>
            </div>

            {ci.main_hs_code && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">
                  {s.mainHSCode}
                </p>
                <Badge variant="secondary" className="font-mono">
                  {ci.main_hs_code}
                </Badge>
              </div>
            )}

            {ci.import_history_summary && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">
                  {s.importHistory}
                </p>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {ci.import_history_summary}
                </p>
              </div>
            )}

            {ci.main_competitors && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">
                  {s.mainCompetitors}
                </p>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {ci.main_competitors}
                </p>
              </div>
            )}

            {!ci.main_hs_code &&
              !ci.import_history_summary &&
              !ci.main_competitors && (
                <p className="text-xs text-muted-foreground py-2">{s.noData}</p>
              )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-900">{s.noData}</p>
            <p className="text-xs text-amber-700 mt-1">
              Click "Edit" to add commercial intelligence data for this opportunity.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
