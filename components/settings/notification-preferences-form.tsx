"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { useTranslation } from "@/components/i18n/language-provider"
import { updateNotificationPreferences } from "@/app/settings/notifications/actions"
import type { NotificationPreferences, PreferredLanguage } from "@/lib/supabase/types"

interface Props {
  initial: NotificationPreferences
  initialLanguage: PreferredLanguage
}

export function NotificationPreferencesForm({ initial, initialLanguage }: Props) {
  const { t } = useTranslation()
  const [isPending, startTransition] = useTransition()

  const [emailEnabled, setEmailEnabled] = useState(initial.email_enabled)
  const [actionRequired, setActionRequired] = useState(initial.email_action_required)
  const [statusUpdate, setStatusUpdate] = useState(initial.email_status_update)
  const [dealClosed, setDealClosed] = useState(initial.email_deal_closed)
  const [newAssignment, setNewAssignment] = useState(initial.email_new_assignment)
  const [language, setLanguage] = useState<PreferredLanguage>(initialLanguage)

  function handleSave() {
    startTransition(async () => {
      const res = await updateNotificationPreferences({
        email_enabled: emailEnabled,
        email_action_required: actionRequired,
        email_status_update: statusUpdate,
        email_deal_closed: dealClosed,
        email_new_assignment: newAssignment,
        preferred_language: language,
      })
      if (res.ok) {
        toast.success(t.settings.saved)
      } else {
        toast.error(t.settings.saveError)
      }
    })
  }

  const categoryToggles: Array<{
    key: string
    checked: boolean
    onChange: (v: boolean) => void
    label: string
    desc: string
  }> = [
    {
      key: "action_required",
      checked: actionRequired,
      onChange: setActionRequired,
      label: t.settings.cat.action_required,
      desc: t.settings.cat.action_requiredDesc,
    },
    {
      key: "status_update",
      checked: statusUpdate,
      onChange: setStatusUpdate,
      label: t.settings.cat.status_update,
      desc: t.settings.cat.status_updateDesc,
    },
    {
      key: "deal_closed",
      checked: dealClosed,
      onChange: setDealClosed,
      label: t.settings.cat.deal_closed,
      desc: t.settings.cat.deal_closedDesc,
    },
    {
      key: "new_assignment",
      checked: newAssignment,
      onChange: setNewAssignment,
      label: t.settings.cat.new_assignment,
      desc: t.settings.cat.new_assignmentDesc,
    },
  ]

  return (
    <div className="flex flex-col gap-8">
      {/* Email section */}
      <section className="rounded-lg border border-border bg-card p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            {t.settings.sectionEmail}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.settings.sectionEmailDesc}
          </p>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-md bg-muted/40 p-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="master-email" className="text-sm font-medium">
              {t.settings.masterEmailLabel}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t.settings.masterEmailDesc}
            </p>
          </div>
          <Switch
            id="master-email"
            checked={emailEnabled}
            onCheckedChange={setEmailEnabled}
          />
        </div>

        <Separator className="my-6" />

        <div
          className={`flex flex-col gap-5 ${emailEnabled ? "" : "opacity-50 pointer-events-none"}`}
          aria-disabled={!emailEnabled}
        >
          {categoryToggles.map((cat) => (
            <div key={cat.key} className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor={`cat-${cat.key}`} className="text-sm font-medium">
                  {cat.label}
                </Label>
                <p className="text-xs text-muted-foreground">{cat.desc}</p>
              </div>
              <Switch
                id={`cat-${cat.key}`}
                checked={cat.checked}
                onCheckedChange={cat.onChange}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Language section */}
      <section className="rounded-lg border border-border bg-card p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            {t.settings.sectionLanguage}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.settings.sectionLanguageDesc}
          </p>
        </div>

        <RadioGroup
          value={language}
          onValueChange={(v) => setLanguage(v as PreferredLanguage)}
          className="flex flex-col gap-3"
        >
          <label
            htmlFor="lang-vi"
            className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3 hover:bg-muted/40"
          >
            <RadioGroupItem id="lang-vi" value="vi" />
            <span className="text-sm font-medium">{t.settings.languageVi}</span>
          </label>
          <label
            htmlFor="lang-en"
            className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3 hover:bg-muted/40"
          >
            <RadioGroupItem id="lang-en" value="en" />
            <span className="text-sm font-medium">{t.settings.languageEn}</span>
          </label>
        </RadioGroup>
      </section>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending} className="gap-2">
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {isPending ? t.settings.saving : t.settings.save}
        </Button>
      </div>
    </div>
  )
}
