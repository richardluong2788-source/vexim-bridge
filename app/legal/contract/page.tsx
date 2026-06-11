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

const PATHNAME = "/legal/contract"
const TITLE = "Hợp đồng Xúc tiến Thương mại"
const SUMMARY =
  "Hợp đồng dịch vụ xúc tiến thương mại giữa Vexim Global và doanh nghiệp xuất khẩu Việt Nam — quy định rõ ràng dịch vụ nhận được, phí dịch vụ, thanh toán, quyền lợi, trách nhiệm và cam kết chất lượng của hai bên."
const EFFECTIVE_DATE = "2026-06-11"

const SECTIONS: LegalSection[] = [
  { id: "chu-the", title: "Các bên ký kết" },
  { id: "giai-thich", title: "Giải thích từ ngữ" },
  { id: "dich-vu", title: "Dịch vụ Bên A cung cấp" },
  { id: "quyen-loi-ben-b", title: "Quyền lợi Bên B nhận được" },
  { id: "phi-dich-vu", title: "Phí dịch vụ & cách tính" },
  { id: "thanh-toan", title: "Thanh toán & chuyển khoản" },
  { id: "sla", title: "Cam kết chất lượng dịch vụ (SLA)" },
  { id: "trach-nhiem-ben-b", title: "Trách nhiệm & nghĩa vụ Bên B" },
  { id: "trach-nhiem-ben-a", title: "Trách nhiệm & nghĩa vụ Bên A" },
  { id: "bao-mat", title: "Bảo mật thông tin" },
  { id: "thoi-han", title: "Thời hạn & gia hạn hợp đồng" },
  { id: "cham-dut", title: "Tạm ngưng & chấm dứt hợp đồng" },
  { id: "bat-kha-khang", title: "Trường hợp bất khả kháng" },
  { id: "tranh-chap", title: "Giải quyết tranh chấp" },
  { id: "hieu-luc", title: "Hiệu lực & ký kết" },
]

const PAGE_URL = `${siteConfig.url}${PATHNAME}`

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: `${TITLE} — ${siteConfig.name}`,
  description: SUMMARY,
  alternates: { canonical: PATHNAME },
  openGraph: {
    type: "article",
    locale: "vi_VN",
    url: PAGE_URL,
    siteName: siteConfig.name,
    title: `${TITLE} — ${siteConfig.name}`,
    description: SUMMARY,
  },
  robots: { index: false, follow: false },
}

export default function ContractPage() {
  return (
    <LegalPage
      pathname={PATHNAME}
      title={TITLE}
      summary={SUMMARY}
      effectiveDate={EFFECTIVE_DATE}
      sections={SECTIONS}
    >
      {/* ── PHẦN MỞ ĐẦU ────────────────────────────────────────────── */}
      <Section id="chu-the" title="Điều 1. Các bên ký kết">
        <LegalCallout>
          Hợp đồng này (<strong>"Hợp đồng"</strong>) được ký kết giữa hai bên dưới đây. Toàn bộ
          nội dung được soạn theo Bộ luật Dân sự 2015, Luật Thương mại 2005 và các văn bản pháp
          luật có liên quan của Việt Nam.
        </LegalCallout>

        <LegalSubheading>BÊN A — Đơn vị cung cấp dịch vụ</LegalSubheading>
        <LegalDefinitionList
          items={[
            { term: "Tên công ty", definition: "CÔNG TY TNHH MỘT THÀNH VIÊN VEXIM GLOBAL" },
            { term: "Viết tắt", definition: "Vexim Global / Bên A" },
            { term: "Trụ sở", definition: siteConfig.contact.address },
            { term: "Email", definition: siteConfig.contact.email },
            { term: "Hotline", definition: siteConfig.contact.hotline },
            {
              term: "Tài khoản nhận tiền",
              definition: (
                <>
                  <strong>Số TK: 427313333_</strong> tại Ngân hàng TMCP Quân Đội (MB Bank)
                  <br />
                  Chủ tài khoản: CÔNG TY TNHH MỘT THÀNH VIÊN VEXIM GLOBAL
                </>
              ),
            },
          ]}
        />

        <LegalSubheading>BÊN B — Khách hàng</LegalSubheading>
        <LegalDefinitionList
          items={[
            { term: "Tên công ty", definition: "____________________________________" },
            { term: "Mã số thuế", definition: "____________________________________" },
            { term: "Địa chỉ trụ sở", definition: "____________________________________" },
            { term: "Người đại diện", definition: "____________________________________" },
            { term: "Chức vụ", definition: "____________________________________" },
            { term: "Điện thoại", definition: "____________________________________" },
            { term: "Email liên hệ", definition: "____________________________________" },
          ]}
        />

        <LegalParagraph>
          Hai bên đồng ý ký kết và thực hiện Hợp đồng này với đầy đủ tư cách pháp lý, trên cơ sở
          bình đẳng, tự nguyện và cùng có lợi.
        </LegalParagraph>
      </Section>

      {/* ── ĐIỀU 2 ─────────────────────────────────────────────────── */}
      <Section id="giai-thich" title="Điều 2. Giải thích từ ngữ">
        <LegalParagraph>
          Trong Hợp đồng này, các từ ngữ dưới đây được hiểu thống nhất như sau:
        </LegalParagraph>
        <LegalDefinitionList
          items={[
            {
              term: "Buyer",
              definition:
                "Doanh nghiệp nhập khẩu tại thị trường nước ngoài (chủ yếu Hoa Kỳ) mà Bên A chủ động tiếp cận và giới thiệu sản phẩm của Bên B.",
            },
            {
              term: "Lead",
              definition:
                "Buyer tiềm năng đã được Bên A nghiên cứu, xác minh thông tin và đánh giá phù hợp với ngành hàng của Bên B.",
            },
            {
              term: "Cơ hội (Opportunity)",
              definition:
                "Một giao dịch cụ thể giữa Bên B và một Buyer, được theo dõi xuyên suốt từ khi tiếp cận đến khi chốt hợp đồng thương mại.",
            },
            {
              term: "Hợp đồng thương mại",
              definition:
                "Hợp đồng mua bán hàng hóa xuất khẩu ký trực tiếp giữa Bên B và Buyer — hoàn toàn độc lập, không phải là một phần của Hợp đồng này.",
            },
            {
              term: "Phí Khởi tạo (Setup Fee)",
              definition:
                "Khoản phí một lần khi Bên B bắt đầu sử dụng dịch vụ, dùng để thiết lập hồ sơ, tài khoản và kế hoạch tiếp cận thị trường.",
            },
            {
              term: "Phí Duy trì (Retainer)",
              definition:
                "Khoản phí cố định hàng tháng để Bên A duy trì nhân sự, hoạt động nghiên cứu và tiếp cận Buyer liên tục cho Bên B.",
            },
            {
              term: "Phí Thành công (Success Fee)",
              definition:
                "Khoản phí phát sinh khi Bên B chốt được đơn hàng xuất khẩu thành công, tính theo tỷ lệ phần trăm thỏa thuận trên lợi nhuận biên của đơn hàng đó.",
            },
            {
              term: "Cổng khách hàng",
              definition:
                "Giao diện trực tuyến tại nền tảng Vexim Trade, nơi Bên B theo dõi tiến độ tiếp cận Buyer, cập nhật hồ sơ sản phẩm và xem báo cáo.",
            },
            {
              term: "Ngày làm việc",
              definition:
                "Thứ Hai đến Thứ Sáu, không tính Thứ Bảy, Chủ Nhật và ngày lễ Việt Nam theo quy định pháp luật hiện hành.",
            },
          ]}
        />
      </Section>

      {/* ── ĐIỀU 3 ─────────────────────────────────────────────────── */}
      <Section id="dich-vu" title="Điều 3. Dịch vụ Bên A cung cấp">
        <LegalParagraph>
          Bên A cam kết thực hiện đầy đủ các hoạt động sau trong suốt thời hạn Hợp đồng:
        </LegalParagraph>

        <LegalSubheading>3.1. Nghiên cứu & Xây dựng danh sách Buyer</LegalSubheading>
        <LegalList
          items={[
            "Nghiên cứu và sàng lọc Buyer tiềm năng tại thị trường mục tiêu phù hợp với ngành hàng, quy mô và giá bán của Bên B.",
            "Xác minh thông tin doanh nghiệp, lịch sử nhập khẩu và mức độ phù hợp của từng Buyer trước khi tiếp cận.",
            "Cung cấp tối thiểu số lượng Lead đủ tiêu chuẩn mỗi tháng theo kế hoạch đã thỏa thuận.",
          ]}
        />

        <LegalSubheading>3.2. Tiếp cận & Giao tiếp với Buyer</LegalSubheading>
        <LegalList
          items={[
            "Soạn và gửi email tiếp cận (outreach) tới Buyer thay mặt Bên B, sử dụng công nghệ hỗ trợ AI để cá nhân hóa nội dung.",
            "Theo dõi phản hồi của Buyer, phân loại và chuyển tiếp ngay cho Bên B các phản hồi quan tâm.",
            "Quản lý toàn bộ quá trình trao đổi qua email với Buyer cho đến khi hai bên bắt đầu đàm phán trực tiếp.",
          ]}
        />

        <LegalSubheading>3.3. Hỗ trợ Tuân thủ Pháp lý (FDA & Xuất khẩu)</LegalSubheading>
        <LegalList
          items={[
            "Hỗ trợ theo dõi tình trạng đăng ký FDA và cảnh báo Bên B trước khi chứng nhận hết hạn (tối thiểu 90 ngày).",
            "Hướng dẫn Bên B chuẩn bị hồ sơ tuân thủ cần thiết để đáp ứng yêu cầu của Buyer và quy định nhập khẩu.",
            "Lưu trữ và quản lý tài liệu tuân thủ (Certificate of Analysis, FDA registration, chứng nhận nhà máy) an toàn trên hệ thống.",
          ]}
        />

        <LegalSubheading>3.4. Báo cáo & Theo dõi tiến độ</LegalSubheading>
        <LegalList
          items={[
            "Cung cấp báo cáo tiến độ hàng tuần qua cổng khách hàng, bao gồm số Lead nghiên cứu, email đã gửi và phản hồi nhận được.",
            "Gửi báo cáo tổng kết hàng tháng qua email, tóm tắt kết quả và kế hoạch tháng tiếp theo.",
            "Duy trì cổng khách hàng trực tuyến để Bên B có thể xem trạng thái từng Cơ hội bất kỳ lúc nào.",
          ]}
        />

        <LegalSubheading>3.5. Hỗ trợ Đàm phán & Chốt Hợp đồng Thương mại</LegalSubheading>
        <LegalList
          items={[
            "Tư vấn chiến lược giá, điều khoản thương mại (Incoterms, payment terms) khi Bên B bước vào giai đoạn đàm phán với Buyer.",
            "Hỗ trợ xác minh chuyển tiền SWIFT khi Buyer thanh toán, đảm bảo tính chính xác và an toàn của giao dịch.",
            "Tư vấn chuẩn bị hồ sơ xuất khẩu (PO, hóa đơn thương mại, B/L) phù hợp với yêu cầu của Buyer.",
          ]}
        />
      </Section>

      {/* ── ĐIỀU 4 ─────────────────────────────────────────────────── */}
      <Section id="quyen-loi-ben-b" title="Điều 4. Quyền lợi Bên B nhận được">
        <LegalCallout>
          Dưới đây là toàn bộ quyền lợi Bên B được hưởng trong suốt thời gian sử dụng dịch vụ.
          Bên B có quyền yêu cầu Bên A thực hiện đúng và đầy đủ tất cả các quyền lợi này.
        </LegalCallout>
        <LegalList
          items={[
            <>
              <strong>Nhận Lead chất lượng đã xác minh</strong> — Không tự đi tìm Buyer. Bên B nhận
              danh sách Buyer tiềm năng đã được Bên A nghiên cứu, xác minh lịch sử nhập khẩu và
              đánh giá mức độ phù hợp trước khi tiếp cận.
            </>,
            <>
              <strong>Được đại diện chuyên nghiệp</strong> — Bên A thay mặt Bên B gửi email tiếp
              cận Buyer với nội dung chuyên nghiệp, được cá nhân hóa. Bên B không cần trực tiếp xử
              lý giai đoạn outreach.
            </>,
            <>
              <strong>Theo dõi tiến độ minh bạch</strong> — Bên B có quyền truy cập cổng khách
              hàng 24/7 để xem trạng thái từng Cơ hội, lịch sử liên lạc với Buyer và các tài liệu
              liên quan.
            </>,
            <>
              <strong>Được cảnh báo sớm về pháp lý</strong> — Bên A chủ động thông báo khi chứng
              nhận FDA, COA hoặc tài liệu tuân thủ sắp hết hạn (trước ít nhất 90 ngày), tránh rủi
              ro lô hàng bị từ chối.
            </>,
            <>
              <strong>Nhận báo cáo định kỳ</strong> — Báo cáo tuần gồm số liệu hoạt động; báo cáo
              tháng gồm kết quả tổng hợp và định hướng tháng tới. Tất cả được lưu trữ trên cổng
              khách hàng.
            </>,
            <>
              <strong>Hỗ trợ trực tiếp từ Account Executive</strong> — Mỗi Bên B được phân công
              một nhân viên phụ trách chuyên biệt, có thể liên hệ trực tiếp qua email hoặc điện
              thoại trong giờ hành chính.
            </>,
            <>
              <strong>Bảo mật tuyệt đối thông tin kinh doanh</strong> — Thông tin sản phẩm, giá cả,
              danh sách Buyer và mọi dữ liệu kinh doanh của Bên B được bảo mật nghiêm ngặt, không
              được chia sẻ cho bên thứ ba nếu không có sự đồng ý bằng văn bản.
            </>,
            <>
              <strong>Quyền yêu cầu giải trình SLA</strong> — Nếu Bên A không đáp ứng cam kết chất
              lượng tại Điều 7, Bên B có quyền yêu cầu giải trình và áp dụng cơ chế khấu trừ phí
              theo quy định tại Điều 7.3.
            </>,
          ]}
        />
      </Section>

      {/* ── ĐIỀU 5 ─────────────────────────────────────────────────── */}
      <Section id="phi-dich-vu" title="Điều 5. Phí dịch vụ & cách tính">
        <LegalCallout>
          Cấu trúc phí gồm 3 thành phần độc lập. Mức phí cụ thể được ghi rõ trong{" "}
          <strong>Phụ lục A — Kế hoạch Dịch vụ</strong> đính kèm Hợp đồng này và là một phần không
          tách rời của Hợp đồng.
        </LegalCallout>

        <LegalSubheading>5.1. Phí Khởi tạo (Setup Fee)</LegalSubheading>
        <LegalList
          items={[
            "Thanh toán một lần duy nhất khi ký Hợp đồng, trước khi Bên A bắt đầu triển khai dịch vụ.",
            "Bao gồm: thiết lập hồ sơ công ty, cổng khách hàng, tài khoản hệ thống, kế hoạch tiếp cận thị trường và onboarding ban đầu.",
            "Phí Khởi tạo không được hoàn lại trong bất kỳ trường hợp nào sau khi Bên A đã hoàn thành thiết lập.",
            <>
              Mức phí: <strong>____________________________________</strong>
            </>,
          ]}
        />

        <LegalSubheading>5.2. Phí Duy trì hàng tháng (Monthly Retainer)</LegalSubheading>
        <LegalList
          items={[
            "Phát sinh hàng tháng, tính từ tháng đầu tiên sau khi onboarding hoàn tất.",
            "Đảm bảo Bên A duy trì nhân sự chuyên trách, hoạt động nghiên cứu Lead và tiếp cận Buyer liên tục.",
            "Hóa đơn được gửi qua email vào ngày cố định hàng tháng (ngày neo — billing anchor day) theo thỏa thuận.",
            "Phí Duy trì đã thanh toán không được hoàn lại nếu Bên B tự ý chấm dứt hợp đồng trước hạn.",
            <>
              Mức phí: <strong>____________________________________</strong> / tháng
            </>,
          ]}
        />

        <LegalSubheading>5.3. Phí Thành công (Success Fee)</LegalSubheading>
        <LegalList
          items={[
            "Chỉ phát sinh khi Bên B chốt được đơn hàng xuất khẩu và hàng hóa đã được giao (shipped).",
            "Được tính theo công thức: Success Fee = % thỏa thuận × Lợi nhuận biên của đơn hàng.",
            "Khấu trừ tín dụng Retainer: 50% tổng Phí Duy trì đã thanh toán trong kỳ được khấu trừ vào Success Fee phát sinh trong kỳ đó.",
            "Nếu đơn hàng bị hủy hợp lệ trước khi hàng giao, Success Fee tương ứng không phát sinh.",
            <>
              Tỷ lệ: <strong>____________________________________</strong> % lợi nhuận biên
            </>,
          ]}
        />

        <LegalSubheading>5.4. Nguyên tắc điều chỉnh phí</LegalSubheading>
        <LegalList
          items={[
            "Bên A phải thông báo bằng văn bản trước ít nhất 30 ngày nếu có điều chỉnh mức phí.",
            "Mức phí mới chỉ áp dụng từ chu kỳ thanh toán tiếp theo sau khi Bên B xác nhận bằng văn bản.",
            "Nếu Bên B không đồng ý với mức phí mới, Bên B có quyền chấm dứt Hợp đồng theo quy trình tại Điều 12 mà không bị coi là vi phạm.",
          ]}
        />
      </Section>

      {/* ── ĐIỀU 6 ─────────────────────────────────────────────────── */}
      <Section id="thanh-toan" title="Điều 6. Thanh toán & chuyển khoản">
        <LegalSubheading>6.1. Phương thức thanh toán</LegalSubheading>
        <LegalParagraph>
          Bên B thanh toán bằng chuyển khoản ngân hàng đến tài khoản của Bên A theo thông tin dưới đây:
        </LegalParagraph>
        <LegalDefinitionList
          items={[
            { term: "Tên tài khoản", definition: "CÔNG TY TNHH MỘT THÀNH VIÊN VEXIM GLOBAL" },
            { term: "Số tài khoản", definition: "427313333_" },
            { term: "Ngân hàng", definition: "Ngân hàng TMCP Quân Đội (MB Bank)" },
            {
              term: "Nội dung CK",
              definition: (
                <>
                  Ghi rõ theo mẫu bắt buộc:
                  <br />
                  <strong className="font-mono text-xs bg-muted px-2 py-1 rounded inline-block mt-1">
                    [Tên công ty Bên B] chuyển tiền [loại phí] đợt [số đợt] theo hợp đồng số [số HĐ]
                  </strong>
                  <br />
                  <span className="text-muted-foreground">
                    Ví dụ: &ldquo;Cty TNHH ABC chuyển tiền phí duy trì đợt 1 theo hợp đồng số
                    VXT-2026-001&rdquo;
                  </span>
                </>
              ),
            },
          ]}
        />

        <LegalCallout tone="warning">
          <strong>Lưu ý bắt buộc:</strong> Nội dung chuyển khoản phải ghi đúng theo mẫu trên.
          Thanh toán không ghi nội dung hoặc ghi sai sẽ không được xác nhận tự động và có thể dẫn
          đến chậm kích hoạt dịch vụ. Bên A không chịu trách nhiệm nếu dịch vụ bị gián đoạn do Bên
          B ghi sai nội dung chuyển khoản.
        </LegalCallout>

        <LegalSubheading>6.2. Thời hạn thanh toán</LegalSubheading>
        <LegalList
          items={[
            "Phí Khởi tạo: thanh toán trong vòng 3 ngày làm việc kể từ ngày ký Hợp đồng.",
            "Phí Duy trì hàng tháng: thanh toán trong vòng 7 ngày làm việc kể từ ngày phát hành hóa đơn.",
            "Phí Thành công: thanh toán trong vòng 10 ngày làm việc kể từ ngày Bên A gửi thông báo phát sinh.",
          ]}
        />

        <LegalSubheading>6.3. Hóa đơn quá hạn</LegalSubheading>
        <LegalList
          items={[
            "Sau ngày đến hạn, Bên A gửi nhắc nhở lần 1 qua email.",
            "Sau 7 ngày tiếp theo không thanh toán, Bên A gửi nhắc nhở lần 2 và cảnh báo tạm ngưng dịch vụ.",
            "Sau 30 ngày kể từ ngày đến hạn mà Bên B vẫn không thanh toán, Bên A có quyền tạm dừng toàn bộ dịch vụ đến khi Bên B hoàn thành nghĩa vụ tài chính.",
            "Hóa đơn quá hạn chịu lãi chậm thanh toán 0,05%/ngày trên số tiền chưa thanh toán.",
          ]}
        />

        <LegalSubheading>6.4. Tỷ giá quy đổi</LegalSubheading>
        <LegalParagraph>
          Trường hợp phí được niêm yết bằng USD nhưng Bên B thanh toán bằng VND, tỷ giá áp dụng là
          tỷ giá bán USD của Ngân hàng MB Bank vào ngày làm việc liền kề trước ngày Bên B chuyển
          khoản, hoặc theo tỷ giá đã thỏa thuận cụ thể trong Phụ lục A.
        </LegalParagraph>
      </Section>

      {/* ── ĐIỀU 7 ─────────────────────────────────────────────────── */}
      <Section id="sla" title="Điều 7. Cam kết chất lượng dịch vụ (SLA)">
        <LegalParagraph>
          Bên A cam kết thực hiện dịch vụ đạt các tiêu chuẩn tối thiểu dưới đây. Đây là cơ sở
          pháp lý để Bên B đánh giá chất lượng dịch vụ và yêu cầu bồi thường nếu Bên A vi phạm.
        </LegalParagraph>

        <LegalSubheading>7.1. Các chỉ tiêu SLA</LegalSubheading>
        <LegalDefinitionList
          items={[
            {
              term: "Phản hồi yêu cầu",
              definition:
                "Bên A phản hồi mọi yêu cầu, câu hỏi của Bên B trong vòng 1 ngày làm việc kể từ khi nhận được.",
            },
            {
              term: "Cập nhật pipeline",
              definition:
                "Với mỗi Cơ hội đang hoạt động, Bên A cập nhật ít nhất một lần mỗi tuần (ghi nhận liên lạc, thay đổi trạng thái hoặc ghi chú tiến độ).",
            },
            {
              term: "Gửi báo cáo tuần",
              definition:
                "Báo cáo tuần được gửi trước 10h sáng thứ Hai hàng tuần (giờ Việt Nam). Báo cáo tháng được gửi trước ngày 5 của tháng kế tiếp.",
            },
            {
              term: "Số Lead hàng tháng",
              definition:
                "Số lượng Lead đủ tiêu chuẩn được nghiên cứu và đưa vào cổng khách hàng đạt mức tối thiểu thỏa thuận trong Phụ lục A.",
            },
            {
              term: "Số email tiếp cận",
              definition:
                "Số email outreach gửi tới Buyer đạt mức tối thiểu thỏa thuận trong Phụ lục A mỗi tháng.",
            },
            {
              term: "Xác minh SWIFT",
              definition:
                "Sau khi nhận được chứng từ chuyển tiền SWIFT từ Buyer, Bên A hoàn tất xác minh trong vòng 2 ngày làm việc.",
            },
            {
              term: "Cảnh báo FDA",
              definition:
                "Bên A thông báo cho Bên B khi chứng nhận FDA còn hiệu lực dưới 90 ngày, đảm bảo Bên B có đủ thời gian gia hạn.",
            },
          ]}
        />

        <LegalSubheading>7.2. Cách đo lường</LegalSubheading>
        <LegalParagraph>
          Các chỉ tiêu được đo tự động bởi hệ thống Vexim Trade và tổng hợp vào báo cáo SLA hàng
          tháng. Bên B có thể xem báo cáo này trực tiếp trên cổng khách hàng tại mục &ldquo;SLA &
          Chất lượng dịch vụ&rdquo;.
        </LegalParagraph>

        <LegalSubheading>7.3. Cơ chế xử lý vi phạm SLA</LegalSubheading>
        <LegalParagraph>
          Khi Bên A không đạt chỉ tiêu SLA trong một tháng, hậu quả được áp dụng theo bậc thang
          sau:
        </LegalParagraph>
        <LegalList
          variant="ordered"
          items={[
            <>
              <strong>Vi phạm lần đầu trong tháng</strong> — Bên A gửi thông báo giải trình và kế
              hoạch khắc phục trong vòng 3 ngày làm việc. Không phát sinh khấu trừ tài chính.
            </>,
            <>
              <strong>Vi phạm lần 2 trở lên trong tháng</strong> (chỉ tiêu vận hành: phản hồi,
              pipeline, báo cáo, SWIFT) — Bên B được khấu trừ 5% Phí Duy trì tháng đó trên mỗi
              lần vi phạm, tối đa 20%/tháng.
            </>,
            <>
              <strong>Không đạt chỉ tiêu số lượng</strong> (Lead, email) dưới 80% mục tiêu —
              Khấu trừ 10% Phí Duy trì tháng đó và Bên A có nghĩa vụ bù thiếu hụt vào tháng
              tiếp theo.
            </>,
            <>
              <strong>Vi phạm 3 tháng liên tiếp</strong> — Hai bên tiến hành đánh giá lại hợp
              đồng. Bên B có quyền chấm dứt Hợp đồng trước hạn mà không phát sinh bất kỳ khoản
              phạt nào.
            </>,
          ]}
        />

        <LegalCallout tone="warning">
          Khấu trừ SLA được áp dụng tự động vào hóa đơn Phí Duy trì tháng tương ứng sau thời gian
          xem xét 48 giờ. Trong 48 giờ này, Bên A có thể cung cấp bằng chứng minh ngoại lệ hợp lệ
          (sự cố hệ thống bên thứ ba, sự kiện bất khả kháng) để điều chỉnh trước khi áp dụng.
        </LegalCallout>
      </Section>

      {/* ── ĐIỀU 8 ─────────────────────────────────────────────────── */}
      <Section id="trach-nhiem-ben-b" title="Điều 8. Trách nhiệm & nghĩa vụ Bên B">
        <LegalSubheading>8.1. Cung cấp thông tin đầy đủ và chính xác</LegalSubheading>
        <LegalList
          items={[
            "Cung cấp đầy đủ thông tin doanh nghiệp, sản phẩm, giá cả, sản lượng và tài liệu tuân thủ theo yêu cầu của Bên A trong vòng 5 ngày làm việc kể từ ngày nhận yêu cầu.",
            "Cập nhật ngay khi có thay đổi về giá bán, sản lượng, tình trạng FDA hoặc thông tin liên lạc.",
            "Chịu hoàn toàn trách nhiệm về tính chính xác và tính hợp pháp của mọi thông tin cung cấp cho Bên A.",
          ]}
        />

        <LegalSubheading>8.2. Duy trì năng lực xuất khẩu</LegalSubheading>
        <LegalList
          items={[
            "Đảm bảo sản phẩm tuân thủ mọi quy định pháp luật Việt Nam, quy định FDA Hoa Kỳ và các quy định nhập khẩu tại thị trường mục tiêu.",
            "Gia hạn kịp thời các chứng nhận (FDA, COA, ISO, Organic...) trước ngày hết hạn.",
            "Đảm bảo đủ năng lực sản xuất để đáp ứng đơn hàng khi Buyer xác nhận.",
            "Tự chịu trách nhiệm với mọi tranh chấp, khiếu nại liên quan đến chất lượng sản phẩm, giao hàng, hay vi phạm hợp đồng thương mại với Buyer.",
          ]}
        />

        <LegalSubheading>8.3. Thông báo kịp thời</LegalSubheading>
        <LegalList
          items={[
            "Thông báo cho Bên A trong vòng 2 ngày làm việc khi nhận được phản hồi từ Buyer ngoài hệ thống (điện thoại, gặp trực tiếp).",
            "Thông báo ngay khi ký kết hợp đồng thương mại với Buyer để Bên A theo dõi và tính Phí Thành công đúng hạn.",
            "Thông báo trước ít nhất 30 ngày nếu có ý định chấm dứt Hợp đồng.",
          ]}
        />

        <LegalSubheading>8.4. Thanh toán đúng hạn</LegalSubheading>
        <LegalParagraph>
          Bên B có nghĩa vụ thanh toán đầy đủ và đúng hạn các khoản phí theo Điều 5 và Điều 6.
          Việc chậm thanh toán quá 30 ngày được coi là vi phạm nghiêm trọng Hợp đồng.
        </LegalParagraph>
      </Section>

      {/* ── ĐIỀU 9 ─────────────────────────────────────────────────── */}
      <Section id="trach-nhiem-ben-a" title="Điều 9. Trách nhiệm & nghĩa vụ Bên A">
        <LegalList
          items={[
            "Thực hiện dịch vụ theo đúng phạm vi Điều 3 và đạt các chỉ tiêu SLA tại Điều 7.",
            "Phân công nhân sự có năng lực, kinh nghiệm phù hợp phụ trách từng Bên B.",
            "Bảo mật tuyệt đối mọi thông tin, dữ liệu kinh doanh của Bên B theo Điều 10.",
            "Không tiếp cận trực tiếp Buyer với tư cách độc lập để cạnh tranh với Bên B.",
            "Không sử dụng tên, thương hiệu, sản phẩm hoặc thông tin của Bên B cho mục đích ngoài phạm vi Hợp đồng này.",
            "Thông báo kịp thời cho Bên B khi phát sinh rủi ro ảnh hưởng đến tiến độ hoặc khả năng thành công của Cơ hội.",
            "Lưu trữ toàn bộ hồ sơ, tài liệu và lịch sử giao tiếp với Buyer trong hệ thống ít nhất 3 năm sau khi Hợp đồng kết thúc.",
            "Bồi thường thiệt hại trực tiếp cho Bên B trong trường hợp vi phạm nghĩa vụ bảo mật hoặc cố ý gây thiệt hại.",
          ]}
        />

        <LegalCallout>
          <strong>Giới hạn trách nhiệm:</strong> Bên A không chịu trách nhiệm về kết quả cuối cùng
          của hợp đồng thương mại giữa Bên B và Buyer (Buyer từ chối sau khi đàm phán, thay đổi
          nhu cầu, biến động thị trường, rào cản thương mại quốc tế...). Bên A chịu trách nhiệm về{" "}
          <em>chất lượng dịch vụ xúc tiến</em>, không phải về{" "}
          <em>kết quả hợp đồng thương mại</em>.
        </LegalCallout>
      </Section>

      {/* ── ĐIỀU 10 ────────────────────────────────────────────────── */}
      <Section id="bao-mat" title="Điều 10. Bảo mật thông tin">
        <LegalSubheading>10.1. Phạm vi thông tin bảo mật</LegalSubheading>
        <LegalParagraph>
          Toàn bộ thông tin sau đây được coi là thông tin mật và phải được bảo vệ nghiêm ngặt:
        </LegalParagraph>
        <LegalList
          items={[
            "Thông tin sản phẩm, giá cả, chi phí sản xuất và chiến lược kinh doanh của Bên B.",
            "Danh sách Buyer, lịch sử giao tiếp và thông tin đàm phán.",
            "Nội dung báo cáo, phân tích thị trường và kế hoạch tiếp cận.",
            "Thông tin tài chính, hóa đơn và chi tiết thanh toán.",
            "Mọi thông tin khác mà các bên trao đổi trong quá trình thực hiện Hợp đồng.",
          ]}
        />

        <LegalSubheading>10.2. Nghĩa vụ bảo mật</LegalSubheading>
        <LegalList
          items={[
            "Cả hai bên không được tiết lộ thông tin mật cho bên thứ ba dưới bất kỳ hình thức nào khi chưa có sự đồng ý bằng văn bản của bên kia.",
            "Chỉ những nhân sự trực tiếp thực hiện Hợp đồng mới được tiếp cận thông tin mật, và chỉ ở mức độ cần thiết.",
            "Bên A lưu trữ dữ liệu của Bên B trên hạ tầng đám mây an toàn, có mã hóa dữ liệu lưu trữ và truyền tải.",
          ]}
        />

        <LegalSubheading>10.3. Ngoại lệ</LegalSubheading>
        <LegalParagraph>
          Nghĩa vụ bảo mật không áp dụng với thông tin: (a) đã là thông tin công khai không do lỗi
          vi phạm của bên nhận; (b) bên nhận đã biết trước khi ký Hợp đồng; (c) buộc phải tiết lộ
          theo yêu cầu của cơ quan nhà nước có thẩm quyền — trong trường hợp này phải thông báo
          ngay cho bên kia.
        </LegalParagraph>

        <LegalSubheading>10.4. Thời hạn bảo mật</LegalSubheading>
        <LegalParagraph>
          Nghĩa vụ bảo mật có hiệu lực trong suốt thời gian Hợp đồng và tiếp tục duy trì trong{" "}
          <strong>3 năm</strong> sau khi Hợp đồng chấm dứt vì bất kỳ lý do nào.
        </LegalParagraph>
      </Section>

      {/* ── ĐIỀU 11 ────────────────────────────────────────────────── */}
      <Section id="thoi-han" title="Điều 11. Thời hạn & gia hạn hợp đồng">
        <LegalSubheading>11.1. Thời hạn hợp đồng</LegalSubheading>
        <LegalDefinitionList
          items={[
            { term: "Ngày bắt đầu", definition: "____________________________________" },
            { term: "Ngày kết thúc", definition: "____________________________________" },
            {
              term: "Thời hạn",
              definition: "____ tháng (kể từ ngày Phí Khởi tạo được xác nhận thanh toán)",
            },
          ]}
        />

        <LegalSubheading>11.2. Gia hạn tự động</LegalSubheading>
        <LegalParagraph>
          Hết thời hạn, Hợp đồng tự động gia hạn thêm từng tháng với các điều kiện không đổi, trừ
          khi một trong hai bên thông báo bằng văn bản ý định không gia hạn trước ít nhất{" "}
          <strong>30 ngày</strong> trước ngày kết thúc.
        </LegalParagraph>
      </Section>

      {/* ── ĐIỀU 12 ────────────────────────────────────────────────── */}
      <Section id="cham-dut" title="Điều 12. Tạm ngưng & chấm dứt hợp đồng">
        <LegalSubheading>12.1. Quyền tạm ngưng của Bên A</LegalSubheading>
        <LegalParagraph>
          Bên A có quyền tạm ngưng cung cấp dịch vụ mà không vi phạm Hợp đồng khi:
        </LegalParagraph>
        <LegalList
          items={[
            "Bên B chậm thanh toán quá 30 ngày sau khi đã gửi 2 thông báo nhắc.",
            "Bên B cung cấp thông tin sai lệch, gây hiểu nhầm hoặc ảnh hưởng đến uy tín của Bên A.",
            "Theo yêu cầu của cơ quan nhà nước có thẩm quyền.",
          ]}
        />

        <LegalSubheading>12.2. Chấm dứt có lỗi</LegalSubheading>
        <LegalParagraph>
          Mỗi bên có quyền chấm dứt Hợp đồng ngay lập tức bằng văn bản khi bên kia:
        </LegalParagraph>
        <LegalList
          items={[
            "Vi phạm nghĩa vụ cơ bản của Hợp đồng và không khắc phục trong vòng 15 ngày kể từ khi nhận thông báo yêu cầu khắc phục.",
            "Mất khả năng thanh toán, phá sản hoặc bị giải thể.",
            "Vi phạm nghĩa vụ bảo mật gây thiệt hại đáng kể cho bên kia.",
          ]}
        />

        <LegalSubheading>12.3. Chấm dứt không có lỗi</LegalSubheading>
        <LegalParagraph>
          Bên B có thể chấm dứt Hợp đồng trước hạn mà không cần lý do bằng cách thông báo bằng
          văn bản trước ít nhất <strong>30 ngày</strong>. Trong trường hợp này:
        </LegalParagraph>
        <LegalList
          items={[
            "Phí Duy trì trong 30 ngày thông báo vẫn phát sinh và Bên B có nghĩa vụ thanh toán.",
            "Phí Thành công phát sinh từ các Cơ hội đã được Bên A tiếp cận trước ngày chấm dứt và chốt trong vòng 6 tháng sau đó vẫn thuộc về Bên A.",
            "Phí Khởi tạo không được hoàn lại.",
          ]}
        />

        <LegalSubheading>12.4. Hậu quả sau chấm dứt</LegalSubheading>
        <LegalList
          items={[
            "Bên A chuyển giao toàn bộ hồ sơ, dữ liệu Buyer và tài liệu liên quan đến Bên B trong vòng 10 ngày làm việc.",
            "Bên B có quyền yêu cầu xuất toàn bộ dữ liệu và xóa dữ liệu vĩnh viễn trên hệ thống Bên A sau 30 ngày kể từ ngày chuyển giao.",
            "Các nghĩa vụ còn tồn đọng (tài chính, bảo mật) vẫn tiếp tục có hiệu lực sau khi Hợp đồng chấm dứt.",
          ]}
        />
      </Section>

      {/* ── ĐIỀU 13 ────────────────────────────────────────────────── */}
      <Section id="bat-kha-khang" title="Điều 13. Trường hợp bất khả kháng">
        <LegalParagraph>
          Bên A hoặc Bên B không bị coi là vi phạm Hợp đồng nếu không thực hiện được nghĩa vụ do
          các sự kiện bất khả kháng, bao gồm nhưng không giới hạn: thiên tai, dịch bệnh, chiến
          tranh, lệnh cấm vận quốc tế, hành động của cơ quan nhà nước, hay sự cố kỹ thuật nghiêm
          trọng của bên thứ ba (mất kết nối Internet toàn quốc, sự cố nhà cung cấp dịch vụ đám mây).
        </LegalParagraph>
        <LegalList
          items={[
            "Bên bị ảnh hưởng phải thông báo bằng văn bản cho bên kia trong vòng 3 ngày làm việc kể từ khi sự kiện xảy ra.",
            "Nếu sự kiện bất khả kháng kéo dài quá 30 ngày, mỗi bên có quyền chấm dứt Hợp đồng mà không phát sinh trách nhiệm bồi thường.",
            "Thời gian bất khả kháng được trừ ra khi tính toán vi phạm SLA và các nghĩa vụ thời gian khác.",
          ]}
        />
      </Section>

      {/* ── ĐIỀU 14 ────────────────────────────────────────────────── */}
      <Section id="tranh-chap" title="Điều 14. Giải quyết tranh chấp">
        <LegalSubheading>14.1. Thương lượng trước</LegalSubheading>
        <LegalParagraph>
          Mọi tranh chấp phát sinh từ hoặc liên quan đến Hợp đồng này trước tiên phải được giải
          quyết bằng thương lượng thiện chí giữa đại diện có thẩm quyền của hai bên trong vòng{" "}
          <strong>15 ngày làm việc</strong> kể từ khi một bên nhận được thông báo tranh chấp bằng
          văn bản.
        </LegalParagraph>

        <LegalSubheading>14.2. Hòa giải và Trọng tài</LegalSubheading>
        <LegalParagraph>
          Nếu thương lượng không thành, tranh chấp được đưa ra giải quyết tại{" "}
          <strong>Trung tâm Trọng tài Quốc tế Việt Nam (VIAC)</strong> theo quy tắc tố tụng của
          VIAC hiện hành. Địa điểm trọng tài: Thành phố Hà Nội. Ngôn ngữ tố tụng: tiếng Việt.
        </LegalParagraph>

        <LegalSubheading>14.3. Luật áp dụng</LegalSubheading>
        <LegalParagraph>
          Hợp đồng được điều chỉnh và giải thích theo pháp luật của nước Cộng hòa Xã hội Chủ nghĩa
          Việt Nam. Phán quyết trọng tài là chung thẩm và ràng buộc cả hai bên.
        </LegalParagraph>
      </Section>

      {/* ── ĐIỀU 15 ────────────────────────────────────────────────── */}
      <Section id="hieu-luc" title="Điều 15. Hiệu lực & ký kết">
        <LegalSubheading>15.1. Nguyên tắc chung</LegalSubheading>
        <LegalList
          items={[
            "Hợp đồng này có hiệu lực kể từ ngày cả hai bên ký tên và đóng dấu (nếu có), đồng thời Bên B hoàn thành thanh toán Phí Khởi tạo.",
            "Hợp đồng được lập thành 02 (hai) bản gốc có giá trị pháp lý như nhau, mỗi bên giữ 01 (một) bản.",
            "Mọi sửa đổi, bổ sung Hợp đồng này chỉ có giá trị khi được lập thành văn bản và có chữ ký của đại diện có thẩm quyền cả hai bên.",
            "Các Phụ lục đính kèm là bộ phận không tách rời của Hợp đồng: Phụ lục A (Kế hoạch Dịch vụ & Mức phí), Phụ lục B (Chỉ tiêu SLA chi tiết).",
          ]}
        />

        <LegalSubheading>15.2. Chữ ký</LegalSubheading>

        <div className="mt-6 grid gap-10 sm:grid-cols-2">
          {/* Bên A */}
          <div className="flex flex-col gap-3 rounded-lg border border-border/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Đại diện Bên A
            </p>
            <p className="text-sm font-semibold text-foreground">
              CÔNG TY TNHH MỘT THÀNH VIÊN VEXIM GLOBAL
            </p>
            <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground">
              <div>
                <p className="text-xs uppercase tracking-wide">Họ và tên</p>
                <div className="mt-1 h-0.5 w-full bg-border" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide">Chức vụ</p>
                <div className="mt-1 h-0.5 w-full bg-border" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide">Ngày ký</p>
                <div className="mt-1 h-0.5 w-full bg-border" />
              </div>
              <div className="mt-6">
                <p className="text-xs uppercase tracking-wide">Chữ ký & dấu công ty</p>
                <div className="mt-1 h-16 w-full rounded border border-dashed border-border" />
              </div>
            </div>
          </div>

          {/* Bên B */}
          <div className="flex flex-col gap-3 rounded-lg border border-border/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Đại diện Bên B
            </p>
            <p className="text-sm font-semibold text-foreground">
              [TÊN CÔNG TY BÊN B]
            </p>
            <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground">
              <div>
                <p className="text-xs uppercase tracking-wide">Họ và tên</p>
                <div className="mt-1 h-0.5 w-full bg-border" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide">Chức vụ</p>
                <div className="mt-1 h-0.5 w-full bg-border" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide">Ngày ký</p>
                <div className="mt-1 h-0.5 w-full bg-border" />
              </div>
              <div className="mt-6">
                <p className="text-xs uppercase tracking-wide">Chữ ký & dấu công ty</p>
                <div className="mt-1 h-16 w-full rounded border border-dashed border-border" />
              </div>
            </div>
          </div>
        </div>
      </Section>
    </LegalPage>
  )
}
