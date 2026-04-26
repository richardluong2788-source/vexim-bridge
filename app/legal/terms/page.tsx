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

const PATHNAME = "/legal/terms"
const TITLE = "Điều khoản dịch vụ"
const SUMMARY =
  "Điều khoản pháp lý quy định việc sử dụng nền tảng Vexim Bridge để tìm buyer Mỹ, đăng ký FDA, xác thực chuyển tiền SWIFT và thanh toán USD/VND giữa khách hàng (nhà sản xuất Việt Nam) và Vexim Bridge."
const EFFECTIVE_DATE = "2026-04-26"

const SECTIONS: LegalSection[] = [
  { id: "gioi-thieu", title: "Giới thiệu" },
  { id: "dinh-nghia", title: "Định nghĩa" },
  { id: "tai-khoan", title: "Tài khoản & vai trò" },
  { id: "pham-vi-dich-vu", title: "Phạm vi dịch vụ" },
  { id: "phi-thanh-toan", title: "Phí & thanh toán" },
  { id: "fda-tuan-thu", title: "Tuân thủ FDA & rủi ro pháp lý" },
  { id: "swift", title: "Xác thực chuyển tiền SWIFT" },
  { id: "du-lieu-cua-ban", title: "Dữ liệu khách hàng" },
  { id: "trach-nhiem", title: "Trách nhiệm các bên" },
  { id: "so-huu-tri-tue", title: "Sở hữu trí tuệ" },
  { id: "cham-dut", title: "Tạm ngưng & chấm dứt" },
  { id: "gioi-han-trach-nhiem", title: "Giới hạn trách nhiệm" },
  { id: "luat-ap-dung", title: "Luật áp dụng & giải quyết tranh chấp" },
  { id: "thay-doi", title: "Thay đổi điều khoản" },
  { id: "lien-he", title: "Liên hệ" },
]

// IMPORTANT: do NOT name this `URL` — that would shadow the global URL
// constructor used by `new URL(...)` inside `metadataBase` and crash the
// route at module-load (rendered as a 404 in production).
const PAGE_URL = `${siteConfig.url}${PATHNAME}`

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: `${TITLE} — ${siteConfig.name}`,
  description: SUMMARY,
  keywords: [
    "điều khoản dịch vụ Vexim Bridge",
    "terms of service",
    "điều khoản xuất khẩu Việt Mỹ",
    "đăng ký FDA điều khoản",
    "phí success fee retainer setup fee",
    "thanh toán SWIFT VietQR",
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

export default function TermsOfServicePage() {
  return (
    <LegalPage
      pathname={PATHNAME}
      title={TITLE}
      summary={SUMMARY}
      effectiveDate={EFFECTIVE_DATE}
      sections={SECTIONS}
    >
      <Section id="gioi-thieu" title="1. Giới thiệu">
        <LegalParagraph>
          Tài liệu này (&quot;<strong>Điều khoản</strong>&quot;) là thỏa thuận pháp lý giữa{" "}
          <strong>{siteConfig.legalName}</strong> (&quot;<strong>Vexim Bridge</strong>&quot;,
          &quot;chúng tôi&quot;) và bạn — cá nhân hoặc tổ chức (&quot;<strong>Khách hàng</strong>&quot;,
          &quot;bạn&quot;) — về việc sử dụng nền tảng Vexim Bridge tại{" "}
          <strong>{siteConfig.domain}</strong>, bao gồm trang quản trị {siteConfig.url}/admin và
          cổng khách hàng {siteConfig.url}/client (gọi chung là &quot;Dịch vụ&quot;).
        </LegalParagraph>
        <LegalParagraph>
          Bằng việc tạo tài khoản, đăng nhập, hoặc sử dụng bất kỳ phần nào của Dịch vụ, bạn xác nhận
          đã đọc, hiểu và đồng ý chịu ràng buộc bởi toàn bộ Điều khoản này cùng với{" "}
          <a href="/legal/privacy" className="font-medium underline-offset-4 hover:underline">
            Chính sách bảo mật
          </a>{" "}
          và{" "}
          <a href="/legal/cookies" className="font-medium underline-offset-4 hover:underline">
            Chính sách cookie
          </a>
          . Nếu bạn không đồng ý, vui lòng không sử dụng Dịch vụ.
        </LegalParagraph>
      </Section>

      <Section id="dinh-nghia" title="2. Định nghĩa">
        <LegalDefinitionList
          items={[
            { term: "Buyer", definition: "Doanh nghiệp nhập khẩu (thường tại Hoa Kỳ) mà Vexim Bridge tiếp cận thay mặt bạn." },
            { term: "Lead", definition: "Buyer tiềm năng được Vexim Bridge nghiên cứu và lưu trong hệ thống." },
            { term: "Opportunity", definition: "Cơ hội bán hàng cụ thể giữa Khách hàng và một Buyer, đi qua pipeline 10 trạng thái từ new đến won/lost." },
            { term: "Deal", definition: "Phần tài chính của Opportunity đã chốt — bao gồm PO, hóa đơn, B/L, SWIFT, giá vốn, giá bán và lợi nhuận." },
            { term: "Setup fee", definition: "Phí khởi tạo hợp đồng tính một lần khi Khách hàng được onboard." },
            { term: "Retainer", definition: "Phí giữ chỗ định kỳ hàng tháng theo billing plan của Khách hàng." },
            { term: "Success fee", definition: "Phần trăm lợi nhuận biên (profit_margin_usd) của Deal đã ship, được khấu trừ 50% Retainer đã trả trước (retainer credit)." },
            { term: "FDA", definition: "U.S. Food and Drug Administration — cơ quan Hoa Kỳ quản lý 4 ngành Vexim Bridge phục vụ: thực phẩm, thực phẩm chức năng (DSHEA), mỹ phẩm (MoCRA) và thiết bị y tế (510(k))." },
            { term: "SWIFT", definition: "Thông điệp chuyển tiền liên ngân hàng quốc tế xác nhận Buyer đã thanh toán USD." },
          ]}
        />
      </Section>

      <Section id="tai-khoan" title="3. Tài khoản & vai trò">
        <LegalParagraph>
          Vexim Bridge sử dụng mô hình phân quyền 7 vai trò (super_admin, admin, account_executive,
          lead_researcher, finance, staff, client). Khách hàng được cấp vai trò <em>client</em> và
          truy cập cổng /client thông qua link mời gửi qua email.
        </LegalParagraph>
        <LegalSubheading>3.1 Trách nhiệm tài khoản</LegalSubheading>
        <LegalList
          items={[
            "Bạn chịu trách nhiệm bảo mật mật khẩu, thiết bị và mọi hoạt động phát sinh từ tài khoản của bạn.",
            "Bạn cam kết cung cấp thông tin doanh nghiệp chính xác (tên công ty, ngành, FDA Registration Number, người đại diện, email liên hệ).",
            "Mỗi tài khoản chỉ dành cho một cá nhân/tổ chức được uỷ quyền — không chia sẻ thông tin đăng nhập.",
            "Bạn phải thông báo cho chúng tôi ngay khi nghi ngờ tài khoản bị xâm phạm.",
          ]}
        />
        <LegalSubheading>3.2 Người dùng nội bộ của Vexim Bridge</LegalSubheading>
        <LegalParagraph>
          Các vai trò admin shell của Vexim Bridge chỉ truy cập dữ liệu của bạn ở mức cần thiết để
          cung cấp Dịch vụ. Đặc biệt: nhân viên nghiên cứu (lead_researcher) chỉ thấy thông tin
          buyer ở dạng đã che (mask PII), và account executive không có quyền sửa giá vốn (cost
          price) — đây là biện pháp tách biệt trách nhiệm (segregation of duties) bắt buộc.
        </LegalParagraph>
      </Section>

      <Section id="pham-vi-dich-vu" title="4. Phạm vi dịch vụ">
        <LegalParagraph>Vexim Bridge cung cấp các dịch vụ sau:</LegalParagraph>
        <LegalList
          items={[
            <>Đăng ký và theo dõi tuân thủ FDA (Food Facility Registration, Cosmetic Listing MoCRA, DSHEA, 510(k)).</>,
            <>Nghiên cứu, làm giàu dữ liệu (Apollo) và quản lý buyer Mỹ trong cơ sở dữ liệu của bạn.</>,
            <>Soạn email outreach hỗ trợ AI (Vercel AI Gateway), gửi qua Resend và phân loại email phản hồi của buyer.</>,
            <>Quản lý pipeline kanban 10 trạng thái cho Vexim Bridge và 5 phase cho cổng khách hàng.</>,
            <>Xác thực chuyển tiền SWIFT 2 bước (uploader ≠ verifier) và lưu trữ tài liệu PO/SWIFT/B/L trên Vercel Blob private storage.</>,
            <>Phát hành hóa đơn Setup Fee, Retainer, Success Fee với mã VietQR (Napas 247) và link xem hóa đơn công khai bằng token.</>,
            <>Báo cáo &amp; analytics đa lớp (Overview, By client, Bottleneck, Lost analysis, Buyer performance).</>,
          ]}
        />
        <LegalCallout>
          <strong>Không bao gồm:</strong> Vexim Bridge không phải là người vận chuyển, không phải
          ngân hàng, không phải U.S. Agent FDA mặc định, và không cung cấp tư vấn pháp lý/thuế chính
          thức. Các dịch vụ này nếu phát sinh sẽ được cung cấp bởi đối tác bên thứ ba theo hợp đồng
          riêng.
        </LegalCallout>
      </Section>

      <Section id="phi-thanh-toan" title="5. Phí & thanh toán">
        <LegalSubheading>5.1 Cấu trúc phí</LegalSubheading>
        <LegalParagraph>
          Doanh thu Vexim Bridge gồm 3 cấu phần được quy định trong &quot;Billing Plan&quot; của
          từng Khách hàng:
        </LegalParagraph>
        <LegalList
          variant="ordered"
          items={[
            <><strong>Setup fee</strong> — phí khởi tạo, thanh toán một lần khi onboard.</>,
            <><strong>Monthly retainer</strong> — phí giữ chỗ hàng tháng, hệ thống tự động phát hành hóa đơn vào ngày anchor cố định.</>,
            <><strong>Success fee</strong> — % của <em>profit_margin_usd</em> trên mỗi Deal đã ship, sau khi đã khấu trừ 50% retainer đã trả trước (retainer credit).</>,
          ]}
        />
        <LegalSubheading>5.2 Phương thức thanh toán</LegalSubheading>
        <LegalParagraph>
          Hóa đơn được gửi qua email kèm link công khai (token-protected). Phần thanh toán VND có
          mã VietQR theo chuẩn Napas 247 đến tài khoản pháp nhân Vexim Bridge ghi trong cấu hình
          Finance Settings. Phần USD được chuyển về tài khoản ngân hàng tương ứng theo hướng dẫn
          ghi trên hóa đơn.
        </LegalParagraph>
        <LegalSubheading>5.3 Hóa đơn quá hạn</LegalSubheading>
        <LegalParagraph>
          Hóa đơn được đánh dấu &quot;quá hạn&quot; tự động sau ngày đến hạn thông qua cron job
          hằng ngày. Vexim Bridge có quyền tạm ngưng dịch vụ với hóa đơn quá hạn trên 30 ngày sau
          khi đã gửi 2 thông báo nhắc.
        </LegalParagraph>
        <LegalSubheading>5.4 Hủy &amp; hoàn tiền</LegalSubheading>
        <LegalParagraph>
          Setup fee và Retainer đã thanh toán không được hoàn lại. Success fee chỉ phát sinh khi
          Deal đã ship — nếu Deal bị huỷ hợp lệ trước khi ship, Success fee tương ứng không phát
          sinh.
        </LegalParagraph>
      </Section>

      <Section id="fda-tuan-thu" title="6. Tuân thủ FDA & rủi ro pháp lý">
        <LegalParagraph>
          Khách hàng chịu trách nhiệm đảm bảo sản phẩm tuân thủ tất cả quy định FDA và các luật
          liên quan của Hoa Kỳ. Vexim Bridge hỗ trợ thu thập và theo dõi tài liệu tuân thủ
          (compliance_docs) nhưng không thay thế nghĩa vụ pháp lý của bạn.
        </LegalParagraph>
        <LegalCallout tone="warning">
          <strong>Cổng tuân thủ:</strong> hệ thống tự động chặn opportunity tiến tới giai đoạn
          sample_requested trở đi nếu FDA Registration của Khách hàng không hợp lệ hoặc đã hết hạn.
          Bạn có nghĩa vụ gia hạn FDA trước ngày hết hạn và cập nhật vào hệ thống.
        </LegalCallout>
        <LegalParagraph>
          Khách hàng cam kết:
        </LegalParagraph>
        <LegalList
          items={[
            "Cung cấp tài liệu chứng nhận, COA, video xưởng và các tài liệu khác theo yêu cầu của Vexim Bridge và Buyer.",
            "Chỉ chào bán sản phẩm mà Khách hàng có quyền hợp pháp sản xuất, xuất khẩu và nhập vào Hoa Kỳ.",
            "Tự chịu trách nhiệm với mọi yêu cầu thu hồi (recall), khiếu nại an toàn sản phẩm hoặc tranh chấp với Buyer.",
          ]}
        />
      </Section>

      <Section id="swift" title="7. Xác thực chuyển tiền SWIFT">
        <LegalParagraph>
          Mỗi Deal yêu cầu chuyển khoản SWIFT đều bắt buộc trải qua quy trình xác thực 2 bước
          (Segregation of Duties): người tải lên SWIFT (<code>swift_uploaded_by</code>) phải khác
          người xác minh (<code>swift_verified_by</code>). Ràng buộc này được áp dụng ở tầng cơ sở
          dữ liệu thông qua DB CHECK constraint, không thể bypass.
        </LegalParagraph>
        <LegalParagraph>
          Vexim Bridge không chịu trách nhiệm với thiệt hại phát sinh do Buyer không thanh toán,
          ngân hàng từ chối, hoặc lệnh trừng phạt quốc tế áp dụng lên giao dịch.
        </LegalParagraph>
      </Section>

      <Section id="du-lieu-cua-ban" title="8. Dữ liệu khách hàng">
        <LegalParagraph>
          Bạn giữ toàn bộ quyền sở hữu đối với dữ liệu doanh nghiệp, sản phẩm, hợp đồng và tài liệu
          tuân thủ mà bạn tải lên. Vexim Bridge có quyền sử dụng dữ liệu ở mức tối thiểu cần thiết
          để cung cấp Dịch vụ — chi tiết tại{" "}
          <a href="/legal/privacy" className="font-medium underline-offset-4 hover:underline">
            Chính sách bảo mật
          </a>
          .
        </LegalParagraph>
        <LegalParagraph>
          Khi chấm dứt hợp đồng, bạn có thể yêu cầu xuất dữ liệu (CSV) và xoá dữ liệu vĩnh viễn
          theo quy trình tại Chính sách bảo mật, mục &quot;Quyền của bạn&quot;.
        </LegalParagraph>
      </Section>

      <Section id="trach-nhiem" title="9. Trách nhiệm các bên">
        <LegalSubheading>9.1 Vexim Bridge</LegalSubheading>
        <LegalList
          items={[
            "Triển khai biện pháp bảo mật hợp lý (RLS, TLS, mã hoá tại nghỉ, phân quyền tối thiểu).",
            "Duy trì sao lưu định kỳ theo chính sách của Supabase.",
            "Thông báo bạn trong vòng 72 giờ kể từ khi phát hiện sự cố bảo mật ảnh hưởng đến dữ liệu của bạn.",
            "Cung cấp cron job hợp lệ và xử lý hóa đơn theo lịch định kỳ.",
          ]}
        />
        <LegalSubheading>9.2 Khách hàng</LegalSubheading>
        <LegalList
          items={[
            "Không sử dụng Dịch vụ vào mục đích bất hợp pháp, gian lận, hay vi phạm quyền của bên thứ ba.",
            "Không thực hiện reverse engineering, scrape có chủ đích, hoặc thử phá vỡ giới hạn truy cập của hệ thống.",
            "Không tải lên virus, mã độc, dữ liệu trẻ em, dữ liệu y tế cá nhân (PHI) hay nội dung vi phạm bản quyền.",
            "Đảm bảo nội dung email outreach do AI tạo ra tuân thủ luật chống spam (CAN-SPAM Act, GDPR nếu áp dụng) và đã được bạn duyệt trước khi gửi.",
          ]}
        />
      </Section>

      <Section id="so-huu-tri-tue" title="10. Sở hữu trí tuệ">
        <LegalParagraph>
          Toàn bộ phần mềm, mã nguồn, thiết kế UI, logo Vexim Bridge và tài liệu hướng dẫn thuộc
          quyền sở hữu của {siteConfig.legalName}. Bạn được cấp giấy phép sử dụng phi độc quyền,
          không chuyển nhượng để truy cập Dịch vụ trong thời gian hợp đồng còn hiệu lực.
        </LegalParagraph>
        <LegalParagraph>
          Phản hồi/đề xuất bạn gửi cho chúng tôi (feedback) có thể được Vexim Bridge sử dụng tự do
          để cải tiến Dịch vụ mà không phát sinh nghĩa vụ thanh toán.
        </LegalParagraph>
      </Section>

      <Section id="cham-dut" title="11. Tạm ngưng & chấm dứt">
        <LegalParagraph>
          Vexim Bridge có thể tạm ngưng hoặc chấm dứt tài khoản của bạn nếu phát hiện vi phạm
          nghiêm trọng Điều khoản, hóa đơn quá hạn không thanh toán, hoặc theo yêu cầu của cơ quan
          có thẩm quyền. Bạn cũng có thể chấm dứt sử dụng Dịch vụ bất kỳ lúc nào bằng văn bản gửi
          tới {siteConfig.contact.email}.
        </LegalParagraph>
      </Section>

      <Section id="gioi-han-trach-nhiem" title="12. Giới hạn trách nhiệm">
        <LegalParagraph>
          Trong phạm vi pháp luật cho phép, tổng trách nhiệm tích lũy của Vexim Bridge đối với mọi
          khiếu nại liên quan đến Dịch vụ được giới hạn ở khoản phí mà Khách hàng đã trả cho Vexim
          Bridge trong 12 tháng liền kề trước sự kiện phát sinh khiếu nại.
        </LegalParagraph>
        <LegalParagraph>
          Vexim Bridge không chịu trách nhiệm với thiệt hại gián tiếp, ngẫu nhiên, hệ quả hay mất
          lợi nhuận, kể cả khi đã được thông báo trước về khả năng phát sinh.
        </LegalParagraph>
      </Section>

      <Section id="luat-ap-dung" title="13. Luật áp dụng & giải quyết tranh chấp">
        <LegalParagraph>
          Điều khoản này được điều chỉnh và giải thích theo pháp luật Việt Nam. Mọi tranh chấp phát
          sinh trước hết được giải quyết bằng thương lượng thiện chí; nếu không đạt được thoả
          thuận, tranh chấp sẽ được đưa ra Trung tâm Trọng tài Quốc tế Việt Nam (VIAC) tại Thành
          phố Hồ Chí Minh theo quy tắc tố tụng của VIAC.
        </LegalParagraph>
      </Section>

      <Section id="thay-doi" title="14. Thay đổi điều khoản">
        <LegalParagraph>
          Vexim Bridge có thể cập nhật Điều khoản này khi cần. Mọi thay đổi quan trọng sẽ được
          thông báo qua email và/hoặc thông báo trong ứng dụng ít nhất 14 ngày trước khi có hiệu
          lực. Việc tiếp tục sử dụng Dịch vụ sau ngày hiệu lực được xem là chấp nhận phiên bản
          Điều khoản mới.
        </LegalParagraph>
      </Section>

      <Section id="lien-he" title="15. Liên hệ">
        <LegalParagraph>
          {siteConfig.legalName}
          <br />
          {siteConfig.contact.address}
          <br />
          Email: {siteConfig.contact.email}
          <br />
          Hỗ trợ: {siteConfig.contact.support}
        </LegalParagraph>
      </Section>
    </LegalPage>
  )
}
