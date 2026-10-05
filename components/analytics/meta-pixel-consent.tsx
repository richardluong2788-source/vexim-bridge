"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { useTranslation } from "@/components/i18n/language-provider"
import {
  isMetaPixelExcludedPath,
  isOptionalTrackingAllowedOnCurrentPage,
  OPEN_COOKIE_PREFERENCES_EVENT,
  readOptionalTrackingConsent,
  setOptionalTrackingConsent,
  trackMetaEvent,
  type OptionalTrackingConsent,
} from "@/lib/analytics/meta-pixel"
import {
  revokeGoogleAnalyticsConsent,
  trackGoogleAnalyticsEvent,
} from "@/lib/analytics/google-analytics"
import { localizePath } from "@/lib/i18n/routing"

export function MetaPixelConsent() {
  const pathname = usePathname() ?? "/"
  const { locale } = useTranslation()
  const [consent, setConsent] = useState<OptionalTrackingConsent>(null)
  const [isReady, setIsReady] = useState(false)
  const [showPreferences, setShowPreferences] = useState(false)

  useEffect(() => {
    const savedChoice = readOptionalTrackingConsent()
    setConsent(savedChoice)
    setShowPreferences(savedChoice === null)
    setIsReady(true)
  }, [])

  useEffect(() => {
    if (
      consent === "granted" &&
      !isMetaPixelExcludedPath(pathname) &&
      isOptionalTrackingAllowedOnCurrentPage()
    ) {
      trackMetaEvent("PageView")
      trackGoogleAnalyticsEvent("page_view", {
        page_path: pathname,
        page_location: window.location.href,
        page_title: document.title,
      })
    }
  }, [consent, pathname])

  useEffect(() => {
    const openPreferences = () => setShowPreferences(true)
    window.addEventListener(OPEN_COOKIE_PREFERENCES_EVENT, openPreferences)
    return () => window.removeEventListener(OPEN_COOKIE_PREFERENCES_EVENT, openPreferences)
  }, [])

  useEffect(() => {
    const trackCtaClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return
      const cta = event.target.closest<HTMLElement>("[data-meta-cta]")
      const contentName = cta?.dataset.metaCta
      if (!contentName) return
      trackMetaEvent("Contact", { content_name: contentName })
      trackGoogleAnalyticsEvent("contact", { cta_name: contentName })
    }

    document.addEventListener("click", trackCtaClick)
    return () => document.removeEventListener("click", trackCtaClick)
  }, [])

  function saveChoice(choice: Exclude<OptionalTrackingConsent, null>) {
    setOptionalTrackingConsent(choice)
    if (choice === "denied") revokeGoogleAnalyticsConsent()
    setConsent(choice)
    setShowPreferences(false)
  }

  if (!isReady || !showPreferences || isMetaPixelExcludedPath(pathname)) return null

  const isVietnamese = locale === "vi"

  return (
    <aside
      aria-labelledby="cookie-consent-title"
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl rounded-xl border border-border bg-card p-4 text-card-foreground shadow-2xl sm:inset-x-6 sm:bottom-6 sm:p-5"
      role="region"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <h2 id="cookie-consent-title" className="text-sm font-semibold">
            {isVietnamese ? "Đo lường tùy chọn" : "Optional measurement"}
          </h2>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground sm:text-sm">
            {isVietnamese
              ? "Vexim dùng Google Analytics 4 để đo lượt truy cập và Meta Pixel để đo lượt xem, nhấp CTA, yêu cầu đã gửi trên các trang công khai. Hai công cụ chỉ chạy sau khi bạn đồng ý; dữ liệu trường biểu mẫu không được gửi cho Google hoặc Meta."
              : "Vexim uses Google Analytics 4 to measure visits and Meta Pixel to measure public-page views, CTA clicks, and submitted requests. Both tools run only after you consent; form field values are not sent to Google or Meta."}{" "}
            <Link
              href={localizePath("/legal/cookies", locale)}
              className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
            >
              {isVietnamese ? "Chính sách cookie" : "Cookie policy"}
            </Link>
          </p>
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => saveChoice("denied")}
            className="rounded-md border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isVietnamese ? "Từ chối" : "Reject"}
          </button>
          <button
            type="button"
            onClick={() => saveChoice("granted")}
            className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {isVietnamese ? "Đồng ý" : "Accept"}
          </button>
        </div>
      </div>
    </aside>
  )
}
