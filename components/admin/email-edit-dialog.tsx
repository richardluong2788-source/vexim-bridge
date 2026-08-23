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
import { Mail, Pencil } from "lucide-react"
import { updateClientEmail } from "@/app/admin/clients/actions"
import { useTranslation } from "@/components/i18n/language-provider"

interface EmailEditDialogProps {
  client: Pick<Profile, "id" | "full_name" | "company_name" | "email">
}

/**
 * Lets AE/Admin change a client's login email. Updates both the Supabase
 * auth user (what the client actually signs in with) and profiles.email
 * (what the rest of the app reads) — see updateClientEmail() for why both
 * must change together.
 */
export function EmailEditDialog({ client }: EmailEditDialogProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState(client.email ?? "")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const dict = t.admin.clients.emailDialog

  function resolveErrorMessage(code: string): string {
    switch (code) {
      case "invalidEmail":
        return dict.errorInvalidEmail
      case "emailExists":
        return dict.errorEmailExists
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
      const result = await updateClientEmail(client.id, email)
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
      setEmail(client.email ?? "")
      setError(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5"
          aria-label={dict.editButton}
        >
          <Pencil className="h-3.5 w-3.5" />
          <span className="text-xs">{dict.editButton}</span>
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
              <FieldLabel htmlFor="client-email">
                <Mail className="inline h-3.5 w-3.5 mr-1" />
                {dict.label}
              </FieldLabel>
              <Input
                id="client-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={dict.placeholder}
                autoComplete="off"
                autoFocus
                disabled={isPending}
              />
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
            <Button type="submit" disabled={isPending || email.trim().length === 0}>
              {isPending ? <Spinner className="mr-1" /> : null}
              {dict.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
