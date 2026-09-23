# Locale URLs, SEO and catalog caching

What shipped with the `/en` + `/vi` pass, and the deliberate limits of it.
Audience: whoever deploys Vexim on Vercel and whoever touches a public page.

## 1. URL scheme: prefixes are "as-needed"

| URL | Serves | Notes |
| --- | --- | --- |
| `/`, `/products`, `/products/<id>`, `/profile/<slug>` | English | `DEFAULT_LOCALE` (`lib/i18n/config.ts`) is `en`, so the default locale keeps the unprefixed path. **No existing link, email template or QR code has to move.** |
| `/vi`, `/vi/products`, … | Vietnamese | Rewritten by `middleware.ts` onto the same route, with `x-vx-locale: vi` handed to the render pass. |
| `/en/products` | → 307 `/products` | One document, one URL. `/en` never renders. |
| `/vi/admin/users` | 404 | A locale prefix may not widen what the public rules allow. |

Only pages that genuinely exist in both languages are advertised as a pair in
`hreflang` (landing page and `/products`). Single-language pages — the product
detail page and `/profile/<slug>` are written for US buyers and exist in English
only — canonicalize to the unprefixed URL, so `/vi/products/<id>` collapses onto
`/products/<id>` instead of becoming a duplicate.

Flipping the whole app to always-prefixed URLs is `LOCALE_PREFIXES[DEFAULT_LOCALE] = "/en"`
in `lib/i18n/routing.ts` plus a redirect for the old root. Nothing else needs to change.

## 2. Deploy requirement: `NEXT_PUBLIC_SITE_URL`

Every canonical, `hreflang`, OG URL and `sitemap.xml`/`robots.txt` URL is built from
`siteConfig.url`, which resolves `NEXT_PUBLIC_SITE_URL` → `VERCEL_PROJECT_PRODUCTION_URL`
→ `http://localhost:3000`. **Until it is set in Vercel (Production + Preview), a
production page publishes `localhost:3000` as its canonical URL**, which is worse than
having no canonical at all. It must be the exact scheme+host you want indexed
(`https://veximtrade.com`, no trailing slash).

## 3. What is cached, and what is not

* Public paths in `PUBLIC_SEGMENTS` (`lib/i18n/routing.ts`) skip `updateSession`
  entirely, so an anonymous catalog view no longer pays a `auth.getUser()` round-trip.
* The catalog reads (`/products` index, its metadata, the product page's loader,
  the sitemap's URL list) go through `unstable_cache(…, { revalidate: 300, tags: ["catalog"] })`
  and use `createAdminClient()`, i.e. **no cookies** — required for any of this to be
  cacheable, and it makes the page identical for a crawler, a supplier and an AE.
* Those tags are busted by `revalidateCatalog()` (`lib/catalog/cache.ts`) in the admin
  and client product actions and in `publishProfile` / `unpublishProfile`, so a save
  shows up on the same click instead of up to 5 minutes later.
* Visibility is enforced in the queries, not by RLS: `status = 'active'` plus
  `client_profiles.is_published = true`. With the service-role client those two
  predicates **are** the security boundary — keep them when editing either page, and
  never widen a public `select` by joining `profiles` beyond `(id, company_name)`.

`export const revalidate` on a route is still a no-op: `app/layout.tsx` awaits
`getLocale()` (cookies/headers), which makes every route dynamic. Full CDN-level
caching needs a marketing route group with its own cookie-free layout, e.g.
`app/(marketing)/{layout.tsx,products,…}` rendering `<html lang>` from the locale
header only. That is the next step, and it is a file move, not a rewrite.

Because the HTML now depends on the request's locale, do **not** add a
`Vary`-less CDN rule for these paths; if you ever cache them at the edge, include
`Vary: Cookie` or key on the path prefix.

## 4. Indexing hygiene

* `app/sitemap.ts` lists the landing page (both locales), `/products` (both locales),
  every active product of every published supplier (cap 900) and every published
  profile (cap 400), hourly, and falls back to the static floor if the DB is
  unreachable so a build never fails.
* `app/robots.ts` disallows the session-only surfaces and the token pages, derived
  from the same `PRIVATE_SEGMENTS` / `NOINDEX_SEGMENTS` lists.
* `/share/<token>`, `/shortlist/<token>`, `/invoice/<token>`, `/unsubscribe/<token>`
  emit `<meta robots noindex>` as well — a robots rule is advisory, the meta tag is not.
* `/api/products/search` no longer returns `profiles.email` or `profiles.fda_registration_number`
  to anonymous callers (only to a signed-in one), and its `limit` is clamped to 100.

## 5. Still open (in rough order of value)

1. Marketing route group with a cookie-free layout → real `revalidate` / ISR (above).
2. Translate the product detail page and the supplier profile into the dictionary, then
   mark them `bilingual` so `/vi/products/<id>` becomes a real page instead of a
   canonical collapse.
3. `next.config.mjs`: `images.unoptimized: true` costs the catalog its Largest Contentful
   Paint. Before turning it off, add `remotePatterns` for the Supabase storage host and
   the CDN that fronts it.
4. `typescript.ignoreBuildErrors: true` is still on and cannot be turned off until the
   hand-written `lib/supabase/types.ts` is replaced by a generated one (363 project-wide
   type errors today, almost all from that file).
5. GA4 / Meta pixel and a cookie-consent banner: the marketing pages currently load only
   Vercel Analytics.
6. `/api/products/search` still lists active products of suppliers whose profile is
   unpublished (the catalog pages do not). It has no in-app consumer, so aligning it is a
   behaviour change for external callers — decide deliberately.
