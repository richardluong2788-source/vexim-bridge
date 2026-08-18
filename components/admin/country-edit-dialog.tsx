"use client"

import { useState, useTransition } from "react"
import type { Profile } from "@/lib/supabase/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Globe2, Pencil, Plus } from "lucide-react"
import { updateClientCountry } from "@/app/admin/clients/actions"
import { useTranslation } from "@/components/i18n/language-provider"
import { COUNTRY_SUGGESTIONS } from "@/lib/constants/countries"

interface CountryEditDialogProps {
  client: Pick<Profile, "id" | "full_name" | "company_name" | "country">
}

/**
 * Lets AE/Admin set the client's own country — feeds calculateCountryMatch()
 * in lib/matching/scorer.ts so AE auto-assignment can compare a buyer's
 * country against countries where the AE's existing clients are based.
 * Free text (with suggestions), mirroring the leads.country convention.
 */
export function CountryEditDialog({ client }: CountryEditDialogProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [country, setCountry] = useState(client.country ?? "")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const hasExisting = Boolean(client.country)
  const dict = t.admin.clients.countryDialog

  function resolveErrorMessage(code: string): string {
    switch (code) {
      case "notAuthenticated":
      case "forbidden":
        return dict.errorForbidden
      case "notFound":
      case "notAClient":
        return dict.errorNotFound
      default:
        return dict.errorGeneric
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await updateClientCountry(client.id, country.trim() || null)
      if (!result.ok) {
        setError(resolveErrorMessage(result.error ?? "generic"))
        return
      }
      setOpen(false)
    })
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setCountry(client.country ?? "")
      setError(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant={hasExisting ? "ghost" : "outline"} className="h-8 gap-1.5">
          {hasExisting ? (
            <>
              <Pencil className="h-3.5 w-3.5" />
              <span className="text-xs">{client.country}</span>
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" />
              <span className="text-xs">{dict.addButton}</span>
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{dict.title}</DialogTitle>
          <DialogDescription>
            {dict.subtitle.replace(
              "{company}",
              client.company_name ?? client.full_name ?? "—",
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field data-invalid={error ? "true" : undefined}>
              <FieldLabel htmlFor="client-country">
                <Globe2 className="inline h-3.5 w-3.5 mr-1" />
                {dict.label}
              </FieldLabel>
              <Input
                id="client-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder={dict.placeholder}
                autoComplete="off"
                autoFocus
                disabled={isPending}
                list="client-country-suggestions"
              />
              <datalist id="client-country-suggestions">
                {COUNTRY_SUGGESTIONS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <FieldDescription>{dict.help}</FieldDescription>
            </Field>

            {error ? <FieldError>{error}</FieldError> : null}
          </FieldGroup>

          <DialogFooter className="mt-6 gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              {dict.cancel}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner className="mr-1" /> : null}
              {dict.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
