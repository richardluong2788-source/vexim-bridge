/**
 * Renders a schema.org JSON-LD block.
 *
 * `JSON.stringify` alone is not enough inside a `<script>` element: a supplier
 * who writes `</script>` into their product description would close the tag and
 * execute the rest. Escaping the angle brackets to their unicode escapes (< and
 * >) keeps the payload valid JSON while removing that ability, so these blocks are
 * safe even when every value in them is user-authored (product names, supplier
 * display names, descriptions).
 */
export function JsonLd({ data, id }: { data: unknown; id?: string }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e")
  return (
    <script
      type="application/ld+json"
      {...(id ? { id } : {})}
      dangerouslySetInnerHTML={{ __html: json }}
    />
  )
}
