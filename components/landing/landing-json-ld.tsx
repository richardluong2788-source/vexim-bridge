import { siteConfig } from "@/lib/site-config"
import { LANDING_FAQS } from "@/components/landing/landing-faq"

/**
 * Structured data for rich results. Three graphs:
 *   - Organization (brand identity)
 *   - SoftwareApplication (product card in SERP)
 *   - FAQPage (accordion rich result)
 * Rendered as a single <script type="application/ld+json"> per the
 * schema.org JSON-LD spec.
 */
export function LandingJsonLd() {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteConfig.url}/#organization`,
        name: siteConfig.name,
        legalName: siteConfig.legalName,
        url: siteConfig.url,
        logo: `${siteConfig.url}/landing/hero-dashboard.jpg`,
        description: siteConfig.description,
        address: {
          "@type": "PostalAddress",
          ...siteConfig.contact.addressParts,
        },
        sameAs: [siteConfig.social.linkedin, siteConfig.social.facebook],
        contactPoint: [
          {
            "@type": "ContactPoint",
            email: siteConfig.contact.email,
            telephone: siteConfig.contact.phone,
            contactType: "sales",
            areaServed: ["VN", "US"],
            availableLanguage: ["Vietnamese", "English"],
          },
          {
            "@type": "ContactPoint",
            email: siteConfig.contact.support,
            telephone: siteConfig.contact.phone,
            contactType: "customer support",
            areaServed: ["VN", "US"],
            availableLanguage: ["Vietnamese", "English"],
          },
        ],
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${siteConfig.url}/#software`,
        name: siteConfig.name,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: siteConfig.description,
        url: siteConfig.url,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          description: "Free to onboard; success fee per SWIFT-verified deal.",
        },
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: "4.8",
          ratingCount: "42",
        },
      },
      {
        "@type": "FAQPage",
        "@id": `${siteConfig.url}/#faq`,
        mainEntity: LANDING_FAQS.map((faq) => ({
          "@type": "Question",
          name: faq.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.a,
          },
        })),
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      // JSON.stringify is safe here — no user-controlled values.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  )
}
