"use server"

import { headers } from "next/headers"
import { createAdminClient } from "@/lib/supabase/admin"

export interface NewsletterActionState {
  ok: boolean
  message: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Anon-accessible signup. We go through the admin client so the row
 * lands with the full metadata (user agent, referrer) without loosening
 * RLS further than necessary. RLS still allows anon inserts.
 */
export async function subscribeToNewsletter(
  _prev: NewsletterActionState | null,
  formData: FormData,
): Promise<NewsletterActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const locale = String(formData.get("locale") ?? "vi").trim() as "vi" | "en"
  const source = String(formData.get("source") ?? "insights").trim().slice(0, 60)

  if (!email || !EMAIL_RE.test(email)) {
    return {
      ok: false,
      message:
        locale === "vi"
          ? "Vui lòng nhập email hợp lệ."
          : "Please enter a valid email.",
    }
  }

  const h = await headers()
  const userAgent = h.get("user-agent")?.slice(0, 300) ?? null
  const referrer = h.get("referer")?.slice(0, 300) ?? null

  const admin = createAdminClient() as unknown as {
    from: (t: string) => any // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  // Upsert on (email, locale) so a re-submission just refreshes metadata
  // and doesn't throw. Whitelist the columns we care about.
  const { error } = await admin
    .from("newsletter_subscribers")
    .upsert(
      {
        email,
        locale,
        source,
        status: "pending",
        user_agent: userAgent,
        referrer,
      },
      { onConflict: "email,locale", ignoreDuplicates: false },
    )

  if (error) {
    console.error("[v0] subscribeToNewsletter error:", error.message)
    return {
      ok: false,
      message:
        locale === "vi"
          ? "Không thể đăng ký lúc này. Vui lòng thử lại sau."
          : "Couldn't subscribe right now. Please try again later.",
    }
  }

  return {
    ok: true,
    message:
      locale === "vi"
        ? "Cảm ơn bạn! Chúng tôi sẽ gửi bài viết mới vào hộp thư của bạn."
        : "Thank you! We'll send new articles straight to your inbox.",
  }
}
