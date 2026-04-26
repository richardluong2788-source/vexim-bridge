import type { Metadata } from "next"
import { siteConfig } from "@/lib/site-config"
import { LegalPage, type LegalSection } from "@/components/legal/legal-page"
import {
  LegalSection as Section,
  LegalParagraph,
  LegalList,
  LegalSubheading,
  LegalCallout,
  LegalDefinitionList,
} from "@/components/legal/legal-prose"

const PATHNAME = "/legal/privacy"
const TITLE = "Chính sách bảo mật"
const SUMMARY =
  "Cách Vexim Bridge thu thập, sử dụng, lưu trữ và bảo vệ dữ liệu của khách hàng (nhà sản xuất Việt Nam) cùng dữ liệu buyer Hoa Kỳ — bao gồm thông tin FDA, hợp đồng, hóa đơn, tài liệu SWIFT/B/L và email outreach do AI hỗ trợ."
const EFFECTIVE_DATE = "2026-04-26"

const SECTIONS: LegalSection[] = [
  { id: "tong-quan", title: "Tổng quan" },
  { id: "du-lieu-thu-thap", title: "Dữ liệu chúng tôi thu thập" },
  { id: "muc-dich", title: "Mục đích sử dụng" },
  { id: "co-so-phap-ly", title: "Cơ sở pháp lý" },
  { id: "ben-thu-ba", title: "Đối tác xử lý dữ liệu" },
  { id: "luu-tru-mai-hoa", title: "Lưu trữ & mã hoá" },
  { id: "thoi-gian-luu", title: "Thời gian lưu trữ" },
  { id: "chuyen-du-lieu-quoc-te", title: "Chuyển dữ liệu quốc tế" },
  { id: "an-toan", title: "Biện pháp an toàn" },
  { id: "quyen-cua-ban", title: "Quyền của bạn" },
  { id: "tre-em", title: "Dữ liệu trẻ em" },
  { id: "tai-khoan-bi-xam-pham", title: "Sự cố bảo mật" },
  { id: "thay-doi-chinh-sach", title: "Thay đổi chính sách" },
  { id: "lien-he", title: "Liên hệ DPO" },
]

// IMPORTANT: do NOT name this `URL` — that shadows the global URL constructor
// used by `new URL(...)` inside `metadataBase` and crashes the route at
// module-load (rendered as a 404 in production).
const PAGE_URL = `${siteConfig.url}${PATHNAME}`

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: `${TITLE} — ${siteConfig.name}`,
  description: SUMMARY,
  keywords: [
    "chính sách bảo mật Vexim Bridge",
    "privacy policy",
    "bảo vệ dữ liệu cá nhân",
    "GDPR xuất khẩu Việt Mỹ",
    "RLS Supabase bảo mật",
    "mã hoá dữ liệu FDA",
    "Row Level Security",
    "Vercel Blob private storage",
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

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      pathname={PATHNAME}
      title={TITLE}
      summary={SUMMARY}
      effectiveDate={EFFECTIVE_DATE}
      sections={SECTIONS}
    >
      <Section id="tong-quan" title="1. Tổng quan">
        <LegalParagraph>
          Vexim Bridge cam kết bảo vệ dữ liệu cá nhân và dữ liệu kinh doanh của khách hàng. Chính
          sách này mô tả những loại dữ liệu chúng tôi thu thập khi bạn sử dụng nền tảng tại{" "}
          <strong>{siteConfig.domain}</strong>, cách chúng tôi sử dụng dữ liệu đó, đối tác mà chúng
          tôi chia sẻ dữ liệu, thời gian lưu trữ và quyền của bạn.
        </LegalParagraph>
        <LegalParagraph>
          Đơn vị kiểm soát dữ liệu (Data Controller) là <strong>{siteConfig.legalName}</strong>,
          địa chỉ: {siteConfig.contact.address}.
        </LegalParagraph>
      </Section>

      <Section id="du-lieu-thu-thap" title="2. Dữ liệu chúng tôi thu thập">
        <LegalSubheading>2.1 Bạn cung cấp trực tiếp</LegalSubheading>
        <LegalList
          items={[
            "Thông tin tài khoản: email, họ tên, số điện thoại, mật khẩu băm bcrypt (do Supabase Auth quản lý).",
            "Thông tin doanh nghiệp: tên công ty, địa chỉ, ngành nghề, ngôn ngữ ưu tiên (vi/en).",
            "Hồ sơ FDA: Registration Number, ngày đăng ký, ngày hết hạn — được lưu trong bảng profiles.",
            "Tài liệu tuân thủ: chứng nhận FDA, COA, video xưởng, ảnh xưởng, bảng giá sàn — lưu trên Vercel Blob private storage.",
            "Thông tin sản phẩm: tên, danh mục, công suất, giá vốn, giá bán đề xuất.",
            "Hợp đồng tài chính: setup fee, retainer, success fee %, tỉ lệ retainer credit.",
          ]}
        />
        <LegalSubheading>2.2 Sinh ra trong quá trình sử dụng</LegalSubheading>
        <LegalList
          items={[
            "Lead/buyer mà Vexim Bridge nghiên cứu thay mặt bạn (có thể được làm giàu bằng Apollo).",
            "Email outreach do AI (Vercel AI Gateway) tạo, được bạn hoặc Vexim Bridge phê duyệt trước khi gửi qua Resend.",
            "Phản hồi của buyer được phân loại tự động (intent: price_request, sample_request, objection, closing_signal, general).",
            "Hóa đơn (setup_fee, retainer, success_fee, manual) cùng tài liệu PO, SWIFT, B/L.",
            "Lịch sử pipeline (stage_transitions) — append-only audit log.",
            "Activity log: ai làm gì, khi nào, trên opportunity nào.",
            "Notification: in-app + email log với dedup_key idempotent.",
          ]}
        />
        <LegalSubheading>2.3 Dữ liệu kỹ thuật tự động</LegalSubheading>
        <LegalList
          items={[
            "Cookie phiên làm việc do Supabase Auth phát hành để duy trì session SSR.",
            "Địa chỉ IP, user agent, timestamp request — phục vụ phát hiện gian lận và debug.",
            "Số liệu sử dụng ẩn danh từ Vercel Analytics (chỉ chạy ở môi trường production).",
          ]}
        />
        <LegalCallout>
          Chúng tôi <strong>không</strong> thu thập dữ liệu y tế cá nhân (PHI), thông tin thẻ tín
          dụng, hay dữ liệu của trẻ em. Thanh toán được xử lý ngoài hệ thống (chuyển khoản ngân
          hàng / VietQR Napas 247).
        </LegalCallout>
      </Section>

      <Section id="muc-dich" title="3. Mục đích sử dụng">
        <LegalDefinitionList
          items={[
            { term: "Cung cấp dịch vụ", definition: "Vận hành pipeline kinh doanh, tạo hóa đơn, xác thực SWIFT, theo dõi FDA." },
            { term: "Hỗ trợ AI", definition: "Soạn email outreach và phân loại email phản hồi qua Vercel AI Gateway. Nội dung email không được dùng để huấn luyện mô hình bên ngoài." },
            { term: "Bảo mật & gian lận", definition: "Phát hiện đăng nhập bất thường, audit log thay đổi quan trọng, cảnh báo SoD vi phạm." },
            { term: "Tuân thủ pháp lý", definition: "Lưu hồ sơ kế toán, ghi chú giao dịch SWIFT, hồ sơ FDA — phục vụ kiểm toán và pháp lý." },
            { term: "Truyền thông", definition: "Email giao dịch (hóa đơn, mời, nhắc nhở, weekly report, monthly digest). Bạn có thể tắt từng loại tại /settings/notifications hoặc một-cú-nhấp tại link unsubscribe." },
          ]}
        />
      </Section>

      <Section id="co-so-phap-ly" title="4. Cơ sở pháp lý">
        <LegalParagraph>
          Chúng tôi xử lý dữ liệu cá nhân dựa trên các cơ sở pháp lý sau (tham chiếu khái niệm
          GDPR/PDPA cho khách hàng EU/SEA):
        </LegalParagraph>
        <LegalList
          items={[
            "Thực hiện hợp đồng — phần lớn xử lý dữ liệu là cần thiết để cung cấp Dịch vụ theo Điều khoản dịch vụ.",
            "Lợi ích hợp pháp — tìm kiếm buyer, phát hiện gian lận, cải tiến sản phẩm.",
            "Đồng ý — với email marketing không bắt buộc; bạn có thể rút lại đồng ý bất kỳ lúc nào.",
            "Nghĩa vụ pháp lý — lưu hồ sơ thuế, kế toán, hóa đơn theo luật Việt Nam.",
          ]}
        />
      </Section>

      <Section id="ben-thu-ba" title="5. Đối tác xử lý dữ liệu">
        <LegalParagraph>
          Vexim Bridge sử dụng các nhà cung cấp dịch vụ (sub-processor) sau, mỗi đối tác chỉ truy
          cập dữ liệu ở mức tối thiểu cần thiết:
        </LegalParagraph>
        <LegalDefinitionList
          items={[
            { term: "Supabase", definition: "Cơ sở dữ liệu PostgreSQL + Authentication + Realtime. Khu vực: tuỳ chọn của Vexim Bridge. Mọi truy vấn đều đi qua Row Level Security (RLS)." },
            { term: "Vercel", definition: "Hosting Next.js (App Router), Vercel Blob private storage cho tài liệu, Vercel AI Gateway cho LLM, Vercel Cron cho job định kỳ, Vercel Analytics ẩn danh." },
            { term: "Resend", definition: "Gửi email giao dịch (mời, hóa đơn, nhắc nhở). Có nodemailer làm fallback." },
            { term: "Apollo", definition: "Làm giàu dữ liệu lead (B2B firmographic). Dữ liệu trả về được lưu trong cột enriched_data." },
            { term: "Vercel AI Gateway providers", definition: "Các mô hình LLM (OpenAI, Anthropic, Google) được gọi không lưu trữ — chúng tôi không cho phép sử dụng dữ liệu của bạn để huấn luyện mô hình của họ." },
          ]}
        />
        <LegalParagraph>
          Chúng tôi không bán, cho thuê, hay trao đổi dữ liệu cá nhân của bạn cho bên thứ ba ngoài
          các sub-processor cần thiết để cung cấp Dịch vụ.
        </LegalParagraph>
      </Section>

      <Section id="luu-tru-mai-hoa" title="6. Lưu trữ & mã hoá">
        <LegalList
          items={[
            <><strong>Trên đường truyền:</strong> TLS 1.2+ cho mọi kết nối tới website, API và database.</>,
            <><strong>Tại nghỉ:</strong> Supabase mã hoá database AES-256; Vercel Blob mã hoá object tại nghỉ.</>,
            <><strong>Phân quyền cấp hàng (RLS):</strong> mọi bảng nhạy cảm đều có policy RLS — admin client (service role) chỉ dùng cho server actions có kiểm soát.</>,
            <><strong>Mật khẩu:</strong> không bao giờ lưu plain-text. Supabase Auth dùng bcrypt với salt riêng từng user.</>,
            <><strong>Token public link (hóa đơn, share doc, unsubscribe):</strong> sinh bằng crypto-random, single-purpose, có thể revoke.</>,
            <><strong>Buyer PII mask:</strong> vai trò lead_researcher chỉ thấy email/phone đã che (mask) — áp dụng ở tầng UI và một phần ở DB.</>,
          ]}
        />
      </Section>

      <Section id="thoi-gian-luu" title="7. Thời gian lưu trữ">
        <LegalDefinitionList
          items={[
            { term: "Tài khoản & profile", definition: "Lưu trong suốt thời gian hợp đồng + 12 tháng sau khi chấm dứt (cho mục đích pháp lý)." },
            { term: "Hóa đơn & hồ sơ tài chính", definition: "Lưu tối thiểu 10 năm theo luật kế toán Việt Nam." },
            { term: "SWIFT, PO, B/L", definition: "Lưu tối thiểu 10 năm." },
            { term: "Activity log & stage transitions", definition: "Lưu tối thiểu 5 năm để phục vụ kiểm toán và phân tích." },
            { term: "Email log (notification_email_log)", definition: "Lưu 24 tháng để xử lý khiếu nại không nhận được email." },
            { term: "Dữ liệu Vercel Analytics", definition: "Ẩn danh, lưu theo chính sách của Vercel." },
          ]}
        />
      </Section>

      <Section id="chuyen-du-lieu-quoc-te" title="8. Chuyển dữ liệu quốc tế">
        <LegalParagraph>
          Vì bản chất nghiệp vụ là xuất khẩu Việt – Mỹ, dữ liệu của bạn sẽ được xử lý qua các trung
          tâm dữ liệu của Supabase, Vercel và các sub-processor đặt tại Hoa Kỳ và châu Âu. Chúng
          tôi áp dụng Standard Contractual Clauses (SCCs) hoặc cơ chế tương đương khi pháp luật
          yêu cầu.
        </LegalParagraph>
      </Section>

      <Section id="an-toan" title="9. Biện pháp an toàn">
        <LegalList
          items={[
            "Phân quyền tối thiểu (least privilege) — capability matrix 7 vai trò.",
            "Tách biệt trách nhiệm (Segregation of Duties) — SWIFT verifier ≠ uploader, AE không sửa cost_price.",
            "Compliance gate — opportunity không thể vượt sample_requested nếu FDA hết hạn.",
            "Audit log append-only cho mọi thay đổi quan trọng (stage transitions, role changes).",
            "Cron job có Vercel Cron secret xác thực (CRON_SECRET).",
            "Email mời và token public link đều single-use hoặc có thể revoke.",
            "Service role key chỉ dùng phía server, không bao giờ lộ ra client.",
            "Backup tự động của Supabase + khả năng restore point-in-time.",
          ]}
        />
      </Section>

      <Section id="quyen-cua-ban" title="10. Quyền của bạn">
        <LegalParagraph>Tuỳ thuộc vào pháp luật áp dụng, bạn có các quyền sau:</LegalParagraph>
        <LegalList
          items={[
            <><strong>Truy cập</strong> — yêu cầu bản sao dữ liệu của bạn.</>,
            <><strong>Cập nhật</strong> — sửa dữ liệu sai/lỗi qua UI hoặc gửi yêu cầu.</>,
            <><strong>Xoá</strong> — yêu cầu xoá vĩnh viễn (trừ phần bắt buộc lưu theo luật kế toán).</>,
            <><strong>Hạn chế xử lý</strong> — tạm dừng một số hoạt động xử lý.</>,
            <><strong>Phản đối</strong> — phản đối xử lý dựa trên lợi ích hợp pháp.</>,
            <><strong>Di chuyển dữ liệu</strong> — xuất CSV danh sách clients, opportunities, invoices.</>,
            <><strong>Rút lại đồng ý</strong> — tắt từng kênh tại /settings/notifications hoặc một-cú-nhấp qua link unsubscribe trong email.</>,
          ]}
        />
        <LegalParagraph>
          Để thực hiện, gửi email tới <strong>{siteConfig.contact.email}</strong>. Chúng tôi sẽ
          phản hồi trong vòng 30 ngày.
        </LegalParagraph>
      </Section>

      <Section id="tre-em" title="11. Dữ liệu trẻ em">
        <LegalParagraph>
          Dịch vụ dành cho doanh nghiệp B2B. Chúng tôi không cố ý thu thập dữ liệu của người dưới
          16 tuổi. Nếu bạn cho rằng chúng tôi đã thu thập nhầm dữ liệu trẻ em, vui lòng liên hệ để
          xoá ngay lập tức.
        </LegalParagraph>
      </Section>

      <Section id="tai-khoan-bi-xam-pham" title="12. Sự cố bảo mật">
        <LegalParagraph>
          Trong trường hợp xảy ra sự cố bảo mật làm lộ dữ liệu cá nhân của bạn, chúng tôi sẽ thông
          báo qua email trong vòng <strong>72 giờ</strong> kể từ khi phát hiện, kèm mô tả phạm vi
          ảnh hưởng và biện pháp khắc phục.
        </LegalParagraph>
        <LegalCallout tone="warning">
          Nếu bạn nghi ngờ tài khoản của mình bị xâm phạm, hãy đổi mật khẩu ngay tại{" "}
          <code>/auth/forgot-password</code> và liên hệ {siteConfig.contact.support}.
        </LegalCallout>
      </Section>

      <Section id="thay-doi-chinh-sach" title="13. Thay đổi chính sách">
        <LegalParagraph>
          Chúng tôi có thể cập nhật Chính sách này theo thời gian. Phiên bản hiện hành được công
          bố tại URL này với ngày &quot;hiệu lực từ&quot; ở đầu trang. Thay đổi quan trọng được
          thông báo qua email trước ít nhất 14 ngày.
        </LegalParagraph>
      </Section>

      <Section id="lien-he" title="14. Liên hệ DPO">
        <LegalParagraph>
          {siteConfig.legalName}
          <br />
          Phụ trách dữ liệu (Data Protection): {siteConfig.contact.email}
          <br />
          Hỗ trợ chung: {siteConfig.contact.support}
          <br />
          {siteConfig.contact.address}
        </LegalParagraph>
      </Section>
    </LegalPage>
  )
}
