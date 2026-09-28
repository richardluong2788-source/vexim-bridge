-- Refresh the seeded pilot's stored prompts to match the conversational
-- reference copy. This changes only future generation guidance; it does not
-- rewrite existing drafts, reject emails, or send anything.

UPDATE public.campaign_steps AS step
SET objective = copy.objective,
    ai_prompt_guidance = copy.guidance
FROM (VALUES
  (
    1,
    'Open with a modest filtering burden, explain Vietnam-side groundwork, and ask one question about current sourcing.',
    $guidance$EMAIL 1: Write 120-160 prose words, excluding the exact opt-out line and signature. Use a natural AE voice like the reference: "If you're responsible for sourcing, you're probably used to hearing from new suppliers. The problem usually isn't finding a supplier. It's deciding which ones are worth your team's time." Continue conversationally: each new source can involve reviewing company/product information and specifications, looking at available export information, discussing pricing, requesting samples, and reviewing relevant import requirements; much of the work can be screening rather than searching. Explain that Veximtrade handles the initial Vietnam-side groundwork before introductions. Say "review available information about capacity and export history"; never claim a guaranteed check or specific result not in BuyerContext. The buyer makes the final decision. Use one low-pressure question about their current sourcing situation or additional supply. No call/meeting ask. Use contact/company/category only from BuyerContext. Use "I came across [company] while..." only if source_of_personalization supports a real source. Vietnam is an additional source, not a replacement. No named U.S. regulator unless confirmed. End with exactly: If you'd rather not hear from me, just reply 'no thanks' and I won't contact you again.$guidance$
  ),
  (
    2,
    'Explain what Veximtrade does before introductions, and distinguish the service from a directory or supplier list.',
    $guidance$EMAIL 2: Begin with a natural continuation such as "Just wanted to clarify my last email a little." A short "Hope you're having a good day" is optional, not required. Explain plainly that Veximtrade is not a list buyers must filter themselves: the team handles initial Vietnam-side searching/screening, reviews available information about manufacturers, considers product fit and relevant requirements, then coordinates communication toward samples or quotations. Never claim unverified capacity, export history, certification, or a specific supplier outcome. A low-pressure line like "If you currently have a specific product in mind, feel free to send the details and I'll take a look" is allowed. Do not ask for a meeting. Avoid repeating Email 1's opening. End with exactly: If you'd rather not hear from me, just reply 'no thanks' and I won't contact you again.$guidance$
  ),
  (
    3,
    'Explain that repeating sourcing groundwork can add cost or delay product development; the buyer retains the final decision.',
    $guidance$EMAIL 3: Use direct, conversational language to explain that sourcing time is also part of the cost. If every new product starts from the beginning, reviewing suppliers and specifications, asking for quotations, requesting samples, and checking relevant requirements can become a significant burden in product development and add cost or delay a launch. Keep this conditional, not a claim about this buyer. Explain that Veximtrade can support the initial Vietnam-side groundwork; the buyer decides which supplier is suitable and whether to continue. Use a fresh opening and angle, no meeting ask, and one gentle invitation about a product only if suitable. End with exactly: If you'd rather not hear from me, just reply 'no thanks' and I won't contact you again.$guidance$
  ),
  (
    4,
    'Close the sequence warmly without pressure and leave the door open for future additional sourcing.',
    $guidance$EMAIL 4: Close warmly and plainly, e.g. "I won't keep following up if Vietnam sourcing isn't in your plans right now." Say no reply is needed and leave the door open if Vietnam becomes a relevant additional source later. A brief goodwill line is optional. Do not ask a question, request a meeting, suggest replacing current suppliers, or add exaggerated praise. Personalize only with supported BuyerContext. End with exactly: If you'd rather not hear from me, just reply 'no thanks' and I won't contact you again.$guidance$
  )
) AS copy(step_number, objective, guidance)
WHERE step.campaign_id = '00000000-0000-0000-0000-0000000000c1'
  AND step.step_number = copy.step_number;
