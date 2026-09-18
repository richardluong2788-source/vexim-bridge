import type { Metadata } from "next"
import Link from "next/link"
import {
  BookOpen,
  Target,
  ShieldCheck,
  Route,
  Coffee,
  Boxes,
  Search,
  UserPlus,
  FileCheck2,
  Factory,
  Package,
  Paperclip,
  Globe,
  Receipt,
  BellRing,
  Handshake,
  Gauge,
  Eye,
  CalendarCheck,
  CircleAlert,
  TrendingUp,
  Bot,
  Building2,
  Award,
  Lock,
  Link2,
  MessagesSquare,
  ClipboardList,
  Send,
} from "lucide-react"
import {
  SopSection,
  SubHeading,
  Toc,
  Flow,
  FlowNode,
  FlowArrow,
  Decision,
  Swimlane,
  Callout,
  DoDont,
  RuleTable,
  Screen,
  Ui,
  Pill,
  StepList,
  Step,
  TONE,
} from "@/components/knowledge/sop-kit"

export const metadata: Metadata = { title: "Tài liệu vận hành SR — Vexim Bridge" }

export default function SRSopPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      {/* Header */}
      <header className="mb-8 rounded-2xl border bg-gradient-to-br from-amber-500/10 via-transparent to-transparent p-7">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link href="/admin/knowledge" className="inline-flex items-center gap-1 hover:text-foreground">
            <BookOpen className="h-4 w-4" /> Trung tâm kiến thức
          </Link>
          <span>/</span>
          <Pill tone="amber">Supplier Researcher (SR)</Pill>
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight lg:text-4xl">
          Tài liệu vận hành Bộ phận SR
        </h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          Tài liệu chuẩn cho Chuyên viên nghiên cứu &amp; tuyển nhà cung cấp (Supplier Researcher):
          cách đọc nhu cầu buyer, tìm và định danh doanh nghiệp Việt Nam đủ năng lực, xây dựng hồ
          sơ năng lực – sản phẩm – chứng từ, xuất bản hồ sơ giới thiệu, đề xuất hợp đồng thương mại
          và bàn giao cho AE vận hành. Đọc theo sơ đồ là hiểu ngay mỗi việc vào màn hình nào, bấm
          nút gì, hệ thống tự làm gì và giới hạn nào không được vượt.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border bg-card px-3 py-1">Áp dụng: SR · admin · super_admin</span>
          <span className="rounded-full border bg-card px-3 py-1">Cập nhật: 09/2026</span>
          <span className="rounded-full border bg-card px-3 py-1">Thời gian đọc: ~20 phút</span>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        {/* TOC */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Toc
            items={[
              { href: "#mission", label: "Vai trò & màn hình chính", icon: Target },
              { href: "#golden-rules", label: "8 nguyên tắc vàng", icon: ShieldCheck },
              { href: "#big-picture", label: "Toàn cảnh hành trình NCC", icon: Route },
              { href: "#phase0", label: "Chuẩn bị đầu ngày", icon: Coffee },
              { href: "#phase1", label: "S1 — Đọc nhu cầu thị trường", icon: Boxes },
              { href: "#phase2", label: "S2 — Tìm & đưa NCC vào hệ thống", icon: Search },
              { href: "#phase3", label: "S3 — Duyệt hồ sơ đăng ký", icon: FileCheck2 },
              { href: "#phase4", label: "S4 — Đánh giá năng lực nhà máy", icon: Factory },
              { href: "#phase5", label: "S5 — Xây danh mục sản phẩm", icon: Package },
              { href: "#phase6", label: "S6 — Chứng từ & link chia sẻ", icon: Paperclip },
              { href: "#phase7", label: "S7 — Xuất bản hồ sơ công khai", icon: Globe },
              { href: "#phase8", label: "S8 — Đề xuất hợp đồng", icon: Receipt },
              { href: "#phase9", label: "S9 — Đốc thu & gia hạn", icon: BellRing },
              { href: "#handoff", label: "Bàn giao cho AE", icon: Handshake },
              { href: "#thresholds", label: "Bảng mốc & giới hạn", icon: Gauge },
              { href: "#client-visibility", label: "Nhà cung cấp nhìn thấy gì", icon: Eye },
              { href: "#checklist", label: "Checklist ngày & tuần", icon: CalendarCheck },
              { href: "#errors", label: "Thông báo thường gặp", icon: CircleAlert },
              { href: "#metrics", label: "Theo dõi hiệu quả công việc", icon: TrendingUp },
            ]}
          />
        </aside>

        <article className="min-w-0 space-y-2">
          {/* 1. Mission */}
          <SopSection id="mission" icon={Target} kicker="Tổng quan" title="Vai trò & màn hình chính">
            <p>
              SR là người <strong>tìm và tuyển nhà cung cấp Việt Nam</strong> (gọi tắt trong tài liệu
              là NCC), thẩm định năng lực thực tế, làm dày hồ sơ đến mức hệ thống AI đủ căn cứ ghép
              họ với buyer nước ngoài, rồi chốt điều khoản thương mại ban đầu. SR là đầu vào của
              toàn bộ sàn: NCC càng nhiều, hồ sơ càng thật và dày, việc ghép cặp càng chính xác.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border bg-card p-4">
                <div className="mb-2 flex items-center gap-2 font-semibold">
                  <Boxes className="h-4 w-4 text-amber-600" /> Mở mỗi ngày
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><Screen>Nhu cầu &amp; Nguồn cung</Screen> — buyer đang cần hàng gì, ngành nào đang thiếu NCC</li>
                  <li><Screen>Hồ sơ chờ duyệt</Screen> — các phiếu NCC tự đăng ký cần thẩm định</li>
                  <li><Screen>Khách hàng</Screen> — toàn bộ NCC trong hệ thống (SR thấy tất cả để tránh tuyển trùng)</li>
                </ul>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="mb-2 flex items-center gap-2 font-semibold">
                  <ClipboardList className="h-4 w-4 text-amber-600" /> Làm theo từng NCC
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><Screen>Hợp đồng &amp; Đốc thu</Screen> — đề xuất phí dịch vụ và theo dõi thu tiền NCC do mình tuyển</li>
                  <li><Screen>Buyer</Screen> — xem nhu cầu buyer để định hướng tìm nguồn (thông tin liên hệ bị ẩn)</li>
                  <li>Trang chi tiết NCC: 3 thẻ <strong>Sản phẩm</strong>, <strong>Tuân thủ</strong>, <strong>Hồ sơ công khai</strong></li>
                </ul>
              </div>
            </div>
            <Callout kind="info" title="Bốn vai trò trong sàn giao dịch">
              <strong>LR</strong> tìm buyer nước ngoài → <strong>AI</strong> ghép buyer với NCC →{" "}
              <strong>SR (bạn)</strong> tuyển và làm dày hồ sơ NCC → <strong>AE</strong> nối buyer
              với NCC và chạy thương vụ. SR và LR là hai đầu đối xứng: một đầu lo cầu, một đầu lo
              cung.
            </Callout>
            <Callout kind="warning" title="Những gì SR KHÔNG nhìn thấy (theo phân quyền)">
              Không có bảng thương vụ của AE, không có hàng đợi xử lý của AE, không thấy số điện
              thoại/email/người liên hệ của buyer (chỉ xem được nhu cầu và ngành hàng), không vào
              được màn Tài chính, SLA, Phân tích và Nhật ký hoạt động. Mục KPI cá nhân hiện chưa mở
              cho SR — màn làm việc chính của bạn là <Screen>Nhu cầu &amp; Nguồn cung</Screen>.
            </Callout>
          </SopSection>

          {/* 2. Golden rules */}
          <SopSection id="golden-rules" icon={ShieldCheck} kicker="Bắt buộc nhớ" title="8 nguyên tắc vàng">
            <DoDont
              dos={[
                "Luôn bắt đầu từ màn Nhu cầu & Nguồn cung: ưu tiên tìm NCC cho ngành đang có buyer hỏi hàng thật mà hệ thống chưa phục vụ được.",
                "Trước khi tạo NCC mới, tìm kỹ trong mục Khách hàng để tránh tuyển trùng một doanh nghiệp.",
                "Đánh giá năng lực nhà máy bằng chứng thật: ảnh/video nhà máy, chứng chỉ còn hạn, thông tin thực địa sau gọi điện hoặc gặp trực tiếp.",
                "Làm đủ 3 lớp hồ sơ trước khi báo NCC sẵn sàng: đánh giá năng lực (điểm A/B), danh mục sản phẩm có giá & chứng chỉ, hồ sơ công khai đã xuất bản.",
                "Chia sẻ hồ sơ với buyer chỉ qua link chia sẻ do hệ thống tạo, có thời hạn — không gửi file gốc qua kênh riêng.",
                "Đề xuất hợp đồng dựa trên biểu phí đã thống nhất nội bộ; mỗi NCC chỉ một bản đề xuất đang chờ duyệt.",
                "Theo dõi chứng chỉ sắp hết hạn và nhắc NCC gia hạn sớm, đặc biệt khi họ đang có thương vụ chạy.",
                "Ghi chú đầy đủ thông tin đánh giá (ưu/nhược điểm, người liên hệ, cam kết) để AE và quản lý sử dụng được ngay.",
              ]}
              donts={[
                "Tạo hồ sơ NCC bằng thông tin bịa đặt hoặc chỉ từ một website không kiểm chứng — điểm nhà máy phải phản ánh năng lực thật.",
                "Tải lên hoặc gửi cho buyer chứng từ còn thông tin nhạy cảm chưa che: tên pháp lý không cần thiết, số đăng ký FDA, địa chỉ nhà máy tùy trường hợp — kiểm tra hướng dẫn ở mục S6.",
                "Tự ý gán NCC cho AE: việc gán người phụ trách do quản lý thực hiện (tối đa 7 NCC/AE); SR chỉ đề xuất.",
                "Tự duyệt hay kích hoạt hợp đồng, tự phát hành hóa đơn, tự xác nhận đã thu tiền — đó là việc của bộ phận Tài chính.",
                "Sửa điểm đánh giá nhà máy để nâng hạng sau khi đã lưu mà không có bằng chứng bổ sung — mỗi lần sửa đều được ghi nhận.",
                "Sử dụng thông tin buyer hiển thị trên hệ thống để liên hệ ngoài quy trình hoặc tiết lộ cho NCC khi chưa được phép.",
                "Để phiếu đăng ký của NCC quá hạn 14 ngày chưa duyệt/từ chối — link sẽ tự hết hạn và NCC phải điền lại từ đầu.",
                "Xóa NCC: chỉ cấp quản lý cao nhất mới xóa được; NCC sai/nhập trùng thì báo quản lý xử lý.",
              ]}
            />
          </SopSection>

          {/* 3. Big picture */}
          <SopSection id="big-picture" icon={Route} kicker="Sơ đồ" title="Toàn cảnh hành trình một nhà cung cấp">
            <p>Một NCC đi qua <strong>hai chặng</strong>: tuyển &amp; định danh (do SR sở hữu), rồi vận hành thương vụ (do AE sở hữu). Bàn giao xong, SR vẫn chịu trách nhiệm làm mới hồ sơ và đốc thu.</p>

            <SubHeading>Chặng A — Tuyển &amp; định danh (SR làm chủ)</SubHeading>
            <Flow>
              <FlowNode tone="amber" title="Đọc nhu cầu" sub="Ngành nào đang thiếu nguồn" badge="S1" icon={Boxes} />
              <FlowNode tone="amber" title="Tìm &amp; tiếp cận NCC" sub="Ngoài thị trường" badge="S2" icon={Search} />
              <FlowNode tone="blue" title="NCC vào hệ thống" sub="Link khảo sát hoặc thêm trực tiếp" icon={UserPlus} />
              <FlowNode tone="indigo" title="Duyệt hồ sơ" sub="Tạo tài khoản NCC" badge="S3" icon={FileCheck2} />
              <FlowNode tone="violet" title="Đánh giá nhà máy" sub="Điểm A/B/C/D" badge="S4" icon={Factory} />
              <FlowNode tone="teal" title="Sản phẩm · Chứng từ · Hồ sơ" sub="Đủ 3 lớp mới được ghép" badge="S5–S7" icon={Package} />
              <FlowNode tone="emerald" title="Đề xuất hợp đồng" sub="Bản nháp chờ Tài chính" badge="S8" icon={Receipt} />
            </Flow>

            <SubHeading>Chặng B — Vận hành (AE làm chủ, SR hỗ trợ hậu cần)</SubHeading>
            <Flow>
              <FlowNode tone="slate" title="Quản lý gán NCC cho AE" sub="Tối đa 7 NCC/AE" />
              <FlowNode tone="violet" title="AI ghép &amp; giới thiệu" sub="Hồ sơ của bạn được buyer xem" />
              <FlowNode tone="amber" title="Vào thương vụ" sub="AE điều phối" />
              <FlowNode tone="rose" title="SR hỗ trợ chứng từ" sub="Gia hạn, bổ sung khi cần" />
              <FlowNode tone="teal" title="SR đốc thu phí" sub="Theo dõi hóa đơn NCC mình tuyển" />
            </Flow>

            <SubHeading>Ai làm gì — sơ đồ làn việc</SubHeading>
            <Swimlane
              lanes={[
                {
                  actor: "SR (bạn)",
                  tone: "amber",
                  icon: Search,
                  steps: [
                    { title: "Đọc nhu cầu thị trường" },
                    { title: "Tìm &amp; mời NCC" },
                    { title: "Duyệt, đánh giá, làm hồ sơ" },
                    { title: "Đề xuất hợp đồng" },
                    { title: "Gia hạn chứng từ, đốc thu" },
                  ],
                },
                {
                  actor: "Nhà cung cấp",
                  tone: "indigo",
                  icon: Building2,
                  steps: [
                    { title: "Điền phiếu khảo sát 4 bước" },
                    { title: "Nhận thư mời, đăng nhập" },
                    { title: "Tự thêm sản phẩm" },
                    { title: "Cung cấp chứng từ" },
                    { title: "Ký hợp đồng, thanh toán" },
                  ],
                },
                {
                  actor: "Hệ thống AI",
                  tone: "slate",
                  icon: Bot,
                  steps: [
                    { title: "Chấm điểm nhà máy A–D" },
                    { title: "Đưa NCC vào nguồn ghép" },
                    { title: "Chấm &amp; xếp NCC cho buyer" },
                    { title: "Chụp hồ sơ khi giới thiệu" },
                    { title: "Nhắc chứng chỉ sắp hết hạn" },
                  ],
                },
                {
                  actor: "AE & Tài chính",
                  tone: "teal",
                  icon: Handshake,
                  steps: [
                    { title: "Quản lý gán NCC cho AE" },
                    { title: "AE giới thiệu &amp; chạy thương vụ" },
                    { title: "Tài chính duyệt hợp đồng" },
                    { title: "Phát hành &amp; thu hóa đơn" },
                  ],
                },
              ]}
            />
            <Callout kind="tip" title="Cách đọc tài liệu">
              Mỗi bước S1–S9 gồm: điều kiện vào, các thao tác bấm, việc hệ thống tự làm, và kết quả
              sau khi hoàn thành. Tên màn hình hiển thị trong ô{" "}
              <Screen>như thế này</Screen>, nút bấm hiển thị dạng <Ui>nút như thế này</Ui>.
            </Callout>
          </SopSection>

          {/* Phase 0 */}
          <SopSection id="phase0" icon={Coffee} kicker="S0 · Chuẩn bị" title="Chuẩn bị đầu ngày (5 phút)">
            <StepList>
              <Step n={1} title="Mở màn Nhu cầu & Nguồn cung">
                Đọc 4 thẻ tổng quan: số buyer đã nghiên cứu, số yêu cầu mua đang hoạt động, số NCC
                trong hệ thống, và số ngành đang cần tìm NCC gấp. Đây là danh sách việc ưu tiên của
                bạn.
              </Step>
              <Step n={2} title="Mở mục Hồ sơ chờ duyệt">
                Xem có phiếu nào mới hoặc sắp chạm mốc 14 ngày không — duyệt hoặc từ chối trong ngày,
                đừng để doanh nghiệp chờ lâu.
              </Step>
              <Step n={3} title="Đọc chuông thông báo">
                Tập trung các tin: chứng chỉ sắp hết hạn của NCC bạn tuyển, phản hồi về hợp đồng từ
                bộ phận Tài chính, và NCC vừa được buyer bấm quan tâm trên danh sách giới thiệu.
              </Step>
              <Step n={4} title="Lên danh sách NCC cần gọi/nhắc hôm nay">
                Chia 3 nhóm: cần bổ sung chứng từ/sản phẩm, cần gia hạn chứng chỉ, và cần đốc thanh
                toán phí.
              </Step>
            </StepList>
          </SopSection>

          {/* Phase 1 */}
          <SopSection id="phase1" icon={Boxes} kicker="S1 · Định hướng" title="Đọc nhu cầu thị trường">
            <p>
              Màn <Screen>Nhu cầu &amp; Nguồn cung</Screen> đối chiếu nhu cầu buyer (do LR nhập về)
              với nguồn cung hiện có. Mục <strong>“Buyer đang cần gì”</strong> là hàng đợi tìm nguồn
              sống của bạn.
            </p>
            <StepList>
              <Step n={1} title="Đọc các nhu cầu ưu tiên">
                Các dòng có yêu cầu mua cụ thể (sản phẩm, số lượng, giá mục tiêu, thị trường) là
                việc nóng. Dòng “ngành cần tìm supplier gấp” cho biết ngành nào có cầu nhưng chưa có
                NCC đủ điểm.
              </Step>
              <Step n={2} title="Xem chi tiết nhu cầu trong màn Buyer">
                Bạn xem được sản phẩm chính, mã HS, ngành, quốc gia và mô tả nhu cầu.{" "}
                <strong>Thông tin nhận diện (email, số điện thoại, người liên hệ) bị ẩn</strong> —
                đây là chủ ý phân quyền, không phải lỗi hiển thị.
              </Step>
              <Step n={3} title="Đối chiếu nguồn cung sẵn có">
                Trước khi tìm mới, lọc mục Khách hàng theo ngành để xem NCC hiện tại đã đủ chưa. Nếu
                đã có NCC phù hợp nhưng hồ sơ mỏng, việc nhanh nhất là <strong>làm dày hồ sơ NCC có
                sẵn</strong> chứ không tuyển thêm.
              </Step>
            </StepList>
            <Callout kind="tip" title="Quy tắc ưu tiên">
              Nhu cầu đang hoạt động &amp; ngành thiếu nguồn → làm dày hồ sơ NCC sẵn có → tìm NCC mới
              cho ngành trống. Hồ sơ dày và đúng còn quan trọng hơn số lượng NCC.
            </Callout>
          </SopSection>

          {/* Phase 2 */}
          <SopSection id="phase2" icon={Search} kicker="S2 · Tuyển NCC" title="Tìm và đưa nhà cung cấp vào hệ thống">
            <p>Sau khi tiếp cận và doanh nghiệp đồng ý tham gia, có <strong>2 cách</strong> đưa họ vào hệ thống:</p>
            <Decision
              question="Doanh nghiệp tự điền hồ sơ hay bạn nhập thay?"
              yes={
                <Flow>
                  <FlowNode tone="blue" title="Tạo link khảo sát" sub="Doanh nghiệp tự điền 4 bước, HSD 14 ngày" icon={Link2} />
                </Flow>
              }
              no={
                <Flow>
                  <FlowNode tone="indigo" title="Thêm supplier trực tiếp" sub="Bạn điền và tạo tài khoản ngay" icon={UserPlus} />
                </Flow>
              }
            />
            <SubHeading>Cách 1 — Gửi link khảo sát (khuyến nghị cho NCC mới)</SubHeading>
            <StepList>
              <Step n={1} title="Bấm “Tạo link khảo sát” tại mục Khách hàng">
                Hệ thống tạo một đường link công khai không cần đăng nhập, gắn tên bạn là người phụ
                trách. Link có hạn <strong>14 ngày</strong>; doanh nghiệp chưa điền kịp thì tạo link
                mới.
              </Step>
              <Step n={2} title="Hướng dẫn doanh nghiệp điền đủ 4 bước">
                Phiếu gồm: <Pill tone="blue">Liên hệ &amp; đăng ký</Pill>{" "}
                <Pill tone="blue">Giới thiệu doanh nghiệp</Pill>{" "}
                <Pill tone="violet">Năng lực &amp; chứng nhận</Pill>{" "}
                <Pill tone="amber">Đánh giá năng lực nhà máy</Pill>. Nhắc họ tải kèm ảnh nhà máy và
                chứng chỉ thật — hồ sơ gửi lên sẽ vào mục <Screen>Hồ sơ chờ duyệt</Screen> của bạn.
              </Step>
            </StepList>
            <SubHeading>Cách 2 — Thêm supplier trực tiếp (khi bạn đã có đủ thông tin)</SubHeading>
            <StepList>
              <Step n={1} title="Bấm “Thêm supplier” trên màn Nhu cầu & Nguồn cung hoặc mục Khách hàng">
                Điền email, người liên hệ, tên doanh nghiệp, ngành (ngành đầu tiên là ngành chính),
                quốc gia, số điện thoại và thông tin FDA nếu có.
              </Step>
              <Step n={2} title="Hệ thống tạo tài khoản và gửi thư mời">
                Email mời kèm liên kết đăng nhập được gửi tự động cho doanh nghiệp; tài khoản được
                ghi nhận <strong>do bạn tuyển</strong> — dấu vết này quyết định phạm vi hợp đồng bạn
                được đề xuất sau này. Ngay sau khi tạo, NCC đã vào nguồn để AI ghép, nên chỉ tạo khi
                hồ sơ đủ tối thiểu.
              </Step>
            </StepList>
            <Callout kind="danger" title="Trước khi tạo: kiểm tra trùng">
              Tìm theo tên công ty, mã số thuế và email trong mục Khách hàng. Hai hồ sơ trùng khiến
              lực lượng ghép bị chia đôi và buyer thấy cùng một nhà máy hai lần. Nếu phát hiện hồ sơ
              trùng đã lỡ tạo, báo quản lý — SR không tự xóa được.
            </Callout>
          </SopSection>

          {/* Phase 3 */}
          <SopSection id="phase3" icon={FileCheck2} kicker="S3 · Duyệt phiếu" title="Duyệt hồ sơ đăng ký">
            <p>Tại màn <Screen>Hồ sơ chờ duyệt</Screen>, mở từng phiếu và đối chiếu thông tin trước khi quyết định.</p>
            <StepList>
              <Step n={1} title="Thẩm định nhanh">
                Đối chiếu tên doanh nghiệp với cổng thông tin đăng ký kinh doanh, kiểm tra email/SĐT
                hợp lệ, ngành hàng có khớp nhu cầu thị trường không, chứng chỉ tải lên có rõ ràng và
                còn hạn không. Sửa bổ sung trực tiếp các trường còn thiếu ngay trên phiếu.
              </Step>
              <Step n={2} title="Bấm “Duyệt” nếu đạt">
                Hệ thống đồng loạt: tạo tài khoản NCC và gửi thư mời đăng nhập; chép phần đánh giá
                năng lực nhà máy sang hồ sơ chính; tạo trang hồ sơ công khai ở trạng thái chưa xuất
                bản; ghi nhận bạn là người tuyển; và đưa NCC vào nguồn ghép của AI.
              </Step>
              <Step n={3} title="Bấm “Từ chối” nếu không đạt, kèm lý do">
                Dùng khi sai ngành, thông tin giả/không liên hệ được, hoặc doanh nghiệp không phù
                hợp tiêu chí sàn. Lý do được lưu lại để tránh rà lại doanh nghiệp này sau này.
              </Step>
            </StepList>
            <Callout kind="warning" title="Mỗi phiếu chỉ duyệt một lần">
              Phiếu đã duyệt hoặc từ chối không thao tác lại được; người SR khác cũng không thể duyệt
              chồng. Phiếu để quá 14 ngày tự hết hạn — doanh nghiệp muốn tham gia lại thì gửi link
              khảo sát mới.
            </Callout>
          </SopSection>

          {/* Phase 4 */}
          <SopSection id="phase4" icon={Factory} kicker="S4 · Thẩm định" title="Đánh giá năng lực nhà máy">
            <p>
              Mở thẻ <strong>đánh giá năng lực nhà máy</strong> trong trang chi tiết NCC. Đây là biểu
              mẫu ~15 nhóm mục: hệ thống quản lý chất lượng &amp; ATTP, năng lực OEM/ODM &amp; quy mô,
              kinh nghiệm xuất khẩu và thị trường, truy xuất nguồn gốc, tình trạng FDA, nhân sự
              phục vụ buyer (phòng XK, nhân sự tiếng Anh, người quyết định giá), khả năng tiếp đoàn đánh giá thực địa, Incoterms/chính sách thanh toán/OEM-ODM, và cam kết triển khai dự án.
            </p>
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                { g: "A", label: "Xuất sắc — sẵn sàng ký", tone: "emerald", min: "≥ 80" },
                { g: "B", label: "Tốt — cần bổ sung ít", tone: "blue", min: "60–79" },
                { g: "C", label: "Trung bình — cần hỗ trợ", tone: "amber", min: "40–59" },
                { g: "D", label: "Yếu — chưa sẵn sàng", tone: "rose", min: "< 40" },
              ].map((x) => (
                <div key={x.g} className={`rounded-xl border p-4 text-center bg-card`}>
                  <div className="text-3xl font-bold">
                    <Pill tone={x.tone as keyof typeof TONE}>{x.g} · {x.min}</Pill>
                  </div>
                  <div className="mt-2 text-xs leading-5 text-muted-foreground">{x.label}</div>
                </div>
              ))}
            </div>
            <StepList>
              <Step n={1} title="Điền theo bằng chứng, không phỏng đoán">
                Mỗi lựa chọn nên dựa trên tài liệu/thông tin xác nhận được; phần tính điểm tự động
                cộng điểm và phân hạng A/B/C/D, kèm điểm chi tiết theo từng nhóm.
              </Step>
              <Step n={2} title="Lưu và xem lại hạng">
                Hạng và điểm tổng /100 hiển thị ngay đầu trang. NCC hạng C/D vẫn ở trong hệ thống
                nhưng khó được AI xếp lên đầu danh sách giới thiệu — hãy lên kế hoạch hỗ trợ họ bổ
                sung rồi đánh giá lại.
              </Step>
              <Step n={3} title="Khi có thông tin mới, cập nhật và lưu lại">
                Đánh giá là bản ghi duy nhất theo từng NCC (không tạo trùng); mỗi lần cập nhật ghi
                nhận thời gian và người sửa.
              </Step>
            </StepList>
            <Callout kind="tip" title="Mẹo chấm điểm thực tế">
              Ưu tiên xác minh 3 thứ quyết định khả năng giao hàng thật: chứng nhận hợp lệ còn hạn,
              kinh nghiệm xuất khẩu sang đúng thị trường buyer, và nhân sự nói được tiếng Anh. Thiếu
              cả ba thường rơi về hạng C/D dù quy mô nhà xưởng lớn.
            </Callout>
          </SopSection>

          {/* Phase 5 */}
          <SopSection id="phase5" icon={Package} kicker="S5 · Sản phẩm" title="Xây dựng danh mục sản phẩm">
            <p>
              Sản phẩm là dữ liệu AI dùng nhiều nhất để ghép với nhu cầu buyer. Mở thẻ{" "}
              <strong>Sản phẩm</strong> trong trang chi tiết NCC và thêm từng mặt hàng chủ lực{" "}
              (NCC cũng có thể tự thêm sau khi đăng nhập — bạn rà soát và chuẩn hóa).
            </p>
            <div className="rounded-xl border bg-card p-4">
              <div className="mb-2 font-semibold">Mỗi sản phẩm cần điền</div>
              <div className="grid gap-2 sm:grid-cols-2 text-sm text-muted-foreground">
                {[
                  "Tên sản phẩm",
                  "Danh mục (phân cấp ngành hàng)",
                  "Mã HS",
                  "Sản lượng/tháng",
                  "Đơn hàng tối thiểu (MOQ)",
                  "Khoảng giá",
                  "Đơn vị tính & cách đóng gói",
                  "Xuất xứ / ghi chú chất lượng",
                ].map((x) => (
                  <div key={x} className="flex items-start gap-2">
                    <Package className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" /> {x}
                  </div>
                ))}
              </div>
            </div>
            <StepList>
              <Step n={1} title="Chỉ nhập sản phẩm NCC giao được thật">
                Danh sách ảo làm hỏng chất lượng ghép cặp và uy tín khi buyer bấm quan tâm mà NCC
                không đáp ứng được.
              </Step>
              <Step n={2} title="Chuẩn hóa tên & mã HS theo danh mục hệ thống">
                Để các sản phẩm tương tự giữa các NCC được so sánh đúng. Giá điền theo khoảng thực
                tế, cập nhật khi giá nguyên liệu biến động lớn.
              </Step>
              <Step n={3} title="Kèm ảnh sản phẩm/nhà máy đúng quy định">
                Có thể dán link ảnh công khai hoặc tải file; nếu ô đã có sẵn ảnh/link thì ô tải file
                tự ẩn để tránh đăng nhầm.
              </Step>
            </StepList>
          </SopSection>

          {/* Phase 6 */}
          <SopSection id="phase6" icon={Paperclip} kicker="S6 · Tuân thủ" title="Chứng từ và link chia sẻ với buyer">
            <p>
              Mở thẻ <strong>Tuân thủ</strong> trong trang chi tiết NCC để tải 6 loại hồ sơ được phép
              chia sẻ:
            </p>
            <div className="flex flex-wrap gap-2">
              <Pill tone="blue">Chứng nhận FDA</Pill>
              <Pill tone="blue">Giấy chứng nhận phân tích (COA)</Pill>
              <Pill tone="teal">Bảng giá sàn</Pill>
              <Pill tone="violet">Video nhà máy</Pill>
              <Pill tone="violet">Hình ảnh nhà máy</Pill>
              <Pill tone="slate">Tài liệu khác</Pill>
            </div>
            <StepList>
              <Step n={1} title="Tải lên đúng định dạng, đúng nơi">
                File PDF/ảnh cho chứng từ; video nhà máy tối đa 100MB (tải thẳng theo trình duyệt,
                không qua server). Chứng từ pháp lý chỉ nhận <strong>file tải lên</strong>, không
                dán link ngoài.
              </Step>
              <Step n={2} title="Che thông tin nhạy cảm trước khi tải bản gửi buyer">
                Với hồ sơ định chia sẻ, rà soát và che các trường không bắt buộc lộ (số đăng ký nội
                bộ, địa chỉ chi tiết nhà máy nếu NCC yêu cầu). Bản đầy đủ phục vụ thẩm định nội bộ
                và thương vụ chính thức được quản lý riêng.
              </Step>
              <Step n={3} title="Tạo link chia sẻ có thời hạn khi AE/buyer cần">
                Chọn một hồ sơ hoặc gom nhiều hồ sơ thành một link gói; link mặc định hiệu lực{" "}
                <strong>30 ngày</strong>, có thể gửi kèm email cho buyer ngay trong hệ thống và{" "}
                <strong>thu hồi</strong> bất cứ lúc nào. Chỉ 6 loại hồ sơ trên mới được tạo link.
              </Step>
            </StepList>
            <DoDont
              dos={[
                "Đặt tiêu đề hồ sơ rõ ràng theo loại + tháng/năm để AE chọn nhanh.",
                "Khi NCC được cấp chứng chỉ mới, thay bản cũ và cập nhật ngày hết hạn.",
                "Thu hồi link khi đối phương không còn nhu cầu hoặc link đã hết mục đích.",
              ]}
              donts={[
                "Gửi hồ sơ đính kèm qua email/Zalo cá nhân — không kiểm soát được hết hạn và lộ lọt.",
                "Gom hồ sơ của hai doanh nghiệp khác nhau vào cùng một link (hệ thống sẽ chặn).",
                "Tạo link cho loại tài liệu ngoài danh sách cho phép.",
              ]}
            />
          </SopSection>

          {/* Phase 7 */}
          <SopSection id="phase7" icon={Globe} kicker="S7 · Hồ sơ công khai" title="Xuất bản trang hồ sơ giới thiệu">
            <p>
              Thẻ <strong>Hồ sơ công khai</strong> là bộ mặt của NCC trên sàn: câu chuyện doanh
              nghiệp, năng lực sản xuất, MOQ, thời gian giao hàng, thị trường đã xuất, điểm bán hàng nổi bật và các <strong>chứng chỉ nổi bật</strong> được chọn từ kho chứng từ. Khi AI dựng
              danh sách giới thiệu cho buyer, hệ thống chụp lại đúng hồ sơ này tại thời điểm gửi.
            </p>
            <StepList>
              <Step n={1} title="Hoàn thiện nội dung và đính kèm chứng chỉ nổi bật">
                Chọn 2–4 chứng chỉ mạnh nhất (FDA, COA, chứng nhận nhà máy) để hiển thị; viết phần
                giới thiệu ngắn gọn, có số liệu cụ thể (sản lượng, năm bắt đầu xuất khẩu, thị
                trường).
              </Step>
              <Step n={2} title="Kiểm tra trang xem trước rồi bấm “Xuất bản”">
                Sau khi xuất bản, hồ sơ hiển thị tại trang giới thiệu công khai của NCC và được đưa
                vào nguồn để AI chọn. Chưa sẵn sàng thì giữ trạng thái chưa xuất bản — buyer sẽ
                không thấy.
              </Step>
              <Step n={3} title="Cập nhật khi có thay đổi lớn">
                NCC nâng công suất, đổi chứng chỉ, mở thêm thị trường: cập nhật ngay. Các danh sách
                đã gửi buyer vẫn giữ nguyên bản chụp cũ, không bị thay đổi ngược.
              </Step>
            </StepList>
            <Callout kind="warning" title="Ba lớp hồ sơ phải đồng bộ">
              Đánh giá nhà máy, danh mục sản phẩm và hồ sơ công khai nên nhất quán với nhau. Một hồ
              sơ giới thiệu viết năng lực 5 container/tháng nhưng sản phẩm khai sản lượng 200
              container là dấu hiệu làm AE và buyer mất niềm tin ngay.
            </Callout>
          </SopSection>

          {/* Phase 8 */}
          <SopSection id="phase8" icon={Receipt} kicker="S8 · Thương mại" title="Đề xuất hợp đồng dịch vụ">
            <p>
              Khi NCC đã đủ hồ sơ và đồng ý tham gia sàn, SR thay mặt đội ngũ chốt khung phí với
              doanh nghiệp rồi gửi đề xuất cho bộ phận Tài chính tại màn{" "}
              <Screen>Hợp đồng &amp; Đốc thu</Screen> (nút <Ui>Đề xuất hợp đồng</Ui>):
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                ["Phí thiết lập", "Một lần khi khởi động, USD"],
                ["Phí giữ chỗ hằng tháng", "Retainer, ngày xuất hóa đơn cố định mỗi tháng (ngày 1–28)"],
                ["Phí thành công (%)", "% trên giá trị thương vụ thành công"],
                ["Tỷ lệ khấu trừ retainer", "Phần retainer được khấu trừ khi tính phí thành công (mặc định 50%)"],
                ["Thời hạn hợp đồng", "Ngày bắt đầu/kết thúc, tỷ giá quy đổi"],
                ["Ghi chú", "Điều khoản đặc biệt đã thống nhất với NCC"],
              ].map(([a, b]) => (
                <div key={a} className="flex items-start gap-2 rounded-lg border bg-card p-3 text-sm">
                  <Receipt className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <span><strong>{a}.</strong> <span className="text-muted-foreground">{b}</span></span>
                </div>
              ))}
            </div>
            <StepList>
              <Step n={1} title="Gửi đề xuất — hệ thống luôn để ở trạng thái nháp">
                SR <strong>không kích hoạt hợp đồng được</strong>: đề xuất của bạn là bản nháp để
                Tài chính duyệt. Hợp đồng được duyệt mới bắt đầu sinh hóa đơn phí giữ chỗ hằng tháng.
              </Step>
              <Step n={2} title="Mỗi NCC chỉ một bản nháp chờ duyệt">
                Cần sửa đề xuất khi nó còn ở dạng nháp? Liên hệ Tài chính hoàn lại rồi gửi bản mới;
                không tạo song song nhiều bản.
              </Step>
              <Step n={3} title="Chỉ đề xuất được cho NCC do chính bạn tuyển">
                Hệ thống đối chiếu thông tin người tuyển; NCC do SR khác hoặc do quản lý tạo thì
                chuyển cho người phụ trách tương ứng.
              </Step>
            </StepList>
            <Callout kind="danger" title="Ranh giới với Tài chính">
              SR không duyệt/kích hoạt hợp đồng, không phát hành hay hủy hóa đơn, không ghi nhận đã
              thu tiền. Mọi thay đổi tỷ giá/điều khoản sau kích hoạt đều do Tài chính xử lý.
            </Callout>
          </SopSection>

          {/* Phase 9 */}
          <SopSection id="phase9" icon={BellRing} kicker="S9 · Duy trì" title="Đốc thu và gia hạn chứng từ">
            <SubHeading>Đốc thu</SubHeading>
            <p>
              Màn <Screen>Hợp đồng &amp; Đốc thu</Screen> cho bạn thấy trạng thái từng NCC do mình
              tuyển: chưa có hợp đồng / đang chờ duyệt / đang hiệu lực, số tiền đã thanh toán và số
              đang treo (đã xuất hóa đơn, quá hạn hoặc trả một phần). Bạn là người nhắc nhở doanh
              nghiệp; việc xuất hóa đơn và xác nhận thu tiền thuộc về Tài chính.
            </p>
            <StepList>
              <Step n={1} title="Mỗi tuần lọc các NCC đang có tiền treo">
                Nhắc nhẹ qua điện thoại/email theo lịch thống nhất; không hứa hẹn chiết khấu hay
                điều chỉnh phí trái thẩm quyền.
              </Step>
              <Step n={2} title="Phản hồi vướng mắc về Tài chính">
                NCC khiếu nại hóa đơn hoặc cần gia hạn thanh toán: chuyển thông tin đầy đủ cho Tài
                chính, không tự xác nhận ngoại lệ.
              </Step>
            </StepList>
            <SubHeading>Gia hạn chứng từ</SubHeading>
            <p>
              Hệ thống tự quét mỗi ngày và gửi nhắc: chứng chỉ FDA trước hạn <strong>90
              ngày</strong>; các chứng chỉ khác trước <strong>30 ngày</strong> (khẩn cấp ở{" "}
              <strong>7 ngày</strong>) và sau khi đã hết hạn. NCC nhận thư nhắc, bạn cũng thấy tín
              hiệu nội bộ — chủ động liên hệ ngay khi NCC đang có thương vụ dở.
            </p>
          </SopSection>

          {/* Handoff */}
          <SopSection id="handoff" icon={Handshake} kicker="Phối hợp" title="Bàn giao cho AE và phối hợp nội bộ">
            <p>
              SR <strong>không tự gán NCC cho AE</strong> — hệ thống chặn thao tác này ở vai trò
              của bạn. Khi NCC đã đủ hồ sơ, đề xuất quản lý gán AE phụ trách (mỗi AE phụ trách tối
              đa 7 NCC) qua kênh nội bộ hoặc phần ghi chú khi duyệt hồ sơ.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-2 font-semibold">
                  <Send className="h-4 w-4 text-amber-600" /> SR bàn giao gì
                </div>
                <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                  <li>• NCC đạt hạng A/B, hồ sơ công khai đã xuất bản</li>
                  <li>• Danh mục sản phẩm có giá, MOQ, mã HS</li>
                  <li>• Chứng chỉ còn hạn + link chia sẻ sẵn sàng</li>
                  <li>• Ghi chú người quyết định giá, năng lực đặc biệt, điểm yếu cần lưu ý</li>
                </ul>
              </div>
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-2 font-semibold">
                  <MessagesSquare className="h-4 w-4 text-teal-600" /> Khi thương vụ chạy
                </div>
                <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                  <li>• AE xin thêm hồ sơ/gia hạn chứng chỉ: phản hồi trong ngày</li>
                  <li>• Buyer muốn đánh giá thực địa nhà máy: phối hợp lịch với NCC</li>
                  <li>• NCC đổi giá/năng lực: cập nhật hồ sơ và báo AE</li>
                  <li>• NCC chậm phí: kết hợp Tài chính đốc thu</li>
                </ul>
              </div>
            </div>
          </SopSection>

          {/* Thresholds */}
          <SopSection id="thresholds" icon={Gauge} kicker="Tra cứu nhanh" title="Bảng mốc thời gian & giới hạn">
            <RuleTable
              rows={[
                { rule: "Thời hạn link khảo sát NCC tự điền", value: "14 ngày", note: "Quá hạn phiếu bị xóa khỏi danh sách chờ; tạo link mới cho doanh nghiệp." },
                { rule: "Số bước trong phiếu khảo sát", value: "4 bước", note: "Liên hệ · Giới thiệu DN · Năng lực & chứng nhận · Đánh giá nhà máy." },
                { rule: "Ngưỡng xếp hạng nhà máy", value: "A ≥80 · B 60–79 · C 40–59 · D <40", note: "Tính trên thang điểm 100 theo biểu mẫu ~15 nhóm mục." },
                { rule: "Dung lượng tối đa video nhà máy", value: "100 MB", note: "Tải thẳng từ trình duyệt lên kho file." },
                { rule: "Loại hồ sơ được tạo link chia sẻ", value: "6 loại", note: "FDA, COA, Bảng giá sàn, Video nhà máy, Hình ảnh nhà máy, Tài liệu khác." },
                { rule: "Thời hạn mặc định của link chia sẻ", value: "30 ngày", note: "Tùy chỉnh ngắn hơn khi tạo; luôn thu hồi được." },
                { rule: "Số NCC tối đa mỗi AE phụ trách", value: "7 NCC", note: "SR không tự gán; đề nghị quản lý khi đủ hồ sơ." },
                { rule: "Trạng thái hợp đồng SR tạo được", value: "Chỉ “Nháp”", note: "Tài chính duyệt mới chuyển sang hiệu lực và bắt đầu xuất hóa đơn." },
                { rule: "Số đề xuất hợp đồng đang chờ của mỗi NCC", value: "1 bản", note: "Gửi thêm sẽ bị từ chối cho đến khi bản cũ được xử lý." },
                { rule: "Ngày xuất hóa đơn cố định trong tháng", value: "Ngày 1–28", note: "Chọn khi đề xuất hợp đồng." },
                { rule: "Tỷ lệ khấu trừ phí giữ chỗ mặc định", value: "50%", note: "Khi tính phí thành công của thương vụ." },
                { rule: "Cảnh báo hạn chứng chỉ", value: "FDA 90 ngày · khác 30/7 ngày", note: "Nhắc cả NCC lẫn nội bộ; đã hết hạn vẫn nhắc cho đến khi gia hạn." },
              ]}
            />
          </SopSection>

          {/* Client visibility */}
          <SopSection id="client-visibility" icon={Eye} kicker="Hệ quả" title="Mỗi việc bạn làm, nhà cung cấp và buyer nhìn thấy gì">
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left">
                  <tr>
                    <th className="px-4 py-2.5">Việc bạn làm</th>
                    <th className="px-4 py-2.5">Ai nhìn thấy gì</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[
                    ["Tạo link khảo sát", "Doanh nghiệp nhận link từ bạn và tự điền; chưa có tài khoản trong hệ thống."],
                    ["Duyệt phiếu đăng ký", "Doanh nghiệp nhận thư mời đăng nhập; hồ sơ xuất hiện trong nguồn nội bộ."],
                    ["Thêm sản phẩm, cập nhật giá/MOQ", "Dữ liệu vào AI ghép ngay; AE thấy khi mở trang NCC; buyer chỉ thấy sau khi NCC lọt danh sách giới thiệu."],
                    ["Tải chứng từ", "Nội bộ và AE thấy; buyer chỉ thấy khi bạn tạo link chia sẻ hoặc gắn làm chứng chỉ nổi bật trên hồ sơ công khai."],
                    ["Xuất bản hồ sơ công khai", "Hiển thị công khai và được AI chụp lại khi gửi trong danh sách giới thiệu cho buyer."],
                    ["Đánh giá/chỉnh hạng nhà máy", "Chỉ nội bộ (SR/AE/quản lý) thấy điểm chi tiết; không công khai ra ngoài."],
                    ["Đề xuất hợp đồng", "Tài chính nhận bản nháp để duyệt; NCC chỉ nhận hợp đồng/hóa đơn chính thức sau khi kích hoạt."],
                    ["Gia hạn/cảnh báo chứng chỉ", "NCC nhận email nhắc tự động; bạn thấy tín hiệu để thúc đẩy."],
                  ].map((r, i) => (
                    <tr key={i} className={i % 2 ? "bg-muted/30" : "bg-card"}>
                      <td className="px-4 py-2.5">{r[0]}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r[1]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Callout kind="tip" title="Hồ sơ tốt tự bán hàng">
              Bản chụp hồ sơ khi gửi buyer là “ấn phẩm bán hàng” duy nhất trong giai đoạn giới thiệu:
              đủ ảnh nhà máy, chứng chỉ rõ ràng, sản phẩm có giá hợp lý giúp tỷ lệ buyer bấm quan
              tâm tăng lên rõ rệt — và đó cũng là kết quả ghi nhận cho SR.
            </Callout>
          </SopSection>

          {/* Checklist */}
          <SopSection id="checklist" icon={CalendarCheck} kicker="Thói quen" title="Checklist mỗi ngày & mỗi tuần">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border bg-card p-5">
                <div className="mb-3 font-semibold">Mỗi ngày làm việc</div>
                <ul className="space-y-2 text-sm">
                  {[
                    "Đọc màn Nhu cầu & Nguồn cung, ghi nhận ngành đang thiếu nguồn.",
                    "Duyệt hoặc từ chối mọi phiếu đăng ký mới (đừng để chạm 14 ngày).",
                    "Gọi/nhắc các NCC hẹn bổ sung hồ sơ, chứng từ.",
                    "Hoàn thiện tối thiểu một hồ sơ NCC đang dở (sản phẩm/chứng từ/hồ sơ công khai).",
                    "Xử lý các yêu cầu chứng từ gấp từ AE.",
                  ].map((x) => (
                    <Check key={x}>{x}</Check>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border bg-card p-5">
                <div className="mb-3 font-semibold">Mỗi thứ Hai</div>
                <ul className="space-y-2 text-sm">
                  {[
                    "Rà chứng chỉ FDA sắp hết hạn trong 90 ngày và các chứng chỉ trong 30 ngày.",
                    "Rà bảng Hợp đồng & Đốc thu: ai đang treo phí, đề xuất nào chưa được duyệt.",
                    "Đối chiếu nhu cầu buyer mới với nguồn cung, lên danh sách NCC cần tìm trong tuần.",
                    "Rà trùng lặp và chuẩn hóa sản phẩm của các NCC mới duyệt.",
                    "Đề nghị quản lý gán AE cho các NCC hạng A/B đã đủ hồ sơ.",
                  ].map((x) => (
                    <Check key={x}>{x}</Check>
                  ))}
                </ul>
              </div>
            </div>
          </SopSection>

          {/* Errors */}
          <SopSection id="errors" icon={CircleAlert} kicker="Bảng tra" title="Thông báo thường gặp & cách xử lý">
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left">
                  <tr>
                    <th className="px-4 py-2.5">Bạn thấy thông báo</th>
                    <th className="px-4 py-2.5">Vì sao</th>
                    <th className="px-4 py-2.5">Cách xử lý</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[
                    ["Không tìm thấy doanh nghiệp khi mở phiếu duyệt", "Link đã hết hạn 14 ngày hoặc phiếu đã được xử lý", "Tải lại danh sách; nếu doanh nghiệp vẫn muốn tham gia, gửi link khảo sát mới."],
                    ["Phiếu đã được duyệt/từ chối", "Mỗi phiếu chỉ xử lý một lần và đã có người bấm trước", "Xem lại doanh nghiệp trong mục Khách hàng; muốn bổ sung thì sửa trực tiếp trên hồ sơ NCC."],
                    ["Không tạo được link chia sẻ cho hồ sơ này", "Loại tài liệu không nằm trong 6 loại được phép chia sẻ", "Chỉ tạo link cho FDA, COA, Bảng giá sàn, Video/Hình ảnh nhà máy, Tài liệu khác."],
                    ["Không tạo được link gói nhiều hồ sơ", "Các hồ sơ được chọn thuộc hai doanh nghiệp khác nhau", "Chỉ gom hồ sơ của cùng một NCC trong một link."],
                    ["Video không tải lên được", "Vượt 100MB hoặc định dạng không hỗ trợ", "Nén/cắt ngắn video, kiểm tra lại đường truyền rồi tải lại."],
                    ["Không gửi được đề xuất hợp đồng", "Có thể đã có một bản nháp đang chờ duyệt cho NCC này", "Liên hệ Tài chính xử lý bản nháp cũ rồi mới gửi bản điều chỉnh."],
                    ["Bạn không có quyền đề xuất cho doanh nghiệp này", "NCC do SR khác tuyển (hệ thống ghi nhận người tuyển)", "Chuyển việc cho SR phụ trách hoặc đề nghị quản lý điều phối."],
                    ["Không gán được NCC cho nhân viên kinh doanh", "Vai trò SR không được phép đổi người phụ trách", "Gửi đề nghị kèm thông tin NCC cho quản lý; mỗi AE nhận tối đa 7 NCC."],
                    ["Đã đủ 7 NCC trên một AE khi đề nghị gán", "AE đó đạt giới hạn phụ trách", "Đề xuất gán AE khác hoặc chờ quản lý điều chỉnh."],
                    ["Bạn không có quyền xóa doanh nghiệp", "Chỉ cấp quản lý cao nhất mới xóa được NCC", "Gửi thông tin hồ sơ trùng/sai cho quản lý xử lý."],
                    ["Không thấy số điện thoại/email của buyer", "Đây là giới hạn quyền của SR (chỉ xem nhu cầu, ẩn thông tin nhận diện)", "Làm việc qua nhu cầu đã tổng hợp; cần thêm thông tin thì đề nghị qua AE/quản lý."],
                  ].map((r, i) => (
                    <tr key={i} className={i % 2 ? "bg-muted/30" : "bg-card"}>
                      <td className="px-4 py-2.5 align-top font-medium">{r[0]}</td>
                      <td className="px-4 py-2.5 align-top text-muted-foreground">{r[1]}</td>
                      <td className="px-4 py-2.5 align-top text-muted-foreground">{r[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Callout kind="info" title="Gặp tình huống không có trong bảng">
              Chụp màn hình thông báo kèm trang NCC/phiếu liên quan, gửi quản lý trực tiếp. Với các
              nút có ghi dữ liệu (duyệt phiếu, xuất bản, đề xuất hợp đồng), đừng bấm thử nhiều lần.
            </Callout>
          </SopSection>

          {/* Metrics */}
          <SopSection id="metrics" icon={TrendingUp} kicker="Đo lường" title="Theo dõi hiệu quả công việc">
            <p>
              Hiện SR chưa có trang KPI cá nhân riêng (mục KPI trên menu tự chuyển về màn Nhu cầu
              &amp; Nguồn cung). Hiệu quả công việc được nhìn qua các chỉ số sẵn có và phản hồi từ
              thương vụ:
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Số NCC mới tuyển & duyệt", "Đặc biệt NCC cho ngành đang thiếu nguồn (thẻ “ngành cần tìm gấp”)."],
                ["Tỷ lệ NCC hạng A/B", "Phản ánh chất lượng thẩm định; mục tiêu phần lớn NCC mới đạt B trở lên."],
                ["Độ dày hồ sơ", "% NCC đã xuất bản hồ sơ công khai, có ≥5 sản phẩm và đủ chứng chỉ còn hạn."],
                ["Tốc độ duyệt phiếu", "Thời gian từ khi NCC gửi tới khi duyệt — duyệt trong ngày là tốt nhất."],
                ["NCC được buyer quan tâm", "Số NCC do bạn tuyển được buyer bấm quan tâm trên danh sách giới thiệu."],
                ["Tình trạng thu phí", "Tỷ lệ NCC có hợp đồng hiệu lực và không treo hóa đơn quá hạn."],
              ].map(([a, b]) => (
                <div key={a} className="rounded-xl border bg-card p-4">
                  <div className="flex items-start gap-2 font-semibold">
                    <Award className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /> {a}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">{b}</div>
                </div>
              ))}
            </div>
            <Callout kind="tip" title="Lưu ý kiểm tra cuối mỗi hồ sơ">
              Đừng quên dấu kiểm tra cuối mỗi hồ sơ: <Lock className="inline h-3.5 w-3.5" /> thông tin
              nhận diện buyer bạn vô tình thấy không được tiết lộ cho NCC; thông tin nội bộ (điểm
              đánh giá, biểu phí) không hiển thị trên hồ sơ công khai.
            </Callout>
            <div className="mt-6 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              <BookOpen className="mr-1 inline h-4 w-4" />
              Tài liệu cho AE (vận hành thương vụ) đã hoàn tất; tài liệu LR (tìm &amp; làm giàu
              buyer) đang được biên soạn tại{" "}
              <Link href="/admin/knowledge" className="text-amber-600 underline">
                Trung tâm kiến thức
              </Link>
              .
            </div>
          </SopSection>
        </article>
      </div>
    </div>
  )
}

function Check({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-foreground/85">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
      <span>{children}</span>
    </li>
  )
}
