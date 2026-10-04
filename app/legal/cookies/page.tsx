import type { Metadata } from "next"
import { siteConfig } from "@/lib/site-config"
import { isMetaPixelEnabled } from "@/lib/analytics/meta/config"
import { LegalPage, type LegalSection } from "@/components/legal/legal-page"
import {
  LegalSection as Section,
  LegalParagraph,
  LegalList,
  LegalSubheading,
  LegalCallout,
} from "@/components/legal/legal-prose"

const PATHNAME = "/legal/cookies"
const TITLE = "Chính sách cookie"

/**
 * This page must describe what the site ACTUALLY loads, so the advertising
 * paragraphs follow the same env var the pixel does
 * (NEXT_PUBLIC_META_PIXEL_ID): with it set, the Meta Pixel disclosure is
 * published; without it, the page keeps saying we run no ad trackers — which is
 * then true. Both are evaluated at build time (the page is statically rendered
 * and NEXT_PUBLIC_* is inlined), so flipping the pixel flips this copy on the
 * next deploy. Claiming "no advertising cookies" while `fbevents.js` loads would
 * be a false statement in a legal document, and that is exactly the kind of
 * drift a conditional like this prevents.
 */
const AD_TRACKING_ON = isMetaPixelEnabled()

const SUMMARY = AD_TRACKING_ON
  ? "Cookie và tracker mà Vexim Trade sử dụng để duy trì phiên đăng nhập, ghi nhớ ngôn ngữ ưu tiên, đo lường hiệu năng ẩn danh và đo hiệu quả quảng cáo (Meta Pixel). Chúng tôi không bán dữ liệu cá nhân."
  : "Cookie và tracker mà Vexim Trade sử dụng để duy trì phiên đăng nhập, ghi nhớ ngôn ngữ ưu tiên và đo lường hiệu năng. Chúng tôi không dùng cookie quảng cáo của bên thứ ba."
/**
 * Publishing the Meta disclosure changes the substance of this document, so the
 * "hiệu lực từ" date moves with it — but only when the disclosure is actually
 * published. Re-dating an unchanged policy would imply an edit nobody made.
 */
const EFFECTIVE_DATE = AD_TRACKING_ON ? "2026-10-04" : "2026-04-26"

const SECTIONS: LegalSection[] = [
  { id: "cookie-la-gi", title: "Cookie là gì" },
  { id: "loai-cookie", title: "Loại cookie chúng tôi dùng" },
  { id: "danh-sach", title: "Danh sách cookie chi tiết" },
  { id: "tracker-bên-thu-ba", title: "Tracker bên thứ ba" },
  { id: "kiem-soat", title: "Kiểm soát cookie" },
  { id: "lien-he", title: "Liên hệ" },
]

// See note in /app/legal/terms/page.tsx — never call this `URL`, it would
// shadow the global URL constructor used by `metadataBase`.
const PAGE_URL = `${siteConfig.url}${PATHNAME}`

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: `${TITLE} — ${siteConfig.name}`,
  description: SUMMARY,
  keywords: [
    "chính sách cookie Vexim Trade",
    "cookie policy",
    "Supabase auth cookie",
    "Vercel Analytics",
    "tracker website",
    ...(AD_TRACKING_ON ? ["Meta Pixel", "Facebook Pixel", "cookie quảng cáo"] : []),
    ...siteConfig.keywords,
  ],
  alternates: {
    canonical: PATHNAME,
    languages: {
      "vi-VN": PATHNAME,
    },
  },
  openGraph: {
    type: "article",
    locale: "vi_VN",
    url: PAGE_URL,
    siteName: siteConfig.name,
    title: `${TITLE} — ${siteConfig.name}`,
    description: SUMMARY,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1600,
        height: 1000,
        alt: `${TITLE} — ${siteConfig.name}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} — ${siteConfig.name}`,
    description: SUMMARY,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
    },
  },
}

export default function CookiePolicyPage() {
  return (
    <LegalPage
      pathname={PATHNAME}
      title={TITLE}
      summary={SUMMARY}
      effectiveDate={EFFECTIVE_DATE}
      sections={SECTIONS}
    >
      <Section id="cookie-la-gi" title="1. Cookie là gì?">
        <LegalParagraph>
          Cookie là tệp văn bản nhỏ mà website lưu vào trình duyệt của bạn để ghi nhớ trạng thái
          (đã đăng nhập chưa, ngôn ngữ nào). Chúng tôi cũng dùng các công nghệ tương đương như{" "}
          <em>localStorage</em> và <em>session storage</em> cho các tính năng phía client. Chính
          sách này dùng từ &quot;cookie&quot; để bao quát cả các công nghệ đó.
        </LegalParagraph>
      </Section>

      <Section id="loai-cookie" title="2. Loại cookie chúng tôi dùng">
        <LegalList
          items={[
            <><strong>Cookie thiết yếu (strictly necessary):</strong> giữ phiên đăng nhập, bảo vệ CSRF, bảo đảm hệ thống hoạt động an toàn. Không thể tắt nếu bạn muốn dùng Dịch vụ.</>,
            <><strong>Cookie chức năng (functional):</strong> nhớ lựa chọn của bạn (ngôn ngữ vi/en, theme).</>,
            <><strong>Đo lường ẩn danh (analytics):</strong> Vercel Analytics đếm pageview ẩn danh để chúng tôi cải tiến UI. Không gắn ID cá nhân, không bán cho bên thứ ba.</>,
            ...(AD_TRACKING_ON
              ? [
                  <>
                    <strong>Quảng cáo &amp; đo lường chiến dịch (advertising):</strong> Meta Pixel
                    (Facebook) ghi nhận lượt xem trang công khai, lượt xem sản phẩm và việc gửi form
                    tư vấn, để chúng tôi biết quảng cáo nào thực sự tạo ra khách hàng và ngân sách
                    nên đặt vào đâu. Meta dùng dữ liệu này theo{" "}
                    <a
                      className="underline"
                      href="https://www.facebook.com/privacy/policy"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Chính sách quyền riêng tư của Meta
                    </a>
                    .
                  </>,
                ]
              : []),
          ]}
        />
        <LegalCallout>
          {AD_TRACKING_ON ? (
            <>
              Ngoài Meta Pixel nêu trên, chúng tôi <strong>không</strong> dùng fingerprinting, không
              bán dữ liệu cá nhân, và không nhúng tracker quảng cáo của bất kỳ bên nào khác. Pixel
              chỉ chạy trên các trang công khai (trang chủ, danh mục sản phẩm, hồ sơ nhà cung cấp,{" "}
              <code>/legal</code>) — <strong>không</strong> chạy trong khu vực đăng nhập{" "}
              <code>/admin</code>, <code>/client</code>, <code>/settings</code>.
            </>
          ) : (
            <>
              Chúng tôi <strong>không sử dụng</strong> cookie quảng cáo, retargeting, fingerprinting
              hay social tracking pixel.
            </>
          )}
        </LegalCallout>
      </Section>

      <Section id="danh-sach" title="3. Danh sách cookie chi tiết">
        <LegalSubheading>3.1 Cookie thiết yếu</LegalSubheading>
        <div className="overflow-x-auto rounded-md border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-foreground">
              <tr className="text-left">
                <th className="px-4 py-2 font-semibold">Tên</th>
                <th className="px-4 py-2 font-semibold">Mục đích</th>
                <th className="px-4 py-2 font-semibold">Thời hạn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-foreground/85">
              <tr>
                <td className="px-4 py-2 font-mono text-xs">sb-access-token</td>
                <td className="px-4 py-2">Token truy cập Supabase (JWT)</td>
                <td className="px-4 py-2">~1 giờ (auto refresh)</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-xs">sb-refresh-token</td>
                <td className="px-4 py-2">Refresh token để giữ phiên đăng nhập</td>
                <td className="px-4 py-2">Tối đa 30 ngày</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-xs">sb-{`<project>`}-auth-token</td>
                <td className="px-4 py-2">Cookie tổng hợp do @supabase/ssr quản lý</td>
                <td className="px-4 py-2">Phiên</td>
              </tr>
            </tbody>
          </table>
        </div>

        <LegalSubheading>3.2 Cookie chức năng</LegalSubheading>
        <div className="overflow-x-auto rounded-md border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-foreground">
              <tr className="text-left">
                <th className="px-4 py-2 font-semibold">Tên</th>
                <th className="px-4 py-2 font-semibold">Mục đích</th>
                <th className="px-4 py-2 font-semibold">Thời hạn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-foreground/85">
              <tr>
                <td className="px-4 py-2 font-mono text-xs">vxb-locale</td>
                <td className="px-4 py-2">Ngôn ngữ ưu tiên (vi/en)</td>
                <td className="px-4 py-2">12 tháng</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-xs">theme</td>
                <td className="px-4 py-2">Light / dark mode</td>
                <td className="px-4 py-2">12 tháng</td>
              </tr>
            </tbody>
          </table>
        </div>

        <LegalSubheading>3.3 Đo lường ẩn danh</LegalSubheading>
        <div className="overflow-x-auto rounded-md border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-foreground">
              <tr className="text-left">
                <th className="px-4 py-2 font-semibold">Tên</th>
                <th className="px-4 py-2 font-semibold">Nhà cung cấp</th>
                <th className="px-4 py-2 font-semibold">Mục đích</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-foreground/85">
              <tr>
                <td className="px-4 py-2 font-mono text-xs">_vercel_*</td>
                <td className="px-4 py-2">Vercel Analytics</td>
                <td className="px-4 py-2">Pageview, Web Vitals (không gắn ID)</td>
              </tr>
            </tbody>
          </table>
        </div>

        {AD_TRACKING_ON && (
          <>
            <LegalSubheading>3.4 Cookie quảng cáo (Meta Pixel)</LegalSubheading>
            <div className="overflow-x-auto rounded-md border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-foreground">
                  <tr className="text-left">
                    <th className="px-4 py-2 font-semibold">Tên</th>
                    <th className="px-4 py-2 font-semibold">Nhà cung cấp</th>
                    <th className="px-4 py-2 font-semibold">Mục đích</th>
                    <th className="px-4 py-2 font-semibold">Thời hạn</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-foreground/85">
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs">_fbp</td>
                    <td className="px-4 py-2">Meta (Facebook)</td>
                    <td className="px-4 py-2">
                      Nhận diện trình duyệt qua các lần ghé thăm để đo và tối ưu quảng cáo
                    </td>
                    <td className="px-4 py-2">90 ngày</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs">_fbc</td>
                    <td className="px-4 py-2">Meta (Facebook)</td>
                    <td className="px-4 py-2">
                      Lưu mã click (<code>fbclid</code>) từ quảng cáo bạn đã bấm để đối chiếu chuyển
                      đổi với đúng chiến dịch
                    </td>
                    <td className="px-4 py-2">90 ngày</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <LegalParagraph>
              Nếu bạn đang đăng nhập Facebook trong cùng trình duyệt, Meta có thể đặt thêm cookie
              trên tên miền của chính họ (<code>fr</code>, <code>datr</code>,&hellip;). Những cookie
              đó nằm ngoài website này và do Meta kiểm soát.
            </LegalParagraph>
          </>
        )}
      </Section>

      <Section id="tracker-bên-thu-ba" title="4. Tracker bên thứ ba">
        <LegalParagraph>
          Vexim Trade nhúng các tài nguyên sau ở những phần được giới hạn:
        </LegalParagraph>
        <LegalList
          items={[
            "Google Fonts (Inter, Geist Mono) — phục vụ font; không gắn cookie.",
            "Vercel Blob — chỉ chạy khi tải tài liệu, không đặt cookie tracking.",
            ...(AD_TRACKING_ON
              ? [
                  <>
                    <strong>Meta Pixel &amp; Conversions API (Meta Platforms Ireland / Meta
                    Platforms, Inc.)</strong> — chạy trên các trang công khai để đo hiệu quả quảng
                    cáo. Ngoài các sự kiện trình duyệt (<code>PageView</code>,{" "}
                    <code>ViewContent</code>, <code>Contact</code>, <code>Lead</code>), khi bạn gửi
                    form tư vấn máy chủ của chúng tôi gửi thêm một sự kiện chuyển đổi trực tiếp tới
                    Meta. Dữ liệu đính kèm gồm: email, số điện thoại và họ tên{" "}
                    <strong>đã băm SHA-256</strong> (Meta không thể đọc ngược), địa chỉ IP, user
                    agent, và hai cookie <code>_fbc</code>/<code>_fbp</code>. Mục đích duy nhất là
                    để Meta đối khớp chuyển đổi với lượt click quảng cáo; chúng tôi không dùng kênh
                    này cho bất kỳ việc gì khác và không nhận lại dữ liệu cá nhân từ Meta.
                  </>,
                ]
              : []),
          ]}
        />
        <LegalParagraph>
          Khi bạn nhấn vào liên kết LinkedIn / Facebook ở footer, bạn rời khỏi nền tảng và chịu sự
          điều chỉnh chính sách của các bên đó.
        </LegalParagraph>
      </Section>

      <Section id="kiem-soat" title="5. Kiểm soát cookie">
        <LegalSubheading>5.1 Trên trình duyệt</LegalSubheading>
        <LegalParagraph>
          Bạn có thể xoá hoặc chặn cookie qua cài đặt của Chrome / Safari / Firefox / Edge. Nếu
          chặn cookie thiết yếu, bạn sẽ không đăng nhập được vào /admin hoặc /client.
        </LegalParagraph>
        <LegalSubheading>5.2 Trong tài khoản</LegalSubheading>
        <LegalParagraph>
          Tắt email không bắt buộc tại <code>/settings/notifications</code> hoặc một-cú-nhấp qua
          link unsubscribe trong email. Việc tắt email không xoá cookie thiết yếu của phiên đăng
          nhập.
        </LegalParagraph>
        <LegalSubheading>5.3 Vercel Analytics</LegalSubheading>
        <LegalParagraph>
          Vercel Analytics chỉ chạy khi <code>NODE_ENV=production</code> và đo lường pageview ở mức
          ẩn danh, không lưu IP đầy đủ. Bạn có thể chặn bằng các tiện ích trình duyệt phổ biến
          (uBlock Origin, Privacy Badger, &hellip;).
        </LegalParagraph>
        {AD_TRACKING_ON && (
          <>
            <LegalSubheading>5.4 Meta Pixel và quảng cáo</LegalSubheading>
            <LegalParagraph>
              Bạn có ba cách tắt, không cách nào ảnh hưởng tới việc dùng website:
            </LegalParagraph>
            <LegalList
              items={[
                <>
                  <strong>Chặn trên trình duyệt:</strong> tiện ích như uBlock Origin, Privacy Badger
                  hay Facebook Container chặn <code>fbevents.js</code> và cookie{" "}
                  <code>_fbp</code>/<code>_fbc</code>.
                </>,
                <>
                  <strong>Tắt cá nhân hoá quảng cáo phía Meta:</strong> mục &quot;Quảng cáo&quot;
                  trong Cài đặt Facebook, hoặc{" "}
                  <a
                    className="underline"
                    href="https://www.facebook.com/ads/preferences"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    facebook.com/ads/preferences
                  </a>{" "}
                  — áp dụng cho mọi website chứ không riêng chúng tôi.
                </>,
                <>
                  <strong>Yêu cầu xoá dữ liệu:</strong> nếu bạn đã gửi form tư vấn và không muốn
                  được nhắm quảng cáo lại, email tới{" "}
                  <strong>{siteConfig.contact.email}</strong>; chúng tôi xử lý theo mục 10 của Chính
                  sách bảo mật.
                </>,
              ]}
            />
          </>
        )}
      </Section>

      <Section id="lien-he" title="6. Liên hệ">
        <LegalParagraph>
          Mọi thắc mắc về cookie, vui lòng liên hệ <strong>{siteConfig.contact.email}</strong>.
        </LegalParagraph>
      </Section>
    </LegalPage>
  )
}
