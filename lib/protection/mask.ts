import type { Stage } from "@/lib/supabase/types"

/**
 * Layered disclosure rules for buyer identity on the client-facing portal.
 *
 * The goal is to prevent disintermediation (client contacting the buyer directly
 * and bypassing VXB commission) while still giving the client enough context to
 * trust the work being done.
 *
 * Disclosure levels:
 *   - level 1 (default, early stages): only anonymous code + industry + region
 *   - level 2 (price_agreed onwards):  company name becomes visible, contact info still hidden
 *   - level 3 (shipped+/won):           full contact info visible (deal is closed / commission locked)
 *
 * NOTE: this is a UI-side safeguard. Server queries and RLS should also enforce
 * that sensitive columns never reach the client bundle for early-stage leads.
 */

export type DisclosureLevel = 1 | 2 | 3

const LEVEL_2_STAGES: ReadonlyArray<Stage> = ["price_agreed", "production", "shipped", "won"]
const LEVEL_3_STAGES: ReadonlyArray<Stage> = ["shipped", "won"]

export function disclosureLevelFor(stage: Stage): DisclosureLevel {
  if (LEVEL_3_STAGES.includes(stage)) return 3
  if (LEVEL_2_STAGES.includes(stage)) return 2
  return 1
}

export interface MaskedBuyer {
  /** Always safe to show. Code like "US-1042" replaces the buyer's real company name at level 1. */
  displayName: string
  /** Only present at level >= 2. */
  revealedCompanyName: string | null
  industry: string | null
  /** Broad region such as "California, US" - safe to show at all levels. */
  region: string | null
  /** Only present at level 3. */
  website: string | null
  /** Only present at level 3. */
  linkedinUrl: string | null
  /** Only present at level 3. */
  contactPerson: string | null
  /** Only present at level 3. */
  contactEmail: string | null
  /** Only present at level 3. */
  contactPhone: string | null
  level: DisclosureLevel
}

interface LeadInput {
  company_name: string
  industry: string | null
  region: string | null
  website: string | null
  linkedin_url: string | null
  contact_person: string | null
  contact_email: string | null
  contact_phone: string | null
}

/**
 * NOTE: `buyer_code` lives on the **opportunity** (not the lead), so the caller
 * passes it explicitly. This keeps the mask pure and easy to test regardless
 * of where the code originates.
 */
export function maskBuyer(
  lead: LeadInput,
  stage: Stage,
  buyerCode: string | null,
): MaskedBuyer {
  const level = disclosureLevelFor(stage)
  const code = buyerCode ?? "US-XXXX"

  return {
    displayName: level >= 2 ? lead.company_name : code,
    revealedCompanyName: level >= 2 ? lead.company_name : null,
    industry: lead.industry,
    region: lead.region,
    website: level >= 3 ? lead.website : null,
    linkedinUrl: level >= 3 ? lead.linkedin_url : null,
    contactPerson: level >= 3 ? lead.contact_person : null,
    contactEmail: level >= 3 ? lead.contact_email : null,
    contactPhone: level >= 3 ? lead.contact_phone : null,
    level,
  }
}
