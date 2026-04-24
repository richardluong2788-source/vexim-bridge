/**
 * Extract H2 / H3 headings from a markdown source for the table of
 * contents. We keep this tiny and regex-based instead of pulling a full
 * parser — good enough for our editorial content and runs on the server.
 *
 * The slugify() we export MUST match the one used by the renderer to add
 * `id` attributes to headings, otherwise anchor links will 404.
 */
import { slugify } from "./types"

export interface TocEntry {
  level: 2 | 3
  text: string
  id: string
}

/**
 * Normalize a heading to a URL-safe anchor. Re-uses our Vietnamese-aware
 * slugify() so Vietnamese diacritics get folded the same way in both the
 * rendered heading id and the TOC link.
 */
export function headingSlug(text: string): string {
  return slugify(text) || "section"
}

/**
 * Parse a markdown string and return the ordered list of h2/h3 headings.
 * Ignores headings inside fenced code blocks.
 */
export function extractToc(md: string): TocEntry[] {
  if (!md) return []

  const lines = md.split(/\r?\n/)
  const out: TocEntry[] = []
  const counts = new Map<string, number>()
  let inFence = false

  for (const raw of lines) {
    const line = raw.trimStart()
    if (line.startsWith("```") || line.startsWith("~~~")) {
      inFence = !inFence
      continue
    }
    if (inFence) continue

    const match = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line)
    if (!match) continue

    const level = match[1].length === 2 ? 2 : 3
    // Strip inline markdown (bold/italic/code/links) from display text
    const text = match[2]
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      .trim()

    if (!text) continue

    const base = headingSlug(text)
    const n = counts.get(base) ?? 0
    counts.set(base, n + 1)
    const id = n === 0 ? base : `${base}-${n}`

    out.push({ level: level as 2 | 3, text, id })
  }

  return out
}
