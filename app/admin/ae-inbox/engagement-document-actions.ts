"use server"

/**
 * Secure-share actions for the AE buyer engagement pipeline.
 *
 * The browser never submits a Blob URL here. It only submits compliance-doc
 * ids that were loaded from the selected shortlist. The server re-checks the
 * engagement owner, supplier membership, buyer recipient and document owners
 * before it delegates to the existing tokenized bundle-share flow.
 */
import { revalidatePath } from "next/cache"
import { createBundleShareLinkAction } from "@/app/admin/clients/compliance-actions"
import { requireCap } from "@/lib/auth/guard"
import { CAPS, can } from "@/lib/auth/permissions"
import type { ComplianceDocKind } from "@/lib/blob/client-docs"

const SHAREABLE_KINDS = new Set<ComplianceDocKind>([
  "fda_certificate",
  "coa",
  "price_floor",
  "factory_video",
  "factory_photo",
  "other",
])

export interface EngagementDocumentOption {
  id: string
  ownerId: string
  ownerName: string
  kind: ComplianceDocKind
  title: string | null
  mimeType: string | null
  sizeBytes: number | null
  expiresAt: string | null
  createdAt: string
}

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

async function loadEngagementForCaller(
  engagementId: string,
  guard: Extract<Awaited<ReturnType<typeof requireCap>>, { ok: true }>,
) {
  const { data, error } = await (guard.admin as any)
    .from("buyer_engagements")
    .select(
      `
        id, account_manager_id,
        leads ( id, company_name, contact_person, contact_email ),
        buyer_engagement_shortlist_versions (
          status, version_number,
          buyer_engagement_shortlist_items ( client_id )
        ),
        buyer_replies ( message_id, received_at )
      `,
    )
    .eq("id", engagementId)
    .maybeSingle()

  if (error || !data) return null

  // AEs may only share documents for their own engagement. Admin and
  // super_admin retain the existing compliance-workspace oversight access.
  if (!can(guard.role, CAPS.OWNERSHIP_BYPASS) && data.account_manager_id !== guard.userId) {
    return null
  }

  return data as {
    id: string
    account_manager_id: string
    leads: {
      id: string
      company_name: string | null
      contact_person: string | null
      contact_email: string | null
    } | null
    buyer_engagement_shortlist_versions: Array<{
      status: string
      version_number: number
      buyer_engagement_shortlist_items: Array<{ client_id: string }>
    }>
    buyer_replies: Array<{ message_id: string | null; received_at: string | null }>
  }
}

function shortlistedClientIds(engagement: Awaited<ReturnType<typeof loadEngagementForCaller>>) {
  if (!engagement) return []
  const ids = new Set<string>()
  for (const version of engagement.buyer_engagement_shortlist_versions ?? []) {
    // Draft and sent versions are both valid: an AE may need to send a
    // dossier before approving the shortlist, but never from an old
    // superseded version.
    if (version.status === "superseded") continue
    for (const item of version.buyer_engagement_shortlist_items ?? []) {
      if (item.client_id) ids.add(item.client_id)
    }
  }
  return [...ids]
}

/** List shareable compliance docs for suppliers in this engagement's shortlist. */
export async function listEngagementDocumentOptions(
  engagementId: string,
): Promise<ActionResult<{ buyer: { name: string; email: string | null }; documents: EngagementDocumentOption[] }>> {
  const guard = await requireCap(CAPS.CLIENT_COMPLIANCE_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }

  const engagement = await loadEngagementForCaller(engagementId, guard)
  if (!engagement) return { ok: false, error: "engagementNotFound" }

  const clientIds = shortlistedClientIds(engagement)
  if (clientIds.length === 0) {
    return {
      ok: true,
      data: {
        buyer: {
          name: engagement.leads?.contact_person || engagement.leads?.company_name || "Buyer",
          email: engagement.leads?.contact_email ?? null,
        },
        documents: [],
      },
    }
  }

  const { data: docs, error } = await guard.admin
    .from("compliance_docs")
    .select("id, owner_id, kind, title, mime_type, size_bytes, expires_at, created_at, owner:profiles!compliance_docs_owner_id_fkey(company_name, full_name)")
    .in("owner_id", clientIds)
    .order("created_at", { ascending: false })

  if (error) return { ok: false, error: "documentsLoadFailed" }

  const documents = ((docs ?? []) as unknown as Array<{
    id: string
    owner_id: string
    kind: string
    title: string | null
    mime_type: string | null
    size_bytes: number | null
    expires_at: string | null
    created_at: string
    owner: { company_name: string | null; full_name: string | null } | Array<{ company_name: string | null; full_name: string | null }> | null
  }>)
    .filter((doc) => SHAREABLE_KINDS.has(doc.kind as ComplianceDocKind))
    .map((doc) => {
      const owner = Array.isArray(doc.owner) ? doc.owner[0] : doc.owner
      return {
        id: doc.id,
        ownerId: doc.owner_id,
        ownerName: owner?.company_name || owner?.full_name || "Supplier",
        kind: doc.kind as ComplianceDocKind,
        title: doc.title,
        mimeType: doc.mime_type,
        sizeBytes: doc.size_bytes,
        expiresAt: doc.expires_at,
        createdAt: doc.created_at,
      }
    })

  return {
    ok: true,
    data: {
      buyer: {
        name: engagement.leads?.contact_person || engagement.leads?.company_name || "Buyer",
        email: engagement.leads?.contact_email ?? null,
      },
      documents,
    },
  }
}

/** Create a tokenized bundle and email only the app share URL to the buyer. */
export async function createEngagementDocumentShareAction(args: {
  engagementId: string
  clientId: string
  docIds: string[]
  ttlDays?: number
  subjectOverride?: string | null
  bodyOverride?: string | null
}): Promise<ActionResult<{ token: string; emailSent: boolean; emailError?: string }>> {
  const guard = await requireCap(CAPS.CLIENT_COMPLIANCE_WRITE)
  if (!guard.ok) return { ok: false, error: guard.error }

  const engagement = await loadEngagementForCaller(args.engagementId, guard)
  if (!engagement) return { ok: false, error: "engagementNotFound" }

  const recipient = engagement.leads?.contact_email?.trim()
  if (!recipient) return { ok: false, error: "buyerEmailMissing" }

  const shortlistedIds = new Set(shortlistedClientIds(engagement))
  if (!shortlistedIds.has(args.clientId)) return { ok: false, error: "supplierNotInShortlist" }

  const docIds = [...new Set(args.docIds.filter(Boolean))]
  if (docIds.length === 0) return { ok: false, error: "noDocuments" }

  const { data: docs, error } = await guard.admin
    .from("compliance_docs")
    .select("id, owner_id, kind")
    .in("id", docIds)

  if (error || !docs || docs.length !== docIds.length) {
    return { ok: false, error: "documentsNotFound" }
  }

  const validDocs = (docs as Array<{ id: string; owner_id: string; kind: string }>).filter(
    (doc) => doc.owner_id === args.clientId && SHAREABLE_KINDS.has(doc.kind as ComplianceDocKind),
  )
  if (validDocs.length !== docIds.length) return { ok: false, error: "invalidDocuments" }

  const latestReply = [...(engagement.buyer_replies ?? [])]
    .filter((reply) => !!reply.message_id)
    .sort(
      (a, b) =>
        new Date(b.received_at ?? 0).getTime() - new Date(a.received_at ?? 0).getTime(),
    )[0]

  const result = await createBundleShareLinkAction({
    docIds,
    ttlDays: args.ttlDays,
    buyerEmail: recipient,
    buyerName: engagement.leads?.contact_person,
    buyerCompany: engagement.leads?.company_name,
    subjectOverride: args.subjectOverride,
    bodyOverride: args.bodyOverride,
    engagementId: args.engagementId,
    replyToMessageId: latestReply?.message_id ?? null,
  })

  if (!result.ok) return result

  revalidatePath("/admin/ae-inbox")
  revalidatePath(`/admin/buyers/${engagement.leads?.id ?? ""}`)
  return {
    ok: true,
    data: {
      token: result.data?.token ?? "",
      emailSent: result.data?.emailSent ?? false,
      emailError: result.data?.emailError,
    },
  }
}
