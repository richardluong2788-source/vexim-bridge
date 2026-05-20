import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { dispatchNotification } from "@/lib/notifications/dispatcher"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Warning thresholds for document expiry (days before expiry)
 */
const WARNING_DAYS = 30
const URGENT_WARNING_DAYS = 7

/**
 * Re-notify interval - don't spam clients daily
 */
const RENOTIFY_EVERY_DAYS = 7

/**
 * Document kind display names (Vietnamese/English)
 */
const DOC_KIND_NAMES: Record<string, { vi: string; en: string }> = {
  fda_certificate: { vi: "Giấy đăng ký FDA", en: "FDA Registration Certificate" },
  coa: { vi: "Giấy phân tích chất lượng (COA)", en: "Certificate of Analysis" },
  phytosanitary: { vi: "Giấy kiểm dịch thực vật", en: "Phytosanitary Certificate" },
  health_certificate: { vi: "Giấy chứng nhận y tế", en: "Health Certificate" },
  haccp: { vi: "Chứng nhận HACCP", en: "HACCP Certification" },
  origin_certificate: { vi: "Giấy chứng nhận xuất xứ (C/O)", en: "Certificate of Origin" },
  organic_cert: { vi: "Chứng nhận hữu cơ", en: "Organic Certification" },
  catch_certificate: { vi: "Giấy chứng nhận IUU", en: "IUU Catch Certificate" },
  brc_ifs: { vi: "Chứng nhận BRC/IFS", en: "BRC/IFS Certification" },
  fumigation_cert: { vi: "Giấy xông khử trùng", en: "Fumigation Certificate" },
  global_gap: { vi: "Chứng nhận GlobalGAP", en: "GlobalGAP Certification" },
  oeko_tex: { vi: "Chứng nhận OEKO-TEX", en: "OEKO-TEX Certification" },
  gots: { vi: "Chứng nhận GOTS", en: "GOTS Certification" },
  fsc: { vi: "Chứng nhận FSC", en: "FSC Certification" },
  ce_mark: { vi: "Chứng nhận CE", en: "CE Marking" },
  other: { vi: "Hồ sơ khác", en: "Other Document" },
}

/**
 * Daily compliance document expiry check cron.
 * 
 * Scans all compliance_docs with expires_at set and sends notifications when:
 * - Document has expired
 * - Document expires within WARNING_DAYS (30 days)
 * - Document expires within URGENT_WARNING_DAYS (7 days) - more urgent messaging
 * 
 * Uses notification dedup to avoid spamming the same client.
 */
export async function GET(request: Request) {
  // 1. Auth check
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 })
  }
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  // 2. Calculate date horizons
  const warningDate = new Date(today)
  warningDate.setDate(warningDate.getDate() + WARNING_DAYS)

  // 3. Fetch expiring/expired docs with owner info
  const { data: expiringDocs, error: docsError } = await admin
    .from("compliance_docs")
    .select(`
      id,
      owner_id,
      kind,
      title,
      expires_at,
      expiry_notified_at,
      profiles!compliance_docs_owner_id_fkey (
        id,
        full_name,
        company_name,
        preferred_language
      )
    `)
    .not("expires_at", "is", null)
    .lte("expires_at", warningDate.toISOString().slice(0, 10))
    .order("expires_at", { ascending: true })

  if (docsError) {
    console.error("[document-expiry-check] Failed to fetch docs:", docsError)
    return NextResponse.json(
      { error: "Failed to fetch documents", detail: docsError.message },
      { status: 500 }
    )
  }

  const results: Array<{
    docId: string
    ownerId: string
    status: "notified" | "skipped" | "failed"
    reason?: string
  }> = []

  const nowMs = today.getTime()
  const renotifyMs = RENOTIFY_EVERY_DAYS * 86_400_000

  for (const doc of expiringDocs ?? []) {
    const owner = doc.profiles as {
      id: string
      full_name: string | null
      company_name: string | null
      preferred_language: string | null
    } | null

    if (!owner) {
      results.push({ docId: doc.id, ownerId: doc.owner_id, status: "skipped", reason: "no owner profile" })
      continue
    }

    // Calculate days until expiry
    const expiryDate = new Date(doc.expires_at!)
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - nowMs) / (1000 * 60 * 60 * 24))
    const isExpired = daysUntilExpiry < 0
    const isUrgent = daysUntilExpiry <= URGENT_WARNING_DAYS && !isExpired

    // Dedup check
    if (doc.expiry_notified_at) {
      const lastMs = new Date(doc.expiry_notified_at).getTime()
      // For urgent (< 7 days), notify every 3 days. Otherwise every 7 days.
      const interval = isUrgent ? 3 * 86_400_000 : renotifyMs
      if (!Number.isNaN(lastMs) && nowMs - lastMs < interval) {
        results.push({ docId: doc.id, ownerId: doc.owner_id, status: "skipped", reason: "recently notified" })
        continue
      }
    }

    const docName = DOC_KIND_NAMES[doc.kind] || { vi: doc.title || doc.kind, en: doc.title || doc.kind }
    const label = owner.company_name ?? owner.full_name ?? "Quý khách"
    const absDays = Math.abs(daysUntilExpiry)

    // Build notification content
    const title = isExpired
      ? {
          vi: `[Hết hạn] ${docName.vi}`,
          en: `[Expired] ${docName.en}`,
        }
      : isUrgent
        ? {
            vi: `[Khẩn] ${docName.vi} sắp hết hạn`,
            en: `[Urgent] ${docName.en} expiring soon`,
          }
        : {
            vi: `${docName.vi} sắp hết hạn`,
            en: `${docName.en} expiring soon`,
          }

    const body = isExpired
      ? {
          vi: `${docName.vi} của ${label} đã hết hạn ${absDays} ngày. Vui lòng gia hạn ngay để tránh ảnh hưởng đến các lô hàng xuất khẩu.`,
          en: `${docName.en} for ${label} expired ${absDays} days ago. Please renew immediately to avoid disruption to your export shipments.`,
        }
      : isUrgent
        ? {
            vi: `${docName.vi} của ${label} sẽ hết hạn sau ${absDays} ngày (${expiryDate.toLocaleDateString("vi-VN")}). Hãy gia hạn ngay để đảm bảo không gián đoạn xuất khẩu!`,
            en: `${docName.en} for ${label} expires in ${absDays} days (${expiryDate.toLocaleDateString("en-US")}). Please renew now to ensure uninterrupted exports!`,
          }
        : {
            vi: `${docName.vi} của ${label} sẽ hết hạn sau ${absDays} ngày (${expiryDate.toLocaleDateString("vi-VN")}). Vui lòng lên kế hoạch gia hạn sớm.`,
            en: `${docName.en} for ${label} expires in ${absDays} days (${expiryDate.toLocaleDateString("en-US")}). Please plan for renewal soon.`,
          }

    try {
      await dispatchNotification({
        userId: owner.id,
        category: "action_required",
        linkPath: "/client",
        dedupKey: `doc_expiry:${doc.id}:${doc.expires_at}:${bucketDays(daysUntilExpiry)}`,
        title,
        body,
        ctaLabel: {
          vi: "Cập nhật hồ sơ",
          en: "Update documents",
        },
      })

      // Mark notified
      await admin
        .from("compliance_docs")
        .update({ expiry_notified_at: todayStr })
        .eq("id", doc.id)

      results.push({ docId: doc.id, ownerId: doc.owner_id, status: "notified" })
    } catch (err) {
      results.push({
        docId: doc.id,
        ownerId: doc.owner_id,
        status: "failed",
        reason: err instanceof Error ? err.message : "unknown",
      })
    }
  }

  // Also notify AE/Admin about clients with critical missing docs
  // (This is a separate concern, could be expanded later)

  const summary = {
    scanned: expiringDocs?.length ?? 0,
    notified: results.filter((r) => r.status === "notified").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    failed: results.filter((r) => r.status === "failed").length,
  }

  return NextResponse.json({ summary, results })
}

/**
 * Bucket days for dedup key - allows fresh emails at different urgency levels
 */
function bucketDays(days: number): number {
  if (days < 0) return -1 // expired
  if (days <= 7) return 0 // urgent
  if (days <= 14) return 1 // soon
  return Math.floor(days / 7)
}
