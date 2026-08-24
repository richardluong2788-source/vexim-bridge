import postgres from "postgres"

const sql = postgres(process.env.POSTGRES_URL, { ssl: "require" })

async function main() {
  const fromEmail = "regulatory.usagent@gmail.com"

  console.log("\n=== buyer_contacts matching", fromEmail, "===")
  const contacts = await sql`
    select id, lead_id, email, status
    from buyer_contacts
    where email ilike ${fromEmail}
  `
  console.log(contacts)

  console.log("\n=== leads named Flagstone ===")
  const leads = await sql`
    select id, company_name, industry
    from leads
    where company_name ilike '%flagstone%'
  `
  console.log(leads)

  if (leads.length > 0) {
    const leadId = leads[0].id
    console.log("\n=== buyer_engagements for lead", leadId, "===")
    const engs = await sql`
      select id, lead_id, account_manager_id, stage, created_at
      from buyer_engagements
      where lead_id = ${leadId}
      order by created_at desc
    `
    console.log(engs)

    console.log("\n=== opportunities for lead", leadId, "===")
    const opps = await sql`
      select *
      from opportunities
      where lead_id = ${leadId}
      order by last_updated desc
    `
    console.log(opps)

    console.log("\n=== all buyer_contacts for lead", leadId, "===")
    const allContacts = await sql`
      select id, lead_id, email, status
      from buyer_contacts
      where lead_id = ${leadId}
    `
    console.log(allContacts)
  }

  console.log("\n=== unmatched_inbound_emails from", fromEmail, "===")
  const unmatched = await sql`
    select id, from_email, to_emails, subject, received_at, reviewed_at, created_at
    from unmatched_inbound_emails
    where from_email ilike ${fromEmail}
    order by received_at desc
  `
  console.log(unmatched)

  console.log("\n=== buyer_replies from", fromEmail, "===")
  const replies = await sql`
    select id, from_email, opportunity_id, engagement_id, subject, received_at, match_source, match_confidence, is_unrecognized_sender
    from buyer_replies
    where from_email ilike ${fromEmail}
    order by received_at desc
  `
  console.log(replies)

  console.log("\n=== email_drafts recipient_email matching", fromEmail, "===")
  const drafts = await sql`
    select id, opportunity_id, engagement_id, recipient_email, email_type, status, smtp_message_id, resend_message_id, created_at
    from email_drafts
    where recipient_email ilike ${fromEmail}
    order by created_at desc
  `
  console.log(drafts)

  await sql.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
