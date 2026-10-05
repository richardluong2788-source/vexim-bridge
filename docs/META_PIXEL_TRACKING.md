# Website analytics: GA4 and Meta Pixel

## Configuration

- Meta Pixel reads `NEXT_PUBLIC_META_PIXEL_ID` at build time. The public Pixel ID supplied for this project (`4532386106980064`) is the fallback when the variable is unset; a valid numeric environment value overrides it.
- GA4 uses the supplied Measurement ID `G-ZEJM6Q37SY` by default. An optional `NEXT_PUBLIC_GA_MEASUREMENT_ID` build-time variable can override it; use a valid `G-XXXXXXXXXX` ID and redeploy after changing it. An invalid override disables GA4.
- Both IDs are public identifiers, not secrets. Never put a GA secret or Meta CAPI access token in a `NEXT_PUBLIC_*` variable.
- Meta Conversions API is not configured. The browser Pixel works without CAPI; no token is needed for the site to function.

## Consent and events

- Neither Google Analytics 4 nor Meta Pixel is loaded until a visitor accepts optional measurement in the consent banner. Consent is stored as `vexim-optional-tracking-consent-v2`; the new consent version prompts visitors again because GA4 was not included in the previous notice.
- The visitor can reject or reopen cookie settings from the public-site footer or `/legal/cookies`. Rejecting withdraws consent, stops subsequent events, and clears first-party GA/Meta cookies where possible.
- GA4 events: `page_view` for public route loads/navigation, `contact` for marked primary CTA clicks, and `generate_lead` only after a buyer sourcing request or supplier consultation succeeds. The tag disables its automatic page view and sends App Router page views explicitly.
- Meta Pixel events: `PageView`, `Contact`, and `Lead` for the same funnel stages.
- In the GA4 web stream, disable Enhanced Measurement's automatic page-view/history tracking to avoid duplicate page views; disable other automatic event types too if you want to collect only the curated events listed here.
- Event parameters identify the page, CTA, or form type only. Form fields, email, phone, and request references are not sent to Google or Meta. Google Signals/ad personalization are disabled in the GA4 tag.
- Meta automatic event discovery is disabled. URLs with unapproved query parameters and referrers containing sensitive keys/tokenized routes are skipped.
- Private/account routes (`/admin`, `/settings`, `/client`, `/auth`, `/notifications`) and tokenized or customer-data routes (`/share`, `/shortlist`, `/invoice`, `/unsubscribe`, `/client-intake`, `/product-intake`) are excluded from browser analytics events.

## Smoke test

1. In the GA4 web stream, disable Enhanced Measurement's automatic page-view/history tracking (and any unrelated auto events you do not want). The default ID is `G-ZEJM6Q37SY`; set `NEXT_PUBLIC_GA_MEASUREMENT_ID` in Vercel only if overriding it, then redeploy.
2. Open a public page in a fresh browser profile and reject optional measurement. Confirm there are no requests to `googletagmanager.com` or `connect.facebook.net`.
3. Reopen the page, accept optional measurement, and check GA4 **Reports → Realtime** / **DebugView** and Meta Events Manager **Test Events** for page views.
4. Click a primary buyer/supplier CTA and confirm `contact` / `Contact`; successfully submit each lead form and confirm `generate_lead` / `Lead`. A failed submission must not send a lead event.
5. Visit `/admin`, `/settings`, and a tokenized link after consent. Confirm no events are sent from those routes.
6. Use Cookie settings to reject after accepting and confirm subsequent events stop.
