"use client"

import { useActionState, useEffect, useRef } from "react"
import { useFormStatus } from "react-dom"
import { Mail, Check } from "lucide-react"
import { toast } from "sonner"
import {
  subscribeToNewsletter,
  type NewsletterActionState,
} from "@/app/insights/newsletter/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"

interface NewsletterSignupProps {
  locale: "vi" | "en"
  source?: string
  variant?: "card" | "inline"
}

function SubmitButton({ locale }: { locale: "vi" | "en" }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="gap-2">
      {pending ? <Spinner className="h-4 w-4" /> : null}
      {locale === "vi" ? "Đăng ký" : "Subscribe"}
    </Button>
  )
}

export function NewsletterSignup({
  locale,
  source = "insights",
  variant = "card",
}: NewsletterSignupProps) {
  const [state, action] = useActionState<NewsletterActionState | null, FormData>(
    subscribeToNewsletter,
    null,
  )
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!state) return
    if (state.ok) {
      toast.success(state.message)
      formRef.current?.reset()
    } else {
      toast.error(state.message)
    }
  }, [state])

  const t = {
    heading: locale === "vi" ? "Nhận Vexim Insights hằng tuần" : "Get Vexim Insights weekly",
    sub:
      locale === "vi"
        ? "Cập nhật FDA, case study thực tế và lịch hạn quan trọng cho doanh nghiệp xuất khẩu Việt."
        : "FDA updates, real case studies, and critical deadlines for Vietnamese exporters.",
    label: locale === "vi" ? "Email của bạn" : "Your email",
    placeholder: locale === "vi" ? "ban@congty.com" : "you@company.com",
    privacy:
      locale === "vi"
        ? "Chúng tôi không spam. Bạn có thể huỷ đăng ký bất cứ lúc nào."
        : "No spam. Unsubscribe at any time.",
  }

  const formContent = (
    <form ref={formRef} action={action} className="flex flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="source" value={source} />

      <Field>
        <FieldLabel htmlFor="newsletter-email" className="sr-only">
          {t.label}
        </FieldLabel>
        <div className="flex flex-col gap-2 sm:flex-row">
          <InputGroup className="flex-1">
            <InputGroupAddon>
              <Mail className="h-4 w-4 text-muted-foreground" aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              id="newsletter-email"
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder={t.placeholder}
            />
          </InputGroup>
          <SubmitButton locale={locale} />
        </div>
      </Field>

      {state?.ok ? (
        <p className="flex items-center gap-1.5 text-xs text-accent">
          <Check className="h-3.5 w-3.5" aria-hidden />
          {state.message}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{t.privacy}</p>
      )}
    </form>
  )

  if (variant === "inline") {
    return formContent
  }

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-6 md:p-8">
      <div className="mb-4">
        <h3 className="text-lg font-semibold tracking-tight md:text-xl">
          {t.heading}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{t.sub}</p>
      </div>
      {formContent}
    </div>
  )
}
