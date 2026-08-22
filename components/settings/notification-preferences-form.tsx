"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, RefreshCw, Save, Send, Unlink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { useTranslation } from "@/components/i18n/language-provider"
import {
  unlinkTelegram,
  updateNotificationPreferences,
} from "@/app/settings/notifications/actions"
import type { NotificationPreferences, PreferredLanguage } from "@/lib/supabase/types"

interface Props {
  initial: NotificationPreferences
  initialLanguage: PreferredLanguage
  botUsername: string
}

export function NotificationPreferencesForm({ initial, initialLanguage, botUsername }: Props) {
  const { t } = useTranslation()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isUnlinking, setIsUnlinking] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [emailEnabled, setEmailEnabled] = useState(initial.email_enabled)
  const [actionRequired, setActionRequired] = useState(initial.email_action_required)
  const [statusUpdate, setStatusUpdate] = useState(initial.email_status_update)
  const [dealClosed, setDealClosed] = useState(initial.email_deal_closed)
  const [newAssignment, setNewAssignment] = useState(initial.email_new_assignment)
  const [language, setLanguage] = useState<PreferredLanguage>(initialLanguage)

  const [telegramLinked, setTelegramLinked] = useState(Boolean(initial.telegram_chat_id))
  const [telegramUsername, setTelegramUsername] = useState(initial.telegram_username)
  const [telegramLinkToken, setTelegramLinkToken] = useState(initial.telegram_link_token)
  const [telegramEnabled, setTelegramEnabled] = useState(initial.telegram_enabled)
  const [telegramActionRequired, setTelegramActionRequired] = useState(
    initial.telegram_action_required,
  )
  const [telegramStatusUpdate, setTelegramStatusUpdate] = useState(
    initial.telegram_status_update,
  )
  const [telegramDealClosed, setTelegramDealClosed] = useState(initial.telegram_deal_closed)
  const [telegramNewAssignment, setTelegramNewAssignment] = useState(
    initial.telegram_new_assignment,
  )

  const telegramDeepLink = `https://t.me/${botUsername}?start=${telegramLinkToken}`

  function handleSave() {
    startTransition(async () => {
      const res = await updateNotificationPreferences({
        email_enabled: emailEnabled,
        email_action_required: actionRequired,
        email_status_update: statusUpdate,
        email_deal_closed: dealClosed,
        email_new_assignment: newAssignment,
        telegram_enabled: telegramEnabled,
        telegram_action_required: telegramActionRequired,
        telegram_status_update: telegramStatusUpdate,
        telegram_deal_closed: telegramDealClosed,
        telegram_new_assignment: telegramNewAssignment,
        preferred_language: language,
      })
      if (res.ok) {
        toast.success(t.settings.saved)
      } else {
        toast.error(t.settings.saveError)
      }
    })
  }

  function handleUnlinkTelegram() {
    setIsUnlinking(true)
    startTransition(async () => {
      const res = await unlinkTelegram()
      setIsUnlinking(false)
      if (res.ok) {
        setTelegramLinked(false)
        setTelegramUsername(null)
        setTelegramEnabled(false)
        toast.success(t.settings.telegram.unlinked)
        router.refresh()
      } else {
        toast.error(t.settings.saveError)
      }
    })
  }

  /**
   * Linking happens on Telegram's side (the user taps the deep link and hits
   * Start there), so we can't know it happened without either polling or the
   * user telling us. This just re-fetches the server component so a freshly
   * linked chat_id shows up without a full page reload.
   */
  function handleCheckLinkStatus() {
    setIsRefreshing(true)
    router.refresh()
    setTimeout(() => setIsRefreshing(false), 800)
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

      {/* Telegram section */}
      <section className="rounded-lg border border-border bg-card p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            {t.settings.telegram.section}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.settings.telegram.sectionDesc}
          </p>
        </div>

        {telegramLinked ? (
          <>
            <div className="flex items-start justify-between gap-4 rounded-md bg-muted/40 p-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor="master-telegram" className="text-sm font-medium">
                  {telegramUsername
                    ? t.settings.telegram.connectedAs.replace("{username}", telegramUsername)
                    : t.settings.telegram.connected}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t.settings.telegram.masterDesc}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="master-telegram"
                  checked={telegramEnabled}
                  onCheckedChange={setTelegramEnabled}
                />
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleUnlinkTelegram}
                disabled={isUnlinking}
                className="gap-2 text-muted-foreground hover:text-destructive"
              >
                {isUnlinking ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Unlink className="h-3.5 w-3.5" />
                )}
                {t.settings.telegram.unlink}
              </Button>
            </div>

            <Separator className="my-6" />

            <div
              className={`flex flex-col gap-5 ${telegramEnabled ? "" : "opacity-50 pointer-events-none"}`}
              aria-disabled={!telegramEnabled}
            >
              {[
                {
                  key: "telegram_action_required",
                  checked: telegramActionRequired,
                  onChange: setTelegramActionRequired,
                  label: t.settings.cat.action_required,
                  desc: t.settings.cat.action_requiredDesc,
                },
                {
                  key: "telegram_status_update",
                  checked: telegramStatusUpdate,
                  onChange: setTelegramStatusUpdate,
                  label: t.settings.cat.status_update,
                  desc: t.settings.cat.status_updateDesc,
                },
                {
                  key: "telegram_deal_closed",
                  checked: telegramDealClosed,
                  onChange: setTelegramDealClosed,
                  label: t.settings.cat.deal_closed,
                  desc: t.settings.cat.deal_closedDesc,
                },
                {
                  key: "telegram_new_assignment",
                  checked: telegramNewAssignment,
                  onChange: setTelegramNewAssignment,
                  label: t.settings.cat.new_assignment,
                  desc: t.settings.cat.new_assignmentDesc,
                },
              ].map((cat) => (
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
          </>
        ) : (
          <div className="flex flex-col items-start gap-4 rounded-md bg-muted/40 p-4">
            <p className="text-sm text-muted-foreground">{t.settings.telegram.notLinkedDesc}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild className="gap-2">
                <a href={telegramDeepLink} target="_blank" rel="noopener noreferrer">
                  <Send className="h-4 w-4" />
                  {t.settings.telegram.linkCta}
                </a>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCheckLinkStatus}
                disabled={isRefreshing}
                className="gap-2"
              >
                {isRefreshing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                {t.settings.telegram.checkStatus}
              </Button>
            </div>
          </div>
        )}
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
