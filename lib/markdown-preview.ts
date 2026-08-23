/**
 * Strips Markdown syntax down to plain text for compact previews (list/card
 * views) where we truncate with line-clamp instead of rendering full
 * formatted Markdown. Full formatting is rendered separately via
 * `ProductMarkdown` on detail pages.
 */
export function markdownToPlainText(markdown: string): string {
  return markdown
    // headings: "### Title" -> "Title"
    .replace(/^#{1,6}\s+/gm, '')
    // bold/italic/strikethrough markers
    .replace(/(\*\*\*|___)(.*?)\1/g, '$2')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    // links: [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // list markers: "- item" / "1. item" -> "item"
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    // blockquote markers
    .replace(/^>\s?/gm, '')
    // inline code
    .replace(/`([^`]+)`/g, '$1')
    // collapse newlines/whitespace into single spaces for a one-block preview
    .replace(/\s+/g, ' ')
    .trim()
}
