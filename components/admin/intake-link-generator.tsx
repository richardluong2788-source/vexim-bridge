"use client"

import { useState, useTransition } from "react"
import { AlertCircle, Check, Copy, Link2, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { createIntakeLink } from "@/app/admin/clients/new/actions"

type Locale = "vi" | "en"

interface IntakeLinkGeneratorProps {
  locale: Locale
}

export function IntakeLinkGenerator({ locale }: IntakeLinkGeneratorProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState<{ url: string; expiresAt?: string } | null>(
    null,
  )
  const [copied, setCopied] = useState(false)

  const tr = (vi: string, en: string) => (locale === "vi" ? vi : en)

  function translateError(code: string): string {
    switch (code) {
      case "forbidden":
        return tr(
          "Bạn không có quyền tạo liên kết.",
          "You are not allowed to create links.",
        )
      case "unauthenticated":
        return tr("Vui lòng đăng nhập lại.", "Please sign in again.")
      default:
        return tr("Có lỗi xảy ra, vui lòng thử lại.", "Something went wrong.")
    }
  }

  function handleGenerate() {
    setError(null)
    setCopied(false)
    startTransition(async () => {
      const result = await createIntakeLink()
      if (!result.ok || !result.url) {
        setError(translateError(result.error ?? "unknown"))
        return
      }
      setLink({ url: result.url, expiresAt: result.expiresAt })
    })
  }

  async function handleCopy() {
    if (!link) return
    await navigator.clipboard.writeText(link.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const expiresLabel = link?.expiresAt
    ? new Date(link.expiresAt).toLocaleDateString(
        locale === "vi" ? "vi-VN" : "en-US",
        { day: "2-digit", month: "2-digit", year: "numeric" },
      )
    : null

  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader>
        <CardTitle>
          {tr("Gửi form cho khách hàng tự điền", "Send Client Intake Link")}
        </CardTitle>
        <CardDescription>
          {tr(
            "Tạo một liên kết riêng, dùng một lần cho khách hàng bạn đã liên hệ. Khách hàng điền thông tin đăng ký và hồ sơ năng lực — không cần tài khoản. Sau khi khách gửi, hồ sơ sẽ chờ bạn xét duyệt tại mục \"Hồ sơ chờ duyệt\".",
            "Generate a private, single-use link for a client you've contacted. They fill in registration and capability details without an account. Once submitted, it will wait for your review in \"Pending Profiles\".",
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!link ? (
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={isPending}
            className="w-fit gap-2"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            {tr("Tạo liên kết mới", "Generate New Link")}
          </Button>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Input readOnly value={link.url} className="font-mono text-sm" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopy}
                aria-label={tr("Sao chép", "Copy")}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            {expiresLabel && (
              <p className="text-xs text-muted-foreground">
                {tr("Liên kết hết hạn vào", "Link expires on")} {expiresLabel}.{" "}
                {tr(
                  "Chỉ dùng được một lần.",
                  "Single-use only.",
                )}
              </p>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleGenerate}
              disabled={isPending}
              className="w-fit gap-2 text-muted-foreground"
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {tr("Tạo liên kết khác", "Generate Another Link")}
            </Button>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="text-pretty">{error}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
