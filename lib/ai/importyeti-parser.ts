/**
 * ImportYeti AI parser.
 *
 * Strategy ("Phương án A — Manual Paste + AI Parser"):
 *   - The admin opens importyeti.com IN THEIR OWN browser, finds a buyer
 *     they want, and copies the page text (Ctrl+A → Ctrl+C). They paste it
 *     into our admin UI.
 *   - We send that pasted text to GPT-4o-mini via the Vercel AI Gateway
 *     and ask it to extract a strict, structured array of buyers.
 *   - This avoids scraping ImportYeti server-side (which violates their ToS
 *     and is blocked by Cloudflare) while still giving the admin huge
 *     leverage: 200 buyers parsed per minute instead of typed by hand.
 *
 * The schema below is the source of truth for what we extract. The Zod
 * schema is enforced both at the AI boundary (structured output) AND when
 * the actions layer commits to Postgres.
 */

import "server-only"
import { generateText, Output } from "ai"
import { z } from "zod"

// ---------------------------------------------------------------------------
// Output schema — kept tight. Every field is optional/nullable because
// ImportYeti pages vary wildly (some buyers have HS codes, some don't).
// ---------------------------------------------------------------------------

export const ImportYetiSupplierSchema = z.object({
  name: z
    .string()
    .describe("Supplier company name as displayed on ImportYeti."),
  country: z
    .string()
    .nullable()
    .describe(
      "Country of the supplier (e.g. 'Vietnam', 'China'). Null if not shown.",
    ),
})

export const ImportYetiBuyerSchema = z.object({
  companyName: z
    .string()
    .describe("Buyer / importer company name. Required."),
  country: z
    .string()
    .nullable()
    .describe("Country of the buyer (usually 'United States'). Null if absent."),
  importAddress: z
    .string()
    .nullable()
    .describe(
      "Postal address of the buyer as listed on the customs records. Null if not shown.",
    ),
  website: z
    .string()
    .nullable()
    .describe("Buyer's website URL if shown anywhere on the page. Null otherwise."),
  productKeywords: z
    .array(z.string())
    .describe(
      "Free-text product / category keywords describing what the buyer imports (e.g. 'frozen shrimp', 'seafood'). Empty array if none.",
    ),
  hsCodes: z
    .array(z.string())
    .describe(
      "Harmonized Tariff codes (HS codes) found on the page, as raw strings. Empty array if none.",
    ),
  shipmentCount12mo: z
    .number()
    .int()
    .nullable()
    .describe(
      "Approximate number of customs shipments / Bills of Lading filed by this buyer in the trailing 12 months. Null if not shown.",
    ),
  importPorts: z
    .array(z.string())
    .describe(
      "US ports the buyer imports through (e.g. 'Long Beach', 'Los Angeles'). Empty array if none.",
    ),
  topSuppliers: z
    .array(ImportYetiSupplierSchema)
    .describe(
      "Top suppliers the buyer is currently using. Cap at 10 even if the page lists more. Empty array if none shown.",
    ),
  sourceRef: z
    .string()
    .nullable()
    .describe(
      "ImportYeti URL or company slug if visible in the pasted text (e.g. '/company/acme-foods'). Null otherwise.",
    ),
})

export type ImportYetiBuyer = z.infer<typeof ImportYetiBuyerSchema>
export type ImportYetiSupplier = z.infer<typeof ImportYetiSupplierSchema>

const outputSchema = z.object({
  buyers: z
    .array(ImportYetiBuyerSchema)
    .describe(
      "All distinct buyer companies extracted from the pasted text. Empty if the text contains no buyer data.",
    ),
})

// ---------------------------------------------------------------------------
// Hard cap so an over-eager paste doesn't blow up the AI Gateway bill.
// ImportYeti free tier shows 5–25 buyers per page; paid tier ~50. 200 is a
// generous ceiling that still fits comfortably in gpt-4o-mini's context.
// ---------------------------------------------------------------------------
const MAX_INPUT_CHARS = 60_000

export class ImportYetiParserError extends Error {
  constructor(
    message: string,
    public code:
      | "input_too_long"
      | "input_empty"
      | "ai_failed"
      | "no_buyers_found",
  ) {
    super(message)
    this.name = "ImportYetiParserError"
  }
}

/**
 * Run the AI parser. Throws ImportYetiParserError on validation failures
 * so the actions layer can surface a clean error code to the UI.
 */
export async function parseImportYetiText(input: string): Promise<{
  buyers: ImportYetiBuyer[]
  inputCharCount: number
}> {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new ImportYetiParserError("Input is empty", "input_empty")
  }
  if (trimmed.length > MAX_INPUT_CHARS) {
    throw new ImportYetiParserError(
      `Input exceeds ${MAX_INPUT_CHARS} characters`,
      "input_too_long",
    )
  }

  const system = [
    "You are a customs-trade-data extractor.",
    "The user pastes the visible text from an ImportYeti page (https://www.importyeti.com).",
    "Your job is to extract every distinct US importer / buyer company and return it as structured JSON.",
    "",
    "STRICT RULES:",
    "1. Extract ONLY data that is literally visible in the pasted text. NEVER invent fields.",
    "2. If a field is not in the text, return null (or [] for array fields) — do NOT guess.",
    "3. Companies that appear ONLY in the 'Top Suppliers' / 'Suppliers' section are SUPPLIERS, not buyers — do NOT add them as buyers.",
    "4. The buyer is usually shown as the page subject (e.g. 'Acme Foods Inc — US Import & Buyer Data'). There is typically only ONE buyer per page, but if the user pasted a search-results page, multiple buyers may appear.",
    "5. Normalise the buyer's country to a full English name ('United States', not 'US').",
    "6. For shipmentCount12mo, parse digits from phrases like '127 shipments in last 12 months' and return the integer.",
    "7. Cap topSuppliers at 10 entries (most strategically relevant ones).",
    "8. Skip duplicate suppliers (same name).",
    "9. If the pasted text is not from ImportYeti or contains no buyer data, return an empty buyers array.",
  ].join("\n")

  const userPrompt = [
    "Pasted text from ImportYeti:",
    "----- BEGIN PASTE -----",
    trimmed,
    "----- END PASTE -----",
    "",
    "Extract every buyer company into the structured `buyers` array.",
  ].join("\n")

  let generated: z.infer<typeof outputSchema>
  try {
    const result = await generateText({
      model: "openai/gpt-4o-mini",
      system,
      prompt: userPrompt,
      experimental_output: Output.object({ schema: outputSchema }),
    })
    generated = result.experimental_output
  } catch (err) {
    console.error("[v0] ImportYeti AI parse failed:", err)
    throw new ImportYetiParserError(
      err instanceof Error ? err.message : "AI Gateway call failed",
      "ai_failed",
    )
  }

  const buyers = generated.buyers ?? []
  if (buyers.length === 0) {
    throw new ImportYetiParserError(
      "AI returned no buyers from the pasted text",
      "no_buyers_found",
    )
  }

  return { buyers, inputCharCount: trimmed.length }
}
