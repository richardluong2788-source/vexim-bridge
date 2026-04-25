"use client"

import { useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Search, Loader2, AlertCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/components/i18n/language-provider"

type LookupResult = {
  ok: boolean
  ambiguous?: boolean
  opportunity?: {
    id: string
    client_name: string | null
    lead_company: string | null
    stage: string | null
    ref: string
  }
  reason?: string
}

/**
 * Paste a buyer-reply tag (e.g. [VEX-LA-A3F9C2]) and jump straight to the
 * matching opportunity. Lives at the top of /admin/pipeline so staff
 * triaging the shared Zoho inbox can quickly route replies.
 */
export function PipelineRefSearch() {
  const router = useRouter()
  const { t } = useTranslation()
  const [query, setQuery] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const labels = t.admin.pipeline.refSearch ?? {
    label: "Tra cứu phản hồi của buyer",
    placeholder: "Dán mã [VEX-LA-A3F9C2] hoặc 6 ký tự cuối",
    hint: "Mở email buyer trong Zoho, copy mã trong tiêu đề rồi dán vào đây",
    button: "Mở opportunity",
    notFound: "Không tìm thấy opportunity với mã này",
    invalid: "Mã không hợp lệ — phải là VEX-XX-XXXXXX hoặc 6 ký tự hex",
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const q = query.trim()
    if (!q) return

    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/opportunities/find-by-ref?q=${encodeURIComponent(q)}`,
          { method: "GET" },
        )
        const json = (await res.json()) as LookupResult

        if (json.ok && json.opportunity) {
          router.push(`/admin/opportunities/${json.opportunity.id}`)
          return
        }

        if (json.reason === "not_found") setError(labels.notFound)
        else if (json.reason === "invalid") setError(labels.invalid)
        else setError(labels.notFound)
      } catch {
        setError(labels.notFound)
      }
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex flex-col gap-1">
        <label
          htmlFor="ref-search-input"
          className="text-sm font-medium text-foreground"
        >
          {labels.label}
        </label>
        <p className="text-xs text-muted-foreground">{labels.hint}</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="ref-search-input"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              if (error) setError(null)
            }}
            placeholder={labels.placeholder}
            className="pl-9 font-mono"
            autoComplete="off"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "ref-search-error" : undefined}
          />
        </div>
        <Button type="submit" disabled={pending || !query.trim()}>
          {pending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              {labels.button}
            </>
          ) : (
            labels.button
          )}
        </Button>
      </div>

      {error && (
        <p
          id="ref-search-error"
          role="alert"
          className="flex items-center gap-2 text-sm text-destructive"
        >
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          {error}
        </p>
      )}
    </form>
  )
}
