import type { Metadata } from "next"
import { siteConfig } from "@/lib/site-config"
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
const SUMMARY =
  "Cookie và tracker mà Vexim Bridge sử dụng để duy trì phiên đăng nhập, ghi nhớ ngôn ngữ ưu tiên và đo lường hiệu năng. Chúng tôi không dùng cookie quảng cáo của bên thứ ba."
const EFFECTIVE_DATE = "2026-04-26"

const SECTIONS: LegalSection[] = [
  { id: "cookie-la-gi", title: "Cookie là gì" },
  { id: "loai-cookie", title: "Loại cookie chúng tôi dùng" },
  { id: "danh-sach", title: "Danh sách cookie chi tiết" },
  { id: "tracker-bên-thu-ba", title: "Tracker bên thứ ba" },
  { id: "kiem-soat", title: "Kiểm soát cookie" },
  { id: "lien-he", title: "Liên hệ" },
]

const URL = `${siteConfig.url}${PATHNAME}`

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: `${TITLE} — ${siteConfig.name}`,
  description: SUMMARY,
  keywords: [
    "chính sách cookie Vexim Bridge",
    "cookie policy",
    "Supabase auth cookie",
    "Vercel Analytics",
    "tracker website",
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
    url: URL,
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
          ]}
        />
        <LegalCallout>
          Chúng tôi <strong>không sử dụng</strong> cookie quảng cáo, retargeting, fingerprinting
          hay social tracking pixel.
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
      </Section>

      <Section id="tracker-bên-thu-ba" title="4. Tracker bên thứ ba">
        <LegalParagraph>
          Vexim Bridge nhúng các tài nguyên sau ở những phần được giới hạn:
        </LegalParagraph>
        <LegalList
          items={[
            "Google Fonts (Inter, Geist Mono) — phục vụ font; không gắn cookie.",
            "Vercel Blob — chỉ chạy khi tải tài liệu, không đặt cookie tracking.",
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
      </Section>

      <Section id="lien-he" title="6. Liên hệ">
        <LegalParagraph>
          Mọi thắc mắc về cookie, vui lòng liên hệ <strong>{siteConfig.contact.email}</strong>.
        </LegalParagraph>
      </Section>
    </LegalPage>
  )
}
