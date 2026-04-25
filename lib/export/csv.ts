/**
 * Lightweight CSV serializer used by /api/export/* route handlers.
 *
 * Why hand-rolled
 * ---------------
 * We deliberately avoid pulling in `xlsx` or `papaparse`:
 *   - `xlsx` ships > 600 kB of JS and we only need a flat tabular dump.
 *   - `papaparse` is for parsing; serialization is a 30-line problem.
 *
 * Compatibility
 * -------------
 *   - We prepend the UTF-8 BOM (`\uFEFF`). Excel auto-detects encoding
 *     when the BOM is present; without it Excel mangles Vietnamese
 *     diacritics. Numbers/Sheets/LibreOffice ignore the BOM, so this is
 *     safe across the board.
 *   - We use CRLF line terminators per RFC 4180.
 *   - We always quote fields. Cheaper than scanning every cell for
 *     special characters and produces identical output every run.
 */

export type CsvCell = string | number | boolean | null | undefined | Date

export interface CsvColumn<Row> {
  /** Column header rendered on row 1. */
  header: string
  /** Extractor — return any primitive; we'll stringify it. */
  value: (row: Row) => CsvCell
}

const BOM = "\uFEFF"
const CRLF = "\r\n"

/** Quote a single field per RFC 4180. Always wraps in double quotes. */
function quote(raw: CsvCell): string {
  if (raw === null || raw === undefined) return '""'
  let s: string
  if (raw instanceof Date) {
    s = Number.isNaN(raw.getTime()) ? "" : raw.toISOString()
  } else if (typeof raw === "number") {
    s = Number.isFinite(raw) ? String(raw) : ""
  } else if (typeof raw === "boolean") {
    s = raw ? "true" : "false"
  } else {
    s = String(raw)
  }
  // Escape internal double quotes by doubling them.
  return `"${s.replace(/"/g, '""')}"`
}

/**
 * Build a CSV string from a row collection + column definitions.
 *
 * @example
 *   const csv = toCsv(clients, [
 *     { header: "Email",   value: c => c.email },
 *     { header: "Created", value: c => c.created_at },
 *   ])
 */
export function toCsv<Row>(rows: Row[], columns: CsvColumn<Row>[]): string {
  const headerLine = columns.map((c) => quote(c.header)).join(",")
  const bodyLines = rows.map((r) =>
    columns.map((c) => quote(c.value(r))).join(","),
  )
  return BOM + [headerLine, ...bodyLines].join(CRLF) + CRLF
}

/**
 * Build a `Content-Disposition` header value with a UTF-8 filename.
 * Safari strips non-ASCII from `filename=...`, so we add `filename*=UTF-8''…`
 * which all modern browsers honour.
 */
export function attachmentHeader(filename: string): string {
  // Sanitise: strip control chars + double quotes that would escape the header.
  // eslint-disable-next-line no-control-regex
  const safe = filename.replace(/[\x00-\x1f"\\]/g, "_")
  const encoded = encodeURIComponent(safe).replace(/['()]/g, escape)
  return `attachment; filename="${safe}"; filename*=UTF-8''${encoded}`
}

/**
 * Compose the Headers object every CSV route handler returns.
 * Centralised so cache-control + content-type stay consistent.
 */
export function csvResponseHeaders(filename: string): HeadersInit {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": attachmentHeader(filename),
    "Cache-Control": "no-store",
  }
}
