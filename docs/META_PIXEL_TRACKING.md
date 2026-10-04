# Meta Pixel tracking

## Configuration

- The browser Pixel reads `NEXT_PUBLIC_META_PIXEL_ID` at build time. The public Pixel ID supplied for this project (`4532386106980064`) is the fallback when the variable is unset; a valid numeric environment value overrides it.
- Set the variable in Vercel for the environments where tracking should be enabled, then redeploy. The Pixel ID is public; never put a Meta CAPI access token in a `NEXT_PUBLIC_*` variable.
- Meta Conversions API is not configured in this implementation. The browser Pixel works on its own; no CAPI token is needed for the site to function.

## Consent and events

- The Meta script is not loaded and no Meta events are sent until the visitor accepts optional marketing cookies. The visitor can reject or reopen cookie settings from the public-site footer or `/legal/cookies`.
- `PageView` is sent on public route loads/navigation after consent.
- `Contact` is sent for the marked primary sourcing/consultation CTA clicks.
- `Lead` is sent only after the buyer sourcing request or supplier consultation API confirms a successful submission. Event parameters identify the form type only; form fields, email, phone, and request references are not sent to Meta.
- Meta automatic event discovery is disabled. URLs with unapproved query parameters and referrers containing sensitive keys/tokenized routes are skipped to avoid forwarding arbitrary values to Meta.
- Private/account routes (`/admin`, `/settings`, `/client`, `/auth`, `/notifications`) and tokenized or customer-data routes (`/share`, `/shortlist`, `/invoice`, `/unsubscribe`, `/client-intake`, `/product-intake`) are excluded from Pixel page and interaction events.

## Smoke test

1. Open a public page in a fresh browser profile and reject cookies. Confirm no request to `connect.facebook.net` and no Meta events are sent.
2. Reopen the page, accept cookies, and confirm one `PageView` in Meta Pixel Helper / Events Manager.
3. Click a primary buyer or supplier CTA and confirm `Contact`; submit each lead form successfully and confirm exactly one `Lead`. A failed form submission must not send `Lead`.
4. Visit `/admin` and `/settings` (and a tokenized link) after consent. Confirm no page or CTA events from those routes.
5. Use Cookie settings to reject after accepting and confirm subsequent events stop.
