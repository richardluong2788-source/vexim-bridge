/**
 * Sprint D — Apollo.io enrichment helper.
 *
 * We call Apollo's People Enrichment endpoint to resolve an email or a
 * (first_name, last_name, company_domain) triple into a richer record.
 * The caller passes either:
 *   - { email }
 *   - { firstName, lastName, companyDomain }
 *
 * If APOLLO_API_KEY isn't set, or the API fails, we return null so the
 * importer falls back to raw admin input. This keeps the flow resilient.
 *
 * Docs: https://docs.apollo.io/reference/people-enrichment
 */

export type ApolloEnrichInput =
  | { email: string }
  | { firstName?: string; lastName?: string; companyDomain?: string; companyName?: string }

export type ApolloEnrichResult = {
  email: string | null
  firstName: string | null
  lastName: string | null
  title: string | null
  linkedinUrl: string | null
  phone: string | null
  companyName: string | null
  companyWebsite: string | null
  companyIndustry: string | null
  companyCountry: string | null
  raw: Record<string, unknown>
}

function isConfigured() {
  return Boolean(process.env.APOLLO_API_KEY)
}

export async function enrichPersonWithApollo(
  input: ApolloEnrichInput,
): Promise<ApolloEnrichResult | null> {
  if (!isConfigured()) return null

  const body: Record<string, unknown> = { reveal_personal_emails: false }
  if ("email" in input) {
    body.email = input.email
  } else {
    if (input.firstName) body.first_name = input.firstName
    if (input.lastName) body.last_name = input.lastName
    if (input.companyDomain) body.domain = input.companyDomain
    if (input.companyName) body.organization_name = input.companyName
  }

  try {
    const res = await fetch("https://api.apollo.io/v1/people/match", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": process.env.APOLLO_API_KEY as string,
      },
      body: JSON.stringify(body),
      // Apollo can be slow; cap it so the server action doesn't hang.
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      console.error("[v0] Apollo enrichment non-2xx", res.status)
      return null
    }

    const json = (await res.json()) as { person?: Record<string, unknown> }
    const p = json.person
    if (!p) return null

    const org = (p.organization as Record<string, unknown> | undefined) ?? {}

    return {
      email: (p.email as string | undefined) ?? null,
      firstName: (p.first_name as string | undefined) ?? null,
      lastName: (p.last_name as string | undefined) ?? null,
      title: (p.title as string | undefined) ?? null,
      linkedinUrl: (p.linkedin_url as string | undefined) ?? null,
      phone:
        ((p.phone_numbers as Array<{ sanitized_number?: string }> | undefined) ??
          [])[0]?.sanitized_number ?? null,
      companyName: (org.name as string | undefined) ?? null,
      companyWebsite: (org.website_url as string | undefined) ?? null,
      companyIndustry: (org.industry as string | undefined) ?? null,
      companyCountry: (org.country as string | undefined) ?? null,
      raw: p,
    }
  } catch (err) {
    console.error("[v0] Apollo enrichment threw", err)
    return null
  }
}

export function apolloConfigured(): boolean {
  return isConfigured()
}
