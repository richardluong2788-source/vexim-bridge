import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/card"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { getDictionary } from "@/lib/i18n/server"
import { LeadCard } from "@/components/client/lead-card"

export default async function ClientLeadsPage() {
  const supabase = await createClient()
  const { t, locale } = await getDictionary()
  const dateLocale = locale === "vi" ? "vi-VN" : "en-US"

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // R-07 — read from the DB-level masked view instead of raw leads.
  // Fields like contact_email are NULL in the network payload unless the
  // deal has already shipped or been won, which prevents the client from
  // reading buyer PII via browser devtools during pre-commit stages.
  const { data: rows } = await supabase
    .from("client_leads_masked")
    .select(
      `
      opportunity_id,
      stage,
      potential_value,
      buyer_code,
      products_interested,
      quantity_required,
      target_price_usd,
      price_unit,
      incoterms,
      payment_terms,
      destination_port,
      target_close_date,
      next_step,
      client_action_required,
      last_updated,
      created_at,
      lead_id,
      company_name,
      industry,
      region,
      website,
      linkedin_url,
      contact_person,
      contact_email,
      contact_phone
    `,
    )
    .eq("client_id", user!.id)
    .order("last_updated", { ascending: false })

  const list = rows ?? []

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-8">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">{t.client.leads.title}</h1>
        <p className="text-sm text-muted-foreground mt-1 text-pretty">
          {t.client.leads.subtitle}
        </p>
      </header>

      {list.length === 0 ? (
        <Card className="border-border">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{t.client.leads.empty}</EmptyTitle>
              <EmptyDescription>{t.client.leads.emptyDesc}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {list.map((row) => {
            // Reshape masked-view row into the {opportunity, lead} props.
            // The view has already set contact_* fields to NULL for stages
            // below "shipped" so no PII can leak through the network payload.
            const stageLabel =
              t.kanban.stages[row.stage as keyof typeof t.kanban.stages] ?? row.stage
            const lead = {
              // Fallback to buyer_code when company_name is masked so the
              // LeadCard header still has a string to render.
              company_name: row.company_name ?? (row.buyer_code ?? ""),
              industry: row.industry ?? null,
              region: row.region ?? null,
              website: row.website ?? null,
              linkedin_url: row.linkedin_url ?? null,
              contact_person: row.contact_person ?? null,
              contact_email: row.contact_email ?? null,
              contact_phone: row.contact_phone ?? null,
            }

            return (
              <LeadCard
                key={row.opportunity_id}
                opportunity={{
                  id: row.opportunity_id,
                  stage: row.stage,
                  potential_value: row.potential_value,
                  buyer_code: row.buyer_code,
                  products_interested: row.products_interested,
                  quantity_required: row.quantity_required,
                  target_price_usd: row.target_price_usd,
                  price_unit: row.price_unit,
                  incoterms: row.incoterms,
                  payment_terms: row.payment_terms,
                  destination_port: row.destination_port,
                  target_close_date: row.target_close_date,
                  next_step: row.next_step,
                  client_action_required: row.client_action_required,
                  last_updated: row.last_updated,
                  created_at: row.created_at,
                }}
                lead={lead}
                stageLabel={stageLabel}
                dateLocale={dateLocale}
                t={t.client.leads}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
