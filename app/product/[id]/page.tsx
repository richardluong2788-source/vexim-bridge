import { redirect } from "next/navigation"

/**
 * `/product/[id]` was a near-verbatim copy of `/products/[id]` (same queries,
 * same layout, drifted only by a couple of sections) and nothing in the app
 * linked to it — `components/profile/profile-products.tsx` and the AE product
 * picker both build `/products/<id>`. The duplicate page is gone; this shim
 * keeps links that were already pasted into emails or chats from 404ing.
 *
 * The redirect is temporary (307, not 308) on purpose: browsers cache 308s for
 * years, and the public URL layout is still moving while the `/en` + `/vi`
 * locale tree is being built.
 *
 * Query params are forwarded verbatim because `?ref=` carries the quote-request
 * attribution (base64 opportunity id) that the page decodes.
 */
export default async function LegacyProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const query = await searchParams

  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    const single = Array.isArray(value) ? value[0] : value
    if (typeof single === "string" && single.length > 0) search.set(key, single)
  }

  const suffix = search.toString()
  redirect(`/products/${id}${suffix ? `?${suffix}` : ""}`)
}
