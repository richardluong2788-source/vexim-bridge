# Locale URLs, SEO, caching and images

What shipped with the `/en` + `/vi` pass and the static-shell pass after it, and
the deliberate limits of both. Audience: whoever deploys Vexim on Vercel and
whoever touches a public page.

## 1. URL scheme: prefixes are "as-needed"

| URL | Serves | Notes |
| --- | --- | --- |
| `/`, `/products`, `/products/<id>`, `/profile/<slug>` | English | `DEFAULT_LOCALE` (`lib/i18n/config.ts`) is `en`, so the default locale keeps the unprefixed path. **No existing link, email template or QR code has to move.** |
| `/vi`, `/vi/products`, … | Vietnamese | Rewritten by `middleware.ts` onto the same route, with `x-vx-locale: vi` handed to the render pass and the choice mirrored into the `esh_locale` cookie. |
| `/en/products` | → 307 `/products` | One document, one URL. `/en` never renders. |
| `/vi/admin/users` | 404 | A locale prefix may not widen what the public rules allow. |

Only pages that genuinely exist in both languages are advertised as a pair in
`hreflang` (landing page and `/products`). Single-language pages — the product
detail page and `/profile/<slug>` are written for US buyers and exist in English
only — canonicalize to the unprefixed URL, so `/vi/products/<id>` collapses onto
`/products/<id>` instead of becoming a duplicate. Those two documents declare
`<main lang="en">` explicitly, so the Vietnamese URL never implies Vietnamese copy.

Flipping the whole app to always-prefixed URLs is `LOCALE_PREFIXES[DEFAULT_LOCALE] = "/en"`
in `lib/i18n/routing.ts` plus a redirect for the old root. Nothing else needs to change.

## 2. Deploy requirement: `NEXT_PUBLIC_SITE_URL`

Every canonical, `hreflang`, OG URL and `sitemap.xml`/`robots.txt` URL is built from
`siteConfig.url`, which resolves `NEXT_PUBLIC_SITE_URL` → `VERCEL_PROJECT_PRODUCTION_URL`
→ `http://localhost:3000`. **Until it is set in Vercel (Production + Preview), a
production page publishes `localhost:3000` as its canonical URL**, which is worse than
having no canonical at all. It must be the exact scheme+host you want indexed
(`https://veximtrade.com`, no trailing slash).

## 3. The static shell, and what that buys

`app/layout.tsx` reads **no** `cookies()` and no `headers()`. That is the whole
trick: while the root layout awaited `getLocale()`, every route in the app was
dynamic and no amount of `export const revalidate` changed that. With the shell
static, Next can prerender and the CDN can serve:

| Route | Build output | Why |
| --- | --- | --- |
| `/products/<id>`, `/profile/<slug>` | `●` SSG + ISR (`revalidate = 300`) | `generateStaticParams()` warms the freshest 200 products / 200 published profiles; anything else renders on first request and is cached from then on. |
| `/legal`, `/legal/<policy>`, `/robots.txt`, `/sitemap.xml` | `○` static | Locale-independent (the legal pages are Vietnamese by design) and revalidated hourly for the sitemap. |
| `/`, `/products` | `ƒ` dynamic | The landing page and the catalog index resolve the visitor's locale and read live aggregates; `/products` also takes `?category=` / `?q=` / `?page=`, and reading `searchParams` is itself a per-request API. |
| everything under `/admin`, `/client`, `/settings`, `/<token>` | `ƒ` dynamic | Session-scoped. |

Measured on `next start` against this build (sandbox, database unreachable):

```
GET /products/p1        → x-nextjs-cache: MISS → HIT, Cache-Control: s-maxage=300, stale-while-revalidate=31535700
GET /profile/<slug>     → same
GET /products           → Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
GET /legal              → x-nextjs-cache: HIT, Cache-Control: s-maxage=31536000
```

So a US buyer's second hop to a product page is a CDN hit, not a function
invocation, and a publish/save is visible immediately anyway: `revalidateCatalog()`
(`lib/catalog/cache.ts`) busts the tag the page rendered with, which drops both the
data cache and the prerendered document.

**The invariant to keep.** Never call `cookies()`, `headers()`,
`await getLocale()`/`getDictionary()` — or read a search param — in
`app/layout.tsx`, or in any component it renders. Every one of those makes the
entire app dynamic again, silently.

Consequences of a locale-free shell, and where they are handled:

* `<html lang>` in the cached shell is the default locale. `LanguageProvider`
  (`components/i18n/language-provider.tsx`) settles on the URL prefix first
  (`/vi/...` is Vietnamese by construction), then the cookie, and syncs `lang` on
  mount — so hydration matches what the server rendered instead of correcting
  itself a frame later.
* Localized *client* components on a route that is dynamic anyway get the locale
  from a nested provider instead: see `app/auth/layout.tsx`, which marks the
  sign-in pages `force-dynamic` and passes `initialLocale`, so a Vietnamese
  supplier never sees English labels on the login form.
* Tracking links still attribute quotes: `/products/<id>?ref=<base64 opportunity id>`
  is now decoded inside the quote dialog
  (`components/product/use-quote-opportunity-ref.ts`) instead of in the page, which
  is what lets the page be a static document. The dialog supplies its own
  `<Suspense>` boundary.

Caching rules to write (or not to write):

* `/products/<id>`, `/profile/<slug>`, `/legal*` are cookie- and locale-independent.
  They are safe to cache at the edge with no `Vary`.
* `/` and `/products` change with the visitor's locale. Do not add a `Vary`-less CDN
  rule for those two paths; either leave them alone (default) or key on
  `x-vx-locale`/the cookie. Custom `headers` in `next.config.mjs` are still the open
  item — see §5.

## 4. Indexing hygiene

* `app/sitemap.ts` lists the landing page (both locales), `/products` (both locales),
  every active product of every published supplier (cap 900) and every published
  profile (cap 400), hourly, and falls back to the static floor if the DB is
  unreachable so a build never fails. Same rule for `generateStaticParams()`: no DB
  at build time means no prerendered list, never a failed build.
* `app/robots.ts` disallows the session-only surfaces and the token pages, derived
  from the same `PRIVATE_SEGMENTS` / `NOINDEX_SEGMENTS` lists.
* `/share/<token>`, `/shortlist/<token>`, `/invoice/<token>`, `/unsubscribe/<token>`
  emit `<meta robots noindex>` as well — a robots rule is advisory, the meta tag is not.
* `/api/products/search` no longer returns `profiles.email` or `profiles.fda_registration_number`
  to anonymous callers (only to a signed-in one), and its `limit` is clamped to 100.
* Visibility is enforced in the queries, not by RLS: `status = 'active'` plus
  `client_profiles.is_published = true`. With the service-role client those two
  predicates **are** the security boundary — keep them when editing a public page,
  and never widen a public `select` by joining `profiles` beyond `(id, company_name)`.

## 5. Images: the optimizer is on

`next.config.mjs` used to set `images.unoptimized: true`, which meant a supplier's
4 MB photo crossed the Pacific at full size and the catalog's Largest Contentful
Paint paid for it. It is off now: `SmartImage`
(`components/ui/smart-image.tsx`) renders `next/image` (AVIF/WebP, width-based
`srcset`, lazy below the fold) for sources the optimizer may fetch, and a plain
`<img>` for everything else.

`lib/images/hosts.mjs` is the single source of truth for both sides:

* it builds `images.remotePatterns` — currently `**.public.blob.vercel-storage.com`,
  `**.private.blob.vercel-storage.com`, `**.supabase.co`, `**.supabase.in`;
* its `isOptimizableImageSrc()` is what `SmartImage` asks, and it also refuses
  `svg`/`gif`/`ico`/`bmp` (vector output, and animated GIF would be flattened to a
  still frame), signed URLs carrying a `token` query (the optimizer would cache a
  URL past its expiry) and our own `/api/files` proxy (it needs the caller's
  cookies, which the optimizer's fetch does not carry).

Add a host by editing that one file — both the config and the guard follow.
A URL outside it is *not* broken, just unoptimized: an allowlist miss in the config
would otherwise be a 400 from `/_next/image`, and suppliers do paste image URLs from
their own sites. `images.minimumCacheTTL` is 1 hour because the product uploader
writes without a random suffix, so a replaced file keeps its URL.

Verified against the production build in the sandbox: `/landing/hero-dashboard.jpg`
→ 200 `image/avif` on an AVIF-capable client; `https://evil.example.com/x.png`
→ 400 `"url" parameter is not allowed`, i.e. the allowlist is enforced and the
component never asks for that request.

### 5a. The rule this caught in production (2026-09-23)

`next/image` throws — **at render time**, not at request time — when a *local* src
carries a query string and `images.localPatterns` is unset:

```
Error: Image with src "/api/files?path=clients%2F…%2Fmat-truoc.png" is using a
query string which is not configured in images.localPatterns.
```

Before the profile pages were prerendered, that exception only broke one page view.
Once `/profile/[slug]` had `generateStaticParams`, Vercel fed it a real row whose
certificate thumbnail comes from `/api/files?path=…`, and the whole build died at
"Generating static pages". The fix is *not* `images.localPatterns`: the proxy needs
the caller's cookies, so an optimizer fetch would come back 401 and the picture
would be broken anyway. The fix is that **no component may hand a DB-supplied URL
to `next/image` directly** — the profile components (`profile-hero`,
`profile-header-card`, `profile-media-gallery`, `profile-video`,
`profile-certifications`) and the intake image-link preview now render through
`SmartImage`, which picks `<img>` for exactly those sources and keeps the
optimizer for the hosts it can actually fetch.

Corollary for `SmartImage` itself: its `<img>` fallback duplicates what `fill`
does inline (`position:absolute; inset:0; width/height:100%`), because `fill` is a
`next/image` behaviour and a bare `<img>` would stop covering its parent. A
fallback must never render worse than the old code.

Guardrails to keep it that way:

* `grep -rn 'from "next/image"' app components lib` should only ever list
  `components/ui/smart-image.tsx` plus pages whose srcs are **committed** files in
  `public/` (today: `app/page.tsx`). Anything reading a column belongs behind
  `SmartImage`.
* A build-time prerender of DB rows turns any one bad row into a failed deploy.
  If that becomes a habit, the answer is to stop feeding garbage into
  `generateStaticParams` (e.g. cap it, or render the first profile page on demand),
  not to wrap every component in try/catch.

## 6. Still open (in rough order of value)

1. Translate the product detail page and the supplier profile into the dictionary, then
   mark them `bilingual` so `/vi/products/<id>` becomes a real page instead of a
   canonical collapse. Their data already comes from a tagged cache, so only the copy
   and the metadata are missing.
2. `next.config.mjs` `headers`: add `Cache-Control` / `Stale-While-Revalidate`
   overrides only if a measurement says Next's defaults are wrong for you, plus
   `X-Content-Type-Options`, `Referrer-Policy` and a `frame-ancestors` CSP on the
   authenticated routes.
3. `typescript.ignoreBuildErrors: true` is still on and cannot be turned off until the
   hand-written `lib/supabase/types.ts` is replaced by a generated one (363 project-wide
   type errors today, almost all from that file).
4. GA4 / Meta pixel and a cookie-consent banner: the marketing pages currently load only
   Vercel Analytics.
5. `/api/products/search` still lists active products of suppliers whose profile is
   unpublished (the catalog pages do not). It has no in-app consumer, so aligning it is a
   behaviour change for external callers — decide deliberately.
6. `/products` is the one public page a CDN cannot cache, because its filters are query
   strings. If its traffic ever matters, move them to the path (`/products/category/<slug>`,
   `/products/page/<n>`) and the whole index becomes ISR with a bounded URL set — a URL
   scheme change, so it needs the sitemap and any saved links updated in the same pass.
