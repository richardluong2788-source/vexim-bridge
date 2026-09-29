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
  "Cách Vexim Trade thu thập, lưu trữ và bảo vệ dữ liệu của khách hàng (nhà sản xuất Việt Nam) cùng dữ liệu buyer Hoa Kỳ — bao gồm thông tin FDA, hợp đồng, hóa đơn, tài liệu SWIFT/B/L và email outreach do AI hỗ trợ."
const EFFECTIVE_DATE = "2026-04-26"

const SECTIONS: LegalSection[] = [
  { id: "tong-quan", title: "Tổng quan" },
  { id: "du-lieu-thu-thap", title: "Dữ liệu chúng tôi thu thập" },
  { id: "muc-dich", title: "Mục đích sử dụng" },
  { id: "co-so-phap-ly", title: "Cơ sở pháp lý" },
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
    "chính sách bảo mật Vexim Trade",
    "privacy policy",
    "bảo vệ dữ liệu cá nhân",
    "GDPR xuất khẩu Việt Mỹ",
    "phân quyền bảo mật dữ liệu",
    "mã hoá dữ liệu FDA",
    "Row Level Security",
    "bảo vệ dữ liệu doanh nghiệp",
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
          Vexim Trade cam kết bảo vệ dữ liệu cá nhân và dữ liệu kinh doanh của khách hàng. Chính
          sách này mô tả những loại dữ liệu chúng tôi thu thập khi bạn sử dụng nền tảng tại{" "}
          <strong>{siteConfig.domain}</strong>, cách chúng tôi lưu trữ và bảo vệ dữ liệu, thời gian lưu trữ
          và quyền của bạn.
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
            "Thông tin tài khoản: email, họ tên, số điện thoại và thông tin xác thực được bảo vệ.",
            "Thông tin doanh nghiệp: tên công ty, địa chỉ, ngành nghề, ngôn ngữ ưu tiên (vi/en).",
            "Hồ sơ FDA: Registration Number, ngày đăng ký, ngày hết hạn — được lưu trong bảng profiles.",
            "Tài liệu tuân thủ: chứng nhận FDA, COA, video xưởng, ảnh xưởng, bảng giá sàn và các tài liệu khách hàng cung cấp.",
            "Thông tin sản phẩm: tên, danh mục, công suất, giá vốn, giá bán đề xuất.",
            "Hợp đồng tài chính: setup fee, retainer, success fee %, tỉ lệ retainer credit.",
          ]}
        />
        <LegalSubheading>2.2 Sinh ra trong quá trình sử dụng</LegalSubheading>
        <LegalList
          items={[
            "Thông tin lead/buyer do Vexim Trade nghiên cứu và quản lý để hỗ trợ khách hàng.",
            "Nội dung email tiếp cận buyer có thể được AI hỗ trợ soạn và được nhân sự Vexim Trade xem xét trước khi gửi.",
            "Một số trường mô tả doanh nghiệp/sản phẩm do supplier nhập có thể được xử lý qua Vercel AI Gateway để dịch sang tiếng Anh. Tên doanh nghiệp, tên người liên hệ, thông tin đăng nhập, email, số điện thoại, mã số thuế và mã sản phẩm không được gửi để dịch; nội dung gốc được giữ lại cho nhân sự Vexim đối chiếu và bản dịch được kiểm tra trước khi công khai.",
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
            "Cookie phiên làm việc giúp duy trì trạng thái đăng nhập và bảo vệ phiên truy cập.",
            "Địa chỉ IP, user agent, timestamp request — phục vụ phát hiện gian lận và debug.",
            "Số liệu truy cập tổng hợp, được sử dụng để theo dõi và cải thiện hoạt động của nền tảng.",
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
            { term: "Cung cấp dịch vụ", definition: "Vexim Trade sử dụng thông tin để tiếp nhận yêu cầu, quản lý hồ sơ khách hàng và hỗ trợ hoạt động phát triển xuất khẩu." },
            { term: "Xử lý hồ sơ sản phẩm", definition: "Tiếp nhận, xem xét và quản lý thông tin sản phẩm do khách hàng cung cấp. Hồ sơ không tự động được công khai; trước khi chia sẻ với buyer/đối tác, Vexim Trade sẽ xin chấp thuận của khách hàng." },
            { term: "Dịch hồ sơ intake", definition: "Một số trường mô tả tự do được dịch sang tiếng Anh bằng AI để buyer quốc tế dễ đọc. Nội dung gốc được giữ lại; nhân sự Vexim kiểm tra bản dịch trước khi phê duyệt hoặc công khai." },
            { term: "Hỗ trợ giao tiếp", definition: "Soạn và quản lý nội dung trao đổi với khách hàng hoặc buyer; công cụ AI có thể hỗ trợ một số bước, còn nội dung gửi đi được nhân sự Vexim Trade xem xét." },
            { term: "Bảo mật và vận hành", definition: "Phân quyền truy cập, phát hiện hoạt động bất thường, duy trì nhật ký kiểm tra và bảo vệ tài khoản/hồ sơ." },
            { term: "Tuân thủ pháp luật", definition: "Lưu trữ hồ sơ kế toán, hợp đồng và tài liệu giao dịch trong thời hạn pháp luật yêu cầu." },
            { term: "Thông báo dịch vụ", definition: "Gửi thông tin liên quan đến tài khoản, hồ sơ, yêu cầu hỗ trợ và các cập nhật dịch vụ cần thiết." },
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

      <Section id="luu-tru-mai-hoa" title="5. Lưu trữ & mã hoá">
        <LegalList
          items={[
            <><strong>Trên đường truyền:</strong> áp dụng kết nối mã hoá để bảo vệ dữ liệu khi truyền giữa người dùng và hệ thống.</>,
            <><strong>Khi lưu trữ:</strong> áp dụng biện pháp mã hoá và kiểm soát truy cập phù hợp để bảo vệ dữ liệu.</>,
            <><strong>Phân quyền truy cập:</strong> Vexim Trade giới hạn quyền theo vai trò và chỉ cấp quyền cần thiết cho công việc được giao.</>,
            <><strong>Mật khẩu:</strong> không lưu dưới dạng văn bản thuần; thông tin xác thực được bảo vệ bằng cơ chế băm.</>,
            <><strong>Token public link (hóa đơn, share doc, unsubscribe):</strong> sinh bằng crypto-random, single-purpose, có thể revoke.</>,
            <><strong>Buyer PII mask:</strong> vai trò lead_researcher chỉ thấy email/phone đã che (mask) — áp dụng ở tầng UI và một phần ở DB.</>,
          ]}
        />
      </Section>

      <Section id="thoi-gian-luu" title="6. Thời gian lưu trữ">
        <LegalDefinitionList
          items={[
            { term: "Tài khoản & profile", definition: "Lưu trong suốt thời gian hợp đồng + 12 tháng sau khi chấm dứt (cho mục đích pháp lý)." },
            { term: "Hóa đơn & hồ sơ tài chính", definition: "Lưu tối thiểu 10 năm theo luật kế toán Việt Nam." },
            { term: "SWIFT, PO, B/L", definition: "Lưu tối thiểu 10 năm." },
            { term: "Activity log & stage transitions", definition: "Lưu tối thiểu 5 năm để phục vụ kiểm toán và phân tích." },
            { term: "Email log (notification_email_log)", definition: "Lưu 24 tháng để xử lý khiếu nại không nhận được email." },
            { term: "Số liệu truy cập tổng hợp", definition: "Được lưu trong thời gian cần thiết cho việc theo dõi và cải thiện nền tảng." },
          ]}
        />
      </Section>

      <Section id="chuyen-du-lieu-quoc-te" title="7. Chuyển dữ liệu quốc tế">
        <LegalParagraph>
          Do hoạt động hỗ trợ xuất khẩu quốc tế, dữ liệu của bạn có thể được Vexim Trade xử lý tại
          Việt Nam hoặc một số quốc gia khác khi cần thiết cho việc cung cấp dịch vụ. Khi có hoạt
          động chuyển dữ liệu xuyên biên giới, Vexim Trade áp dụng các biện pháp phù hợp theo
          pháp luật hiện hành.
        </LegalParagraph>
      </Section>

      <Section id="an-toan" title="8. Biện pháp an toàn">
        <LegalList
          items={[
            "Phân quyền tối thiểu (least privilege) — capability matrix 7 vai trò.",
            "Tách biệt trách nhiệm (Segregation of Duties) — SWIFT verifier ≠ uploader, AE không sửa cost_price.",
            "Compliance gate — opportunity không thể vượt sample_requested nếu FDA hết hạn.",
            "Audit log append-only cho mọi thay đổi quan trọng (stage transitions, role changes).",
            "Các tác vụ tự động của Vexim Trade được xác thực và giới hạn quyền truy cập.",
            "Email mời và token public link đều single-use hoặc có thể revoke.",
            "Thông tin xác thực có quyền cao chỉ được sử dụng trong môi trường máy chủ được kiểm soát.",
            "Dữ liệu được sao lưu định kỳ và có quy trình hỗ trợ khôi phục khi cần.",
          ]}
        />
      </Section>

      <Section id="quyen-cua-ban" title="9. Quyền của bạn">
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

      <Section id="tre-em" title="10. Dữ liệu trẻ em">
        <LegalParagraph>
          Dịch vụ dành cho doanh nghiệp B2B. Chúng tôi không cố ý thu thập dữ liệu của người dưới
          16 tuổi. Nếu bạn cho rằng chúng tôi đã thu thập nhầm dữ liệu trẻ em, vui lòng liên hệ để
          xoá ngay lập tức.
        </LegalParagraph>
      </Section>

      <Section id="tai-khoan-bi-xam-pham" title="11. Sự cố bảo mật">
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

      <Section id="thay-doi-chinh-sach" title="12. Thay đổi chính sách">
        <LegalParagraph>
          Chúng tôi có thể cập nhật Chính sách này theo thời gian. Phiên bản hiện hành được công
          bố tại URL này với ngày &quot;hiệu lực từ&quot; ở đầu trang. Thay đổi quan trọng được
          thông báo qua email trước ít nhất 14 ngày.
        </LegalParagraph>
      </Section>

      <Section id="lien-he" title="13. Liên hệ DPO">
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
