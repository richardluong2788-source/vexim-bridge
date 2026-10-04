"use client"

/**
 * Meta (Facebook) Pixel loader.
 *
 * Mounted once from `app/layout.tsx`. Three jobs:
 *
 *  1. **Inject the base snippet** — Meta's own bootstrap code, verbatim, so
 *     Meta Pixel Helper and Events Manager recognise the install. It defines
 *     `window.fbq` as a queue, sends `init` and fires the first `PageView`.
 *  2. **Fire PageView on soft navigation** — the App Router swaps pages without
 *     a document load, so the snippet alone would report one pageview per
 *     *session* instead of per page. Every subsequent pathname change on a
 *     tracked route gets its own PageView.
 *  3. **Track contact intents** — a click on `tel:`, `mailto:`, Zalo, WhatsApp
 *     or Messenger never reaches a form submit, so without this those hot leads
 *     are invisible in Ads Manager. One delegated capture-phase listener covers
 *     every such link on the site without touching their markup.
 *
 * Deliberate choices worth knowing about before editing:
 *
 *  - The snippet is only mounted on routes `isMetaTrackedPath()` accepts. On
 *    `/admin`, `/client`, `/auth`, … the pixel never loads at all, so staff
 *    browsing the dashboard cannot end up in a retargeting audience or inflate
 *    the visitor numbers the ad account reports.
 *  - `strategy="afterInteractive"` (not `beforeInteractive`): the pixel must
 *    not compete with the LCP image on the landing page. Meta's own snippet is
 *    async for the same reason. Events fired before `fbevents.js` lands are
 *    queued by `fbq`, so nothing is lost by loading late. (In the App Router an
 *    `afterInteractive` script is injected after hydration rather than written
 *    into the SSR HTML — only the `<noscript>` image below is server-rendered.)
 *  - A 404 never reports anything: Next serves its own error document
 *    (`<html id="__next_error__">`) which does not use this layout at all. That
 *    is what we want — a mistyped or expired product link is not a visitor we
 *    want counted, retargeted or optimised towards.
 *  - The `<noscript>` 1x1 pixel stays in: a JS-blocked browser still reports the
 *    pageview, which is why Meta's base code has always shipped it.
 */

import { useEffect, useRef } from "react"
import Script from "next/script"
import { usePathname } from "next/navigation"
import { isMetaPixelEnabled, isMetaTrackedPath, metaPixelId } from "@/lib/analytics/meta/config"
import { trackMetaEvent } from "@/lib/analytics/meta/browser"

/** Link targets that mean "this person wants to talk to a human". */
const MESSAGING_LINK =
  /^https?:\/\/(wa\.me|api\.whatsapp\.com|zalo\.me|zaloapp\.com|m\.me|messenger\.com|www\.messenger\.com)(\/|$)/i

export function MetaPixel() {
  const pathname = usePathname()
  const enabled = isMetaPixelEnabled()
  const pixelId = metaPixelId()
  const tracked = enabled && isMetaTrackedPath(pathname)

  // Set the first time we render on a tracked path, because that is the moment
  // the snippet mounts and sends its own PageView — our effect must skip that
  // one and only report *subsequent* navigations, or every landing gets counted
  // twice (which reads as "50% of visitors bounce to a second page", a lie that
  // would be acted on).
  //
  // The "the snippet sends exactly one PageView per document load" half of that
  // reasoning is load-bearing, so it is worth spelling out: `next/script` keys
  // loaded scripts by `id` in a module-level LoadCache, and an inline script
  // enters that cache as soon as it is appended. A soft navigation to /admin
  // unmounts this component and a later navigation back re-mounts it, but the
  // snippet is NOT re-executed — so removing this ref would not "simplify" the
  // component, it would just double-count every return visit.
  const snippetSentInitialPageView = useRef(false)

  useEffect(() => {
    if (!tracked) return

    if (!snippetSentInitialPageView.current) {
      snippetSentInitialPageView.current = true
      return
    }

    trackMetaEvent("PageView")
  }, [tracked, pathname])

  useEffect(() => {
    if (!enabled) return

    function onClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null
      if (!anchor) return

      // Only on the marketing surfaces — a tel: link inside /client is an
      // existing customer calling their AE, not an ad prospect.
      if (!isMetaTrackedPath(window.location.pathname)) return

      const href = anchor.getAttribute("href") ?? ""

      if (href.startsWith("tel:")) {
        trackMetaEvent("Contact", {
          contact_type: "phone_call",
          content_name: href.slice(4).trim(),
        })
        return
      }

      if (href.startsWith("mailto:")) {
        trackMetaEvent("Contact", {
          contact_type: "email",
          content_name: href.slice(7).split("?")[0].trim(),
        })
        return
      }

      if (MESSAGING_LINK.test(href)) {
        trackMetaEvent("Contact", { contact_type: "messaging_app", content_name: href })
      }
    }

    // Capture phase: the listener runs before the browser starts the tel:/
    // navigation and before any stopPropagation in a component handler.
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [enabled])

  if (!tracked) return null

  return (
    <>
      <Script
        id="meta-pixel-base"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');`,
        }}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  )
}
