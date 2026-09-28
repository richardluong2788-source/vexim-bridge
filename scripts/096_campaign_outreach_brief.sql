-- ============================================================================
-- Migration 096: enforce the approved Veximtrade outreach brief for the US
-- Food Buyer pilot and schedule follow-ups in business days.
-- Apply through the project's migration process; creating this file does not
-- apply it to Supabase.
-- ============================================================================

ALTER TABLE public.campaign_steps
  ADD COLUMN IF NOT EXISTS delay_business_days integer;

UPDATE public.campaign_steps AS step
SET objective = new_copy.objective,
    ai_prompt_guidance = new_copy.guidance,
    delay_business_days = new_copy.delay_business_days
FROM (VALUES
  (
    1,
    'Open with a modest, concrete sourcing-filtering burden, then explain Veximtrade’s Vietnam-side groundwork and ask one question about the buyer’s current situation.',
    NULL,
    $guidance$EMAIL 1 — angle: the buyer's initial manufacturer/product/specification filtering burden. Write 90-130 prose words, excluding exact opt-out and signature. Begin with one modest operational situation (often/may/can), not a claimed fact about this buyer. Then explain Veximtrade's Vietnam-side groundwork: identify relevant manufacturers, screen available evidence about manufacturer status, capacity and export history, review product fit and relevant importing-country requirements, and coordinate communication toward samples, quotations or orders. The buyer makes the final decision. Suppliers may be mentioned only as part of this service, never as a supplier list or guaranteed outcome.
PERSONALIZATION: keep real BuyerContext context. Use the contact/company/product/category only if present. A research-source line is allowed only when source_of_personalization identifies an actual source; otherwise use a neutral company/category statement. If product is absent, use category. Never invent names, titles, facts, product, buyer need, or source. Never say the buyer/team is in Vietnam.
CTA: exactly one question about the buyer's current sourcing/supply situation. No call, meeting, chat, referral, or forward request. Vietnam is an additional source, not a replacement. Refer generically to relevant import requirements; no named laws/agencies without confirmation. Include the exact required opt-out line: If you'd rather not hear from me, just reply 'no thanks' and I won't contact you again.$guidance$
  ),
  (
    2,
    'Explain Veximtrade’s Vietnam-side groundwork before introductions; distinguish the service from a directory or supplier list.',
    4,
    $guidance$EMAIL 2 — angle: what Veximtrade does before introducing a relevant manufacturer. Explain the groundwork plainly: identify manufacturers, screen available evidence about factory status/capacity/export history, review product fit and relevant importing-country requirements, and coordinate communication. The buyer decides whether to proceed. No promised suppliers, outcome, certification or specific verification result. Retain BuyerContext personalization and use a research-source line only when source_of_personalization gives a real source; otherwise use a neutral, supported company/category statement. No fabricated names, titles, facts, products, or buyer intent. No meeting ask. Vietnam is an additional source, never a replacement. Include the exact required opt-out line: If you'd rather not hear from me, just reply 'no thanks' and I won't contact you again.$guidance$
  ),
  (
    3,
    'Explain that repeating sourcing groundwork for each new product can add sourcing cost or delay product development; buyer retains the final decision.',
    5,
    $guidance$EMAIL 3 — angle: repeated groundwork can consume time, add sourcing cost, or delay product development when starting with a new product. State this modestly and conditionally, without statistics or claims about this buyer. Explain that Veximtrade can handle the Vietnam-side identification, screening, fit/requirements review and communication groundwork; the buyer decides whether a supplier is suitable and whether to proceed. Use a distinct opening and subject from earlier emails. Keep real BuyerContext personalization, with no invented facts/names/titles/products/intent. No meeting ask. Mention importing requirements generically unless confirmed. Vietnam is an additional source, not a replacement. Include the exact required opt-out line: If you'd rather not hear from me, just reply 'no thanks' and I won't contact you again.$guidance$
  ),
  (
    4,
    'Close the sequence without pressure; leave the door open if Vietnam becomes a relevant additional source later.',
    5,
    $guidance$EMAIL 4 — distinct, low-pressure close. Say this is the last note for now and no reply is needed. Leave the door open if the buyer later wants to consider Vietnam as an additional source. Do not force a choice, ask a question, request a meeting, or suggest replacing current suppliers. Only use facts and personalization present in BuyerContext; a research-source line requires explicit source_of_personalization, and no names/titles/products/needs may be invented. Refer generically to relevant importing-country requirements. Include the exact required opt-out line: If you'd rather not hear from me, just reply 'no thanks' and I won't contact you again.$guidance$
  )
) AS new_copy(step_number, objective, delay_business_days, guidance)
WHERE step.campaign_id = '00000000-0000-0000-0000-0000000000c1'
  AND step.step_number = new_copy.step_number;
