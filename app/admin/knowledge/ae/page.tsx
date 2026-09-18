import type { Metadata } from "next"
import Link from "next/link"
import {
  BookOpen,
  Target,
  ShieldCheck,
  Route,
  Coffee,
  Inbox,
  MailPlus,
  ClipboardList,
  Wand2,
  Send,
  Eye,
  GitMerge,
  Kanban,
  FileCheck2,
  Handshake,
  ArrowRightLeft,
  Undo2,
  Gauge,
  Bell,
  CalendarCheck,
  CircleAlert,
  BarChart3,
  Bot,
  Factory,
  UserCheck,
  TimerReset,
  Lock,
  ListChecks,
  MessagesSquare,
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

export const metadata: Metadata = { title: "Tài liệu vận hành AE — Vexim Bridge" }

export default function AESopPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      {/* Header */}
      <header className="mb-8 rounded-2xl border bg-gradient-to-br from-teal-500/10 via-transparent to-transparent p-7">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link href="/admin/knowledge" className="inline-flex items-center gap-1 hover:text-foreground">
            <BookOpen className="h-4 w-4" /> Trung tâm kiến thức
          </Link>
          <span>/</span>
          <Pill tone="teal">Account Executive (AE)</Pill>
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight lg:text-4xl">
          Tài liệu vận hành Bộ phận AE
        </h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          Tài liệu chuẩn cho nhân viên kinh doanh đối ngoại (Account Executive): toàn bộ vòng đời
          một buyer từ khi hệ thống đẩy vào hàng đợi, qua hỏi nhu cầu — giới thiệu nhà cung cấp —
          chốt supplier, đến khi thương vụ chạy trên bảng Pipeline và giao hàng. Đọc theo sơ đồ là
          hiểu ngay mỗi việc vào màn hình nào, bấm nút gì, hệ thống tự làm gì, và giới hạn nào không
          được vượt.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border bg-card px-3 py-1">Áp dụng: AE · admin · super_admin</span>
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
              { href: "#big-picture", label: "Toàn cảnh hành trình", icon: Route },
              { href: "#phase0", label: "Chuẩn bị đầu ngày", icon: Coffee },
              { href: "#phase1", label: "B1 — Nhận buyer từ hàng đợi", icon: Inbox },
              { href: "#phase2", label: "B2 — Hỏi nhu cầu buyer", icon: MailPlus },
              { href: "#phase3", label: "B3 — Ghi nhận nhu cầu", icon: ClipboardList },
              { href: "#phase4", label: "B4 — Dựng danh sách giới thiệu", icon: Wand2 },
              { href: "#phase5", label: "B5 — Gửi & theo dõi phản hồi", icon: Send },
              { href: "#phase6", label: "B6 — Chuyển thành cơ hội / Dừng", icon: GitMerge },
              { href: "#phase7", label: "B7 — Vận hành Pipeline", icon: Kanban },
              { href: "#phase8", label: "B8 — Chứng từ tuân thủ", icon: FileCheck2 },
              { href: "#phase9", label: "B9 — Chốt & sau chốt", icon: Handshake },
              { href: "#exceptions", label: "Chuyển / Trả buyer", icon: ArrowRightLeft },
              { href: "#thresholds", label: "Bảng mốc thời gian & giới hạn", icon: Gauge },
              { href: "#client-visibility", label: "Nhà cung cấp nhìn thấy gì", icon: Eye },
              { href: "#checklist", label: "Checklist ngày & tuần", icon: CalendarCheck },
              { href: "#errors", label: "Thông báo thường gặp", icon: CircleAlert },
              { href: "#kpi", label: "KPI của AE", icon: BarChart3 },
            ]}
          />
        </aside>

        <article className="min-w-0 space-y-2">
          {/* 1. Mission */}
          <SopSection id="mission" icon={Target} kicker="Tổng quan" title="Vai trò & màn hình chính">
            <p>
              AE là người <strong>sở hữu buyer</strong> sau khi hệ thống phân bổ: tiếp cận, khai
              thác nhu cầu, giới thiệu đúng nhà cung cấp Việt Nam, và đưa thương vụ chạy trên bảng
              Pipeline cho tới khi giao hàng. AE không tự tìm buyer (việc của LR), không tự tuyển nhà
              cung cấp mới (việc của SR), không nhìn thấy giá vốn và không tự nhận buyer cho mình.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border bg-card p-4">
                <div className="mb-2 flex items-center gap-2 font-semibold">
                  <Inbox className="h-4 w-4 text-teal-600" /> Mở mỗi ngày
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><Screen>Buyer của tôi</Screen> — hàng đợi buyer mới được đẩy tới &amp; các buyer bạn đang xử lý</li>
                  <li><Screen>Đang xử lý</Screen> — các hồ sơ buyer đang trong tay bạn</li>
                  <li><Screen>Pipeline</Screen> — bảng thương vụ sau khi buyer đã chọn nhà cung cấp</li>
                  <li><Screen>KPI của tôi</Screen> — tỷ lệ thắng, doanh thu, xếp hạng trong team</li>
                </ul>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="mb-2 flex items-center gap-2 font-semibold">
                  <MessagesSquare className="h-4 w-4 text-teal-600" /> Tra cứu khi cần
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><Screen>Buyer</Screen> — toàn bộ buyer và điểm ghép cặp của hệ thống</li>
                  <li><Screen>Khách hàng</Screen> — các nhà cung cấp bạn phụ trách (tối đa 7)</li>
                  <li><Screen>Nhu cầu &amp; Nguồn cung</Screen> — đối chiếu nhu cầu buyer với nguồn hàng</li>
                  <li><Screen>SLA</Screen> — chỉ số cam kết dịch vụ của riêng bạn</li>
                </ul>
              </div>
            </div>
            <Callout kind="info" title="Bốn vai trò trong sàn giao dịch">
              <strong>LR</strong> tìm buyer nước ngoài → <strong>hệ thống AI</strong> chấm điểm và đẩy
              buyer cho AE phù hợp → <strong>AE</strong> vừa nói chuyện với buyer vừa giới thiệu nhà
              cung cấp mà <strong>SR</strong> đã tuyển lên hệ thống. AE là mắt xích duy nhất nói
              chuyện với cả hai phía.
            </Callout>
          </SopSection>

          {/* 2. Golden rules */}
          <SopSection id="golden-rules" icon={ShieldCheck} kicker="Bắt buộc nhớ" title="8 nguyên tắc vàng">
            <DoDont
              dos={[
                <>Chỉ nhận buyer qua nút <Ui>Nhận buyer</Ui> trong hàng đợi; làm đúng thứ tự các bước — mỗi lần chuyển trạng thái, hệ thống đều ghi lại.</>,
                <>Mọi email gửi buyer đều dùng <strong>email công vụ cá nhân</strong> dạng tên@veximtrade.com — hệ thống tự cấp khi bạn gửi thư đầu tiên, không cần xin IT.</>,
                "Ghi đầy đủ 6 mục nhu cầu của buyer trước khi dựng danh sách giới thiệu — đây là căn cứ để hệ thống chấm nhà cung cấp phù hợp.",
                "Chỉ giới thiệu từ 1–3 nhà cung cấp qua đường link hệ thống tạo ra, để buyer tự bấm phản hồi trên link; nhờ đó hệ thống đếm được lượt xem và báo bạn ngay khi buyer quan tâm.",
                "Khi buyer xin mẫu / muốn họp / muốn bàn đơn: phản hồi nhanh và chủ động liên hệ nhà cung cấp — đây là các tín hiệu có thời hạn.",
                "Cập nhật “Bước tiếp theo” trên thẻ thương vụ mỗi khi có tiến triển; tạo “Việc cần nhà cung cấp làm” kèm hạn chốt mỗi khi cần phía cung phản hồi.",
                "Mọi ngoại lệ (chuyển buyer cho AE khác, trả buyer về hàng đợi chung) đều bắt buộc ghi lý do.",
              ]}
              donts={[
                "Tự nhận buyer cho mình hay nhận hộ đồng nghiệp — việc phân bổ do hệ thống và cấp quản lý quyết định.",
                <>Nói tên/thông tin buyer cho nhà cung cấp <strong>trước khi thương vụ đạt bước “Đã chốt giá”</strong> — đây là quy tắc ẩn danh bắt buộc.</>,
                "Gửi danh sách nhà cung cấp qua email/Zalo riêng bên ngoài link giới thiệu — sẽ mất bản lưu cố định và mất cảnh báo phản hồi.",
                "Hỏi hay sửa giá vốn: AE không có quyền này theo phân quyền; bạn chỉ thao tác giá bán và số lượng.",
                "Sửa điểm chấm của AI hay sửa danh sách giới thiệu đã gửi — muốn thay thì tạo một bản mới.",
                "Bỏ trống lý do khi dừng hồ sơ, chuyển hay trả buyer.",
                "Để một buyer nằm im quá 14 ngày không tiến triển — hệ thống sẽ đánh dấu tồn đọng và nhắc bạn cùng quản lý.",
              ]}
            />
          </SopSection>

          {/* 3. Big picture */}
          <SopSection id="big-picture" icon={Route} kicker="Sơ đồ" title="Toàn cảnh hành trình một buyer">
            <p>Một buyer đi qua <strong>hai chặng nối tiếp</strong>: chặng giới thiệu (buyer chưa biết danh tính nhà cung cấp) rồi mới đến chặng thương vụ trên Pipeline.</p>

            <SubHeading>Chặng A — Giới thiệu: từ hàng đợi tới khi buyer chọn nhà cung cấp</SubHeading>
            <Flow>
              <FlowNode tone="slate" title="Được đẩy vào hàng đợi" sub="HSD 7 ngày · điểm 6 tiêu chí" badge="B1" icon={Bot} />
              <FlowNode tone="blue" title="Nhận buyer" sub="Các AE khác hết lượt nhận" icon={UserCheck} />
              <FlowNode tone="blue" title="Gửi email hỏi nhu cầu" sub="AI soạn sẵn, AE gửi" badge="B2" icon={MailPlus} />
              <FlowNode tone="indigo" title="Ghi nhận nhu cầu" sub="6 mục thông tin" badge="B3" icon={ClipboardList} />
              <FlowNode tone="violet" title="Dựng danh sách giới thiệu" sub="1–3 nhà cung cấp" badge="B4" icon={Wand2} />
              <FlowNode tone="amber" title="Gửi link cho buyer" sub="Link riêng, HSD 30 ngày" badge="B5" icon={Send} />
              <FlowNode tone="amber" title="Buyer xem &amp; phản hồi" sub="Xin mẫu · muốn họp · bàn đơn" icon={Eye} />
              <FlowNode tone="teal" title="Chuyển thành cơ hội" sub="Xuất hiện ở cột “Yêu cầu mẫu”" badge="B6" icon={GitMerge} />
            </Flow>

            <SubHeading>Chặng B — Pipeline: thương vụ thương mại với từng nhà cung cấp</SubHeading>
            <Flow>
              <FlowNode tone="violet" title="Yêu cầu mẫu" />
              <FlowNode tone="purple" title="Đã gửi mẫu" />
              <FlowNode tone="orange" title="Đàm phán" />
              <FlowNode tone="sky" title="Đã chốt giá" sub="Từ đây nhà cung cấp mới thấy tên buyer" />
              <FlowNode tone="indigo" title="Đang sản xuất" />
              <FlowNode tone="teal" title="Đã giao hàng" />
              <FlowNode tone="emerald" title="Thành công" />
            </Flow>

            <SubHeading>Ai làm gì — sơ đồ làn việc</SubHeading>
            <Swimlane
              lanes={[
                {
                  actor: "Hệ thống AI",
                  tone: "slate",
                  icon: Bot,
                  steps: [
                    { title: "Chấm điểm 6 tiêu chí", sub: "chạy tự động mỗi sáng" },
                    { title: "Đẩy hàng đợi + báo cho AE" },
                    { title: "Chấm &amp; xếp hạng nhà cung cấp", sub: "lưu cố định điểm" },
                    { title: "Phân loại email buyer trả lời" },
                  ],
                },
                {
                  actor: "AE (bạn)",
                  tone: "teal",
                  icon: UserCheck,
                  steps: [
                    { title: "Nhận buyer" },
                    { title: "Hỏi &amp; ghi nhu cầu" },
                    { title: "Duyệt &amp; gửi danh sách" },
                    { title: "Chuyển cơ hội / dừng" },
                    { title: "Chạy Pipeline + chứng từ" },
                  ],
                },
                {
                  actor: "Buyer",
                  tone: "amber",
                  icon: Eye,
                  steps: [
                    { title: "Trả lời nhu cầu", sub: "email/WhatsApp/gặp" },
                    { title: "Mở link giới thiệu" },
                    { title: "Bấm nút quan tâm" },
                    { title: "Chọn nhà cung cấp chính" },
                  ],
                },
                {
                  actor: "Nhà cung cấp",
                  tone: "indigo",
                  icon: Factory,
                  steps: [
                    { title: "Nhận báo ẩn danh", sub: "“một buyer muốn xin mẫu…”" },
                    { title: "Chuẩn bị mẫu/báo giá", sub: "phối hợp qua AE" },
                    { title: "Lên Pipeline sau khi được chọn" },
                    { title: "Nhận báo cáo tuần/tháng" },
                  ],
                },
              ]}
            />
            <Callout kind="tip" title="Cách đọc tài liệu">
              Mỗi bước B1–B9 dưới đây có: (1) điều kiện vào bước, (2) các thao tác bấm, (3) những
              gì hệ thống tự làm thay bạn, (4) trạng thái sau khi hoàn thành. Những ô như{" "}
              <Screen>Buyer của tôi</Screen> là đúng tên màn hình bạn nhìn trên menu; nút bấm được
              trình bày dạng <Ui>nút như thế này</Ui>.
            </Callout>
          </SopSection>

          {/* Phase 0 */}
          <SopSection id="phase0" icon={Coffee} kicker="B0 · Chuẩn bị" title="Chuẩn bị đầu ngày (5 phút)">
            <StepList>
              <Step n={1} title="Kiểm tra email công vụ">
                Địa chỉ tên@veximtrade.com được hệ thống cấp tự động khi bạn gửi thư đầu tiên, gửi và
                nhận đều chạy trên hệ thống sẵn — không cần đăng ký hộp thư riêng, và tuyệt đối
                không gửi buyer từ Gmail cá nhân.
              </Step>
              <Step n={2} title="Bật thông báo và (khuyến nghị) liên kết Telegram">
                Vào <Screen>Cài đặt</Screen> mục <strong>Thông báo</strong>, giữ bật nhóm{" "}
                <Pill tone="rose">Việc cần bạn làm</Pill> và <Pill tone="blue">Cập nhật trạng thái</Pill>.
                Liên kết Telegram để biết buyer phản hồi ngay trên điện thoại.
              </Step>
              <Step n={3} title="Đọc 3 nơi theo thứ tự">
                Chuông thông báo (buyer trả lời, email chưa gắn được) → màn{" "}
                <Screen>Buyer của tôi</Screen> → màn <Screen>Đang xử lý</Screen>, ưu tiên các thẻ có
                nhãn sắp quá hạn và thẻ buyer vừa phản hồi.
              </Step>
              <Step n={4} title="Xử lý “Email chưa khớp” nếu có">
                Mục <Screen>Email chưa khớp</Screen> là thư buyer trả lời nhưng hệ thống chưa gắn
                được vào đúng hồ sơ — gắn lại đúng buyer rồi mới tiếp tục, để không bỏ sót tín hiệu.
              </Step>
            </StepList>
          </SopSection>

          {/* Phase 1 */}
          <SopSection id="phase1" icon={Inbox} kicker="B1 · Nhận buyer" title="Nhận buyer từ hàng đợi">
            <SubHeading>Buyer vào hàng đợi của bạn như thế nào</SubHeading>
            <p>
              Mỗi sáng, hệ thống tự chấm từng buyer mới với từng AE theo <strong>6 tiêu chí</strong>:
              độ khớp sản phẩm · ngành hàng · tình trạng tuân thủ FDA của các nhà cung cấp bạn quản
              lý · khối lượng việc của bạn · tỷ lệ thắng lịch sử · độ khớp thị trường/quốc gia. Điểm
              tổng từ 0–100, cộng ưu tiên cho buyer đã có yêu cầu mua cụ thể. Buyer điểm cao gắn
              nhãn <Pill tone="rose">Ưu tiên cao</Pill>, trung bình <Pill tone="amber">Trung bình</Pill>,
              thấp <Pill tone="slate">Thấp</Pill>.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { v: "7 ngày", l: "Thời hạn mỗi đề xuất trong hàng đợi — quá hạn tự mất lượt nhận." },
                { v: "12 / 15", l: "Mức cảnh báo / chặn cứng số buyer bạn đang xử lý cùng lúc." },
                { v: "1 buyer", l: "Tại một thời điểm chỉ một AE đang xử lý, tránh giành việc." },
              ].map((x) => (
                <div key={x.v} className="rounded-xl border bg-card p-4 text-center">
                  <div className="text-2xl font-bold text-teal-600">{x.v}</div>
                  <div className="mt-1 text-xs leading-5 text-muted-foreground">{x.l}</div>
                </div>
              ))}
            </div>

            <SubHeading>Các bước</SubHeading>
            <StepList>
              <Step n={1} title="Mở màn “Buyer của tôi”, đọc điểm và lý do ghép cặp">
                Mỗi thẻ hiển thị tổng điểm, điểm chi tiết theo 6 tiêu chí và thông tin buyer (sản
                phẩm chính, mã HS, quốc gia, yêu cầu mua đang mở nếu có). Thẻ ưu tiên cao xếp trên
                cùng.
              </Step>
              <Step n={2} title="Phù hợp với nhà cung cấp bạn quản lý thì bấm “Nhận buyer”">
                Hệ thống mở một <strong>hồ sơ xử lý buyer</strong> mới ở trạng thái{" "}
                <Pill tone="slate">Đã nhận — chưa hỏi nhu cầu</Pill>, ghi nhận cho bạn và{" "}
                <strong>lập tức thu hồi đề xuất khỏi hàng đợi của các AE khác</strong>.
              </Step>
              <Step n={3} title="Không hợp năng lực: không nhận, để đề xuất tự hết hạn">
                Trường hợp đã lỡ nhận rồi mới nhận ra sai ngành, dùng nút <Ui>Chuyển AE</Ui> kèm lý
                do (xem mục <a href="#exceptions" className="text-teal-600 underline">Chuyển / Trả buyer</a>).
              </Step>
            </StepList>

            <Callout kind="warning" title="Khi cấp quản lý gán buyer trực tiếp">
              Quản lý có thể gán thẳng buyer cho AE kể cả khi điểm ghép cặp không cao nhất. Nếu AE
              được chọn thua ứng viên hàng đầu từ <strong>15 điểm trở lên</strong>, người gán bắt
              buộc phải nhập lý do; hồ sơ cũng được gắn nhãn “gán thủ công” để đội vận hành đối
              chiếu chất lượng sau này. Khi bạn đang có 15 buyer chưa xử lý xong, chỉ cấp quản lý cao
              nhất mới gán thêm được.
            </Callout>
            <Callout kind="tip" title="Nhận nhanh buyer nào">
              Buyer đã để lại yêu cầu mua cụ thể (sản phẩm, số lượng, giá mục tiêu, thời hạn cần hàng)
              thường là ưu tiên cao và đối thủ đang tiếp cận — cố gắng nhận và gửi email hỏi nhu cầu
              trong ngày.
            </Callout>
          </SopSection>

          {/* Phase 2 */}
          <SopSection id="phase2" icon={MailPlus} kicker="B2 · Tiếp cận" title="Gửi email hỏi nhu cầu buyer">
            <Flow>
              <FlowNode tone="slate" title="Đã nhận" sub="Chưa hỏi nhu cầu" />
              <FlowArrow label="gửi email" />
              <FlowNode tone="blue" title="Đã gửi email hỏi nhu cầu" sub="Đang chờ buyer trả lời" />
              <FlowArrow label="buyer trả lời" />
              <FlowNode tone="indigo" title="Đã có nhu cầu buyer" />
            </Flow>
            <StepList>
              <Step n={1} title="Mở hồ sơ buyer, bấm “Soạn email hỏi nhu cầu”">
                Hệ thống soạn sẵn nội dung dựa trên sản phẩm, mã HS và quốc gia của buyer. Bạn có thể
                bấm tạo lại, chỉnh giọng văn rồi gửi bằng email công vụ. Email cần hỏi đủ thông tin
                phục vụ việc ghép nhà cung cấp: sản phẩm &amp; đặc tả, số lượng/đơn hàng tối thiểu,
                giá mục tiêu, điều khoản thanh toán, yêu cầu đóng gói/nhãn mác, thời gian cần hàng.
              </Step>
              <Step n={2} title="Hệ thống chuyển trạng thái và bắt đầu đếm thời gian">
                Hồ sơ chuyển sang <Pill tone="blue">Đã gửi email hỏi nhu cầu</Pill>, nội dung thư
                được lưu lại. Nếu sau <strong>14 ngày</strong> hồ sơ không tiến triển và buyer không
                hồi âm, hệ thống tự nhắc bạn và quản lý trực tiếp.
              </Step>
              <Step n={3} title="Buyer im lặng: bấm “Gửi email nhắc lại”">
                Hệ thống soạn thư nhắc và đưa bộ đếm 14 ngày về 0 — đừng nhắc nguyên văn nhiều lần;
                hãy đổi góc tiếp cận (diễn biến giá thị trường, chứng chỉ sẵn có, hình ảnh nhà máy).
              </Step>
              <Step n={4} title="Buyer trả lời qua kênh khác (WhatsApp/gặp mặt/điện thoại)">
                Mở hồ sơ, chọn đúng kênh tiếp xúc (bắt buộc khi không phải email) rồi dán nội dung
                hoặc tóm tắt vào bước ghi nhận nhu cầu bên dưới — hệ thống vẫn tính tiến độ cho bạn.
              </Step>
            </StepList>
            <Callout kind="info" title="Email buyer trả lời được hệ thống xử lý ra sao">
              Thư trả lời về email công vụ được hệ thống tự gắn vào đúng hồ sơ buyer và dán nhãn ý
              định: <Pill tone="amber">Hỏi giá</Pill> <Pill tone="blue">Xin mẫu</Pill>{" "}
              <Pill tone="rose">Phản đối / lo ngại</Pill> <Pill tone="emerald">Dấu hiệu chốt đơn</Pill>.
              Thư nào không gắn được sẽ nằm ở <Screen>Email chưa khớp</Screen> để bạn nối lại thủ công.
            </Callout>
          </SopSection>

          {/* Phase 3 */}
          <SopSection id="phase3" icon={ClipboardList} kicker="B3 · Đầu vào giới thiệu" title="Ghi nhận nhu cầu buyer">
            <p>Dùng mục <Ui>Ghi nhận nhu cầu buyer</Ui> để điền đủ <strong>6 thông tin</strong>; chúng được dùng để chấm nhà cung cấp và sẽ tự động chuyển vào ghi chú thương vụ sau này:</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                ["Sản phẩm yêu cầu", "Tên hàng, đặc tả, quy cách"],
                ["Khoảng giá mục tiêu", "USD/kg, theo FOB/CIF…"],
                ["Số lượng tối thiểu (MOQ)", "Số lượng/đơn hoặc/chuyến"],
                ["Điều khoản thanh toán", "T/T, L/C, % đặt cọc…"],
                ["Yêu cầu đóng gói", "Bao bì, nhãn riêng, pallet…"],
                ["Yêu cầu khác", "Chứng nhận, giao hàng, thị trường"],
              ].map(([a, b]) => (
                <div key={a} className="flex items-start gap-2 rounded-lg border bg-card p-3 text-sm">
                  <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                  <span><strong>{a}.</strong> <span className="text-muted-foreground">{b}</span></span>
                </div>
              ))}
            </div>
            <p>Sau khi lưu, hồ sơ chuyển sang <Pill tone="indigo">Đã có nhu cầu buyer</Pill> và nút dựng danh sách giới thiệu được mở.</p>
            <Callout kind="warning" title="Nhu cầu còn mờ thì đừng vượt bước">
              Nếu buyer chỉ nói chung chung (“cần cà phê giá tốt”), hãy hỏi thêm 1–2 lượt để có ít
              nhất sản phẩm + số lượng hoặc giá. Giới thiệu trên nhu cầu mờ sẽ ra sai nhà cung cấp,
              mất uy tín khi buyer mở link.
            </Callout>
          </SopSection>

          {/* Phase 4 */}
          <SopSection id="phase4" icon={Wand2} kicker="B4 · Chọn nhà cung cấp" title="Dựng danh sách giới thiệu">
            <StepList>
              <Step n={1} title="Bấm “Dựng danh sách giới thiệu” trên hồ sơ">
                Hệ thống đối chiếu nhu cầu buyer với toàn bộ nhà cung cấp đã có hồ sơ công khai (sản
                phẩm, mã HS, ngành hàng, chứng chỉ FDA/COA, năng lực, giá) và đề xuất danh sách xếp
                theo điểm phù hợp.
              </Step>
              <Step n={2} title="Chọn từ 1 đến 3 nhà cung cấp">
                Đây là giới hạn cứng: buyer không nên thấy quá 3 lựa chọn. Ưu tiên điểm cao, nên có
                sự đa dạng phân khúc giá; kiểm tra chứng chỉ còn hạn và năng lực đáp ứng được số
                lượng/MOQ.
              </Step>
              <Step n={3} title="Đọc lý do ghép cặp và các rủi ro còn lại trước khi lưu">
                Mỗi nhà cung cấp có điểm chi tiết, lý do phù hợp và mục “rủi ro còn lại” (ví dụ:
                thiếu một chứng chỉ cho thị trường này). AE là người quyết định cuối — bạn có thể bỏ
                ứng viên hệ thống đề xuất để chọn người khác.
              </Step>
              <Step n={4} title="Lưu thành bản dự thảo">
                Hệ thống lưu cố định điểm, lý do, rủi ro và <strong>chụp lại hồ sơ nhà cung cấp tại
                thời điểm đó</strong>. Sau này nhà cung cấp có cập nhật hồ sơ thì những gì buyer đã
                xem cũng không bị thay đổi.
              </Step>
            </StepList>
            <Callout kind="danger" title="Không sửa được danh sách đã gửi">
              Danh sách một khi đã gửi cho buyer là cố định, hệ thống sẽ báo bạn không thể lưu chỉnh
              sửa. Muốn thay đổi nhà cung cấp? Bấm tạo <Ui>phiên bản mới</Ui> — bản cũ được lưu lại
              và link buyer đang giữ vẫn mở đúng nội dung cũ.
            </Callout>
          </SopSection>

          {/* Phase 5 */}
          <SopSection id="phase5" icon={Send} kicker="B5 · Buyer phản hồi" title="Duyệt, gửi link và theo dõi phản hồi">
            <StepList>
              <Step n={1} title="Bấm “Duyệt &amp; gửi danh sách”">
                Hệ thống tạo một <strong>đường link giới thiệu riêng</strong> (dãy mã bí mật, hết hạn
                sau <strong>30 ngày</strong>, có thể thu hồi), hồ sơ chuyển sang{" "}
                <Pill tone="amber">Đã gửi shortlist cho buyer</Pill>. Gửi link này cho buyer qua
                email công vụ (hoặc kênh đang trao đổi), kèm thời hạn phản hồi.
              </Step>
              <Step n={2} title="Theo dõi tín hiệu ngay trên hồ sơ">
                Buyer mở link → trạng thái <Pill tone="amber">Buyer đã xem shortlist</Pill> (hệ
                thống còn ghi buyer dừng lại lâu ở nhà cung cấp nào). Buyer bấm nút phản hồi →{" "}
                <Pill tone="emerald">Buyer quan tâm — cần quyết định</Pill>. Bạn nhận thông báo tức
                thì qua chuông/email/Telegram.
              </Step>
              <Step n={3} title="Đọc đúng 5 nút buyer được bấm trên link">
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Pill tone="slate">Quan tâm (chưa chi tiết)</Pill>
                  <Pill tone="blue">Hỏi thêm thông tin</Pill>
                  <Pill tone="blue">Yêu cầu mẫu</Pill>
                  <Pill tone="violet">Yêu cầu họp</Pill>
                  <Pill tone="emerald">Muốn thảo luận đặt hàng</Pill>
                </div>
              </Step>
              <Step n={4} title="Hành động theo từng tín hiệu">
                <strong>Xin mẫu</strong>: liên hệ ngay nhà cung cấp để chuẩn bị mẫu, thống nhất chi
                phí và cách gửi. <strong>Muốn họp</strong>: chốt lịch và kéo nhà cung cấp tham gia.{" "}
                <strong>Muốn bàn đơn</strong>: đã đủ điều kiện chuyển thành cơ hội (bước B6).{" "}
                <strong>Hỏi thêm thông tin</strong>: trả lời trong vòng 24 giờ và bổ sung tài liệu.
              </Step>
            </StepList>
            <Callout kind="tip" title="Vì sao nhà cung cấp nhận báo nhưng không biết buyer là ai">
              Khi buyer bấm xin mẫu / muốn họp / muốn bàn đơn, nhà cung cấp chỉ nhận được thông báo{" "}
              <strong>ẩn danh</strong> (“Một buyer muốn nhận mẫu…”), còn bạn nhận được thông báo đầy
              đủ. Bạn là người kiểm soát thời điểm lộ danh tính — không tự ý gửi tên/email buyer cho
              nhà cung cấp trước khi thương vụ đạt bước Đã chốt giá.
            </Callout>
            <Callout kind="info" title="Các ghi nhận nội bộ chỉ AE thao tác">
              Ba mốc <Pill tone="emerald">Chọn làm supplier chính</Pill>, <Pill tone="teal">Đã gửi
              giá/số lượng</Pill>, <Pill tone="teal">Đã gửi PO</Pill> do AE tự ghi khi việc thật sự
              xảy ra — buyer không có các nút này trên trang công khai.
            </Callout>
          </SopSection>

          {/* Phase 6 */}
          <SopSection id="phase6" icon={GitMerge} kicker="B6 · Ngã ba quyết định" title="Chuyển thành cơ hội, làm bản mới, hay dừng hồ sơ">
            <Decision
              question="Buyer đã chọn nhà cung cấp / có tín hiệu đủ mạnh để vào đàm phán?"
              yes={
                <Flow>
                  <FlowNode tone="emerald" title="Chuyển thành cơ hội" sub="Chọn đúng 1 nhà chính + tối đa 2 nhà dự phòng" icon={GitMerge} />
                </Flow>
              }
              no={
                <Flow>
                  <FlowNode tone="violet" title="Tạo bản giới thiệu mới" sub="Đổi/bổ sung nhà cung cấp rồi gửi lại" />
                  <FlowNode tone="rose" title="Dừng hồ sơ" sub="Bắt buộc ghi lý do" />
                </Flow>
              }
            />
            <SubHeading>Khi chuyển thành cơ hội: bạn làm gì, hệ thống làm gì</SubHeading>
            <StepList>
              <Step n={1} title="Chọn đúng một nhà cung cấp chính">
                Có thể chọn thêm tối đa 2 nhà dự phòng. Không đánh dấu nhà chính thì hệ thống không
                cho hoàn tất.
              </Step>
              <Step n={2} title="Nhập giá trị thương vụ dự kiến (nếu đã có)">
                Lấy theo nhà cung cấp chính; khi chốt giá thật trên Pipeline sẽ cập nhật lại sau.
              </Step>
              <Step n={3} title="Hệ thống tạo thương vụ cho từng nhà được chọn">
                Mỗi nhà cung cấp xuất hiện một thẻ trên màn <Screen>Pipeline</Screen> ở cột{" "}
                <Pill tone="violet">Yêu cầu mẫu</Pill>; toàn bộ 6 mục nhu cầu được chép vào{" "}
                <strong>ghi chú của thẻ thương vụ</strong> để bạn không phải dò lại hồ sơ cũ; hồ sơ
                giới thiệu được đóng với kết quả “đã chuyển thành cơ hội”, ẩn khỏi hàng đợi và lưu
                dấu vết trong nhật ký.
              </Step>
            </StepList>
            <Callout kind="warning" title="Mỗi nhà cung cấp chỉ nhận tối đa 30 thương vụ đang chạy">
              Nếu nhà được chọn đã đủ 30 thẻ chưa Thành công/Thất bại, hệ thống sẽ báo không tạo
              thêm được — phối hợp quản lý đóng các thẻ cũ trước khi chuyển.
            </Callout>
            <Callout kind="danger" title="Khi dừng hồ sơ">
              Chỉ dùng <Ui>Dừng hồ sơ</Ui> khi buyer rõ ràng không mua (từ chối thẳng, mất liên lạc
              sau nhiều lần nhắc, sai phân khúc). Bắt buộc ghi lý do — số liệu này dùng để phân tích
              chất lượng ghép nối và cải thiện thuật toán. Sau khi đã chuyển thành cơ hội hoặc dừng,
              hồ sơ được khóa, không thao tác tiếp được.
            </Callout>
          </SopSection>

          {/* Phase 7 */}
          <SopSection id="phase7" icon={Kanban} kicker="B7 · Thương vụ" title="Vận hành Pipeline sau khi chuyển">
            <SubHeading>10 cột và quy tắc lộ danh tính</SubHeading>
            <div className="overflow-x-auto rounded-xl border p-3">
              <div className="flex min-w-[860px] flex-col gap-2">
                <div className="flex gap-1.5">
                  {[
                    ["Mới", "slate"], ["Đã liên hệ", "amber"], ["Yêu cầu mẫu", "violet"], ["Đã gửi mẫu", "purple"],
                    ["Đàm phán", "orange"], ["Đã chốt giá", "sky"], ["Đang sản xuất", "indigo"],
                    ["Đã giao hàng", "teal"], ["Thành công", "emerald"], ["Thất bại", "rose"],
                  ].map(([label, tone], i) => (
                    <div key={label} className="flex flex-1 items-center">
                      <FlowNode small tone={tone as keyof typeof TONE} title={label} />
                      {i < 9 && <FlowArrow />}
                    </div>
                  ))}
                </div>
                <div className="rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  <Lock className="mr-1 inline h-3.5 w-3.5" />
                  Nhà cung cấp chỉ thấy MÃ buyer (ví dụ BYR-2026-0142) ở các cột trước “Đã chốt
                  giá”. Từ bước Đã chốt giá trở đi (Đang sản xuất, Đã giao hàng, Thành công) tên thật
                  mới hiện — quy tắc này áp dụng trên cả app, email và báo cáo PDF.
                </div>
              </div>
            </div>

            <SubHeading>Hai loại cập nhật bạn dùng trên thẻ thương vụ</SubHeading>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border bg-card p-4">
                <div className="mb-1 flex items-center gap-2 font-semibold text-blue-600">
                  <TimerReset className="h-4 w-4" /> “Bước tiếp theo” — bên Vexim đang làm gì
                </div>
                <p className="text-sm text-muted-foreground">
                  Cập nhật mỗi khi bạn hành động (đang gom mẫu, đang xác nhận lịch sản xuất…). Nhà
                  cung cấp nhận thông báo nhóm <Pill tone="blue">Cập nhật trạng thái</Pill>.
                </p>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="mb-1 flex items-center gap-2 font-semibold text-rose-600">
                  <Bell className="h-4 w-4" /> “Việc cần nhà cung cấp làm” — cần phía cung xử lý
                </div>
                <p className="text-sm text-muted-foreground">
                  Ghi việc cần làm kèm <strong>hạn chót</strong> (gửi mẫu, duyệt báo giá PI, đặt
                  cọc, cung cấp hồ sơ…). Nhà cung cấp nhận thông báo nhóm{" "}
                  <Pill tone="rose">Việc cần bạn làm</Pill> và chỉ số SLA được tính theo hạn này.
                </p>
              </div>
            </div>
            <Callout kind="tip" title="Giữ điểm SLA và sự an tâm của nhà cung cấp">
              Hễ có chuyển động thật là cập nhật “Bước tiếp theo” trong cùng ngày, kể cả khi chưa có
              kết quả cuối. Nhà cung cấp tự nhận thông báo, bạn không phải nhắn tay, và bảng SLA cuối
              tháng sẽ ghi nhận bạn phản hồi đúng hạn.
            </Callout>
          </SopSection>

          {/* Phase 8 */}
          <SopSection id="phase8" icon={FileCheck2} kicker="B8 · Tuân thủ" title="Chứng từ & kiểm soát giao dịch">
            <p>
              Trên thẻ thương vụ, AE tải lên chứng từ thương mại (hợp đồng/báo giá PI, PO, packing
              list, vận đơn BL…) và cập nhật mục tuân thủ. Chứng từ pháp lý chỉ nhận <strong>file tải
              lên</strong>, không dán đường link ngoài.
            </p>
            <Flow>
              <FlowNode tone="violet" title="Báo giá PI" sub="nhà cung cấp duyệt, chốt giá" />
              <FlowNode tone="indigo" title="PO" sub="đặt cọc theo điều khoản" />
              <FlowNode tone="indigo" title="Xác minh LC" sub="người thứ hai kiểm tra" />
              <FlowNode tone="teal" title="Bằng chứng SWIFT" sub="tách biệt người kiểm tra" />
              <FlowNode tone="teal" title="Sản xuất · BL · Giao hàng" />
            </Flow>
            <Callout kind="danger" title="Nguyên tắc đối soát chéo chứng từ thanh toán">
              Người tạo/lệnh giao dịch không được tự xác minh bằng chứng thanh toán SWIFT — bắt buộc
              một người thứ hai được phân quyền bấm xác nhận. Không dùng chung tài khoản để lách quy
              định này.
            </Callout>
            <Callout kind="warning" title="Chứng chỉ sắp hết hạn là việc của mọi người">
              Hệ thống tự quét mỗi ngày và cảnh báo FDA (trước 90 ngày) cùng các chứng chỉ khác
              (trước 30 ngày, khẩn cấp ở 7 ngày) cho cả nhà cung cấp lẫn nội bộ. Thương vụ đang chạy
              mà chứng chỉ sắp hết hạn, bạn là người thúc nhà cung cấp gia hạn sớm — đừng để kẹt lúc
              giao hàng.
            </Callout>
          </SopSection>

          {/* Phase 9 */}
          <SopSection id="phase9" icon={Handshake} kicker="B9 · Kết thúc" title="Chốt thương vụ và chăm sóc sau thành công">
            <StepList>
              <Step n={1} title="Kéo thẻ sang “Thành công” hoặc “Thất bại” và ghi rõ lý do">
                Nhà cung cấp nhận thông báo <Pill tone="emerald">Kết quả thương vụ</Pill> “Thương vụ
                thành công/kết thúc”; kết quả cũng được ghi nhận vào KPI của bạn. Sau khi đã thành
                công hoặc thất bại, thẻ bị khóa chủ sở hữu — không thể chuyển cho AE khác.
              </Step>
              <Step n={2} title="Phí thành công & hóa đơn chạy tự động">
                Hệ thống tự đối chiếu các thương vụ thành công để lập khoản phí thành công; bộ phận
                tài chính phát hành hóa đơn (phí giữ chỗ hằng tháng, phí thành công, thư nhắc thu
                quá hạn). Việc của AE là đảm bảo giá trị và số liệu trên thẻ thương vụ chính xác.
              </Step>
              <Step n={3} title="Chăm sóc đơn lặp lại sau 90 ngày">
                Đủ 90 ngày kể từ khi chốt thành công, hệ thống nhắc bạn (và ghi vào nhật ký thương
                vụ) để đề nghị đơn tiếp theo. Chủ động soạn email thăm hỏi trước cả thời điểm đó
                càng tốt.
              </Step>
              <Step n={4} title="Thương vụ thất bại được lưu trữ tự động">
                Các thẻ thất bại cũ được hệ thống tự lưu trữ; số liệu vẫn dùng để phân tích nguyên
                nhân thua theo quốc gia/ngành tại màn <Screen>Phân tích</Screen>.
              </Step>
            </StepList>
          </SopSection>

          {/* Exceptions */}
          <SopSection id="exceptions" icon={ArrowRightLeft} kicker="Ngoại lệ" title="Chuyển buyer, trả về hàng đợi chung">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-2 font-semibold">
                  <ArrowRightLeft className="h-4 w-4 text-blue-600" /> Chuyển cho AE khác
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Dùng khi buyer thực ra thuộc ngành/thị trường của AE khác. Chọn AE đích (hệ thống
                  hiển thị số buyer mỗi người đang gánh để tránh dồn việc) và <strong>bắt buộc ghi
                  lý do</strong>. Hệ thống kiểm tra giới hạn 12/15, đổi chủ hồ sơ, đưa bộ đếm thời
                  gian về 0, và báo cho cả hai AE.
                </p>
              </div>
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-2 font-semibold">
                  <Undo2 className="h-4 w-4 text-amber-600" /> Trả về hàng đợi chung
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Khi bạn không thể tiếp tục phục vụ buyer, bấm <Ui>Trả về inbox</Ui> kèm lý do. Hồ
                  sơ hiện tại được đóng, buyer xuất hiện lại trong hàng đợi của các AE trong 7 ngày
                  để người khác nhận.
                </p>
              </div>
            </div>
            <Callout kind="info" title="Quản lý gán buyer trực tiếp">
              Trường hợp cấp thiết, quản lý dùng nút <Ui>Gán cho AE…</Ui> trên màn Buyer, trang chi
              tiết buyer hoặc thẻ trong hàng đợi. AE được gán nhận thông báo nhóm{" "}
              <Pill tone="violet">Lead mới được giao</Pill>; các giới hạn về độ lệch điểm (15 điểm)
              và khối lượng việc (12/15) vẫn được áp dụng như ở bước B1.
            </Callout>
          </SopSection>

          {/* Thresholds */}
          <SopSection id="thresholds" icon={Gauge} kicker="Tra cứu nhanh" title="Bảng mốc thời gian & giới hạn">
            <RuleTable
              rows={[
                { rule: "Thời hạn một đề xuất trong hàng đợi", value: "7 ngày", note: "Quá hạn bạn mất lượt nhận, buyer có thể được đẩy lại cho AE khác." },
                { rule: "Số nhà cung cấp trên một danh sách giới thiệu", value: "1–3 nhà", note: "Ngoài khoảng này hệ thống không cho lưu." },
                { rule: "Thời hạn link giới thiệu gửi buyer", value: "30 ngày", note: "Có thể thu hồi sớm; cần gửi lại thì tạo bản giới thiệu mới." },
                { rule: "Hồ sơ buyer bị coi là tồn đọng", value: "14 ngày", note: "Không tiến triển và buyer không hồi âm → hệ thống nhắc AE và quản lý." },
                { rule: "Khối lượng việc của AE — mức cảnh báo", value: "12 buyer", note: "Thẻ chuyển vàng khi quản lý gán thêm." },
                { rule: "Khối lượng việc của AE — mức chặn", value: "15 buyer", note: "Chỉ cấp quản lý cao nhất mới gán vượt được." },
                { rule: "Số nhà cung cấp mỗi AE phụ trách", value: "7 nhà", note: "Đếm theo số hồ sơ nhà cung cấp gắn với bạn; khác với số buyer đang xử lý." },
                { rule: "Số thương vụ đang chạy của một nhà cung cấp", value: "30 thẻ", note: "Không tính các thẻ đã Thành công/Thất bại." },
                { rule: "Bắt buộc nhập lý do khi gán lệch đề xuất AI", value: "≥ 15 điểm", note: "Hoặc khi AE được chọn chưa từng được hệ thống chấm điểm." },
                { rule: "Mốc được phép lộ tên buyer cho nhà cung cấp", value: "Đã chốt giá", note: "Trước đó chỉ hiển thị mã buyer trên app, email và báo cáo." },
                { rule: "Báo cáo tuần gửi nhà cung cấp", value: "16:00 thứ Hai (giờ VN)", note: "Bao gồm cả số liệu giới thiệu ẩn danh." },
                { rule: "Cảnh báo chứng chỉ FDA / chứng chỉ khác", value: "90 / 30 ngày", note: "Mức khẩn cấp 7 ngày cho chứng chỉ thường." },
              ]}
            />
          </SopSection>

          {/* Client visibility */}
          <SopSection id="client-visibility" icon={Eye} kicker="Hệ quả" title="Mỗi thao tác của bạn, nhà cung cấp nhìn thấy gì">
            <p>Nắm bảng này để biết khi nào cần cập nhật và khi nào không hứa trước hệ thống:</p>
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left">
                  <tr>
                    <th className="px-4 py-2.5">Việc bạn làm</th>
                    <th className="px-4 py-2.5">Nhà cung cấp nhận được</th>
                    <th className="px-4 py-2.5">Danh tính buyer</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[
                    ["Gửi danh sách có nhà cung cấp này", "Đếm vào mục “được giới thiệu cho buyer” trong báo cáo tuần/tháng", "Ẩn danh"],
                    ["Buyer mở link xem hồ sơ", "Đếm vào mục “buyer đã xem hồ sơ”", "Ẩn danh"],
                    ["Buyer bấm xin mẫu / muốn họp / muốn bàn đơn", "Thông báo tức thì “một buyer muốn…” + đếm vào báo cáo", "Ẩn danh"],
                    ["Chuyển thành cơ hội", "Thẻ thương vụ xuất hiện ở mục thương vụ của họ, tại cột Yêu cầu mẫu", "Chỉ thấy mã buyer"],
                    ["Bạn cập nhật “Bước tiếp theo”", "Chuông và email “Cập nhật tiến độ”", "Mã buyer"],
                    ["Bạn tạo “Việc cần nhà cung cấp làm”", "Chuông và email “Cần bạn xử lý” kèm hạn chót", "Mã buyer"],
                    ["Thẻ thương vụ qua bước Đã chốt giá", "Tên thật của buyer bắt đầu hiển thị", "Tên thật"],
                    ["Kéo thẻ sang Thành công / Thất bại", "Thông báo “Thương vụ thành công/kết thúc”", "Tên thật"],
                  ].map((r, i) => (
                    <tr key={i} className={i % 2 ? "bg-muted/30" : "bg-card"}>
                      <td className="px-4 py-2.5">{r[0]}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r[1]}</td>
                      <td className="px-4 py-2.5">
                        {r[2] === "Tên thật" ? <Pill tone="emerald">{r[2]}</Pill> : <Pill tone="slate">{r[2]}</Pill>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Callout kind="tip" title="Báo cáo nhà cung cấp là “tấm gương” phản chiếu việc bạn làm">
              Tuần không có thương vụ mới nhưng bạn gửi được danh sách giới thiệu, nhà cung cấp vẫn
              nhận báo cáo có số liệu — vì vậy ghi nhận đúng mọi thao tác trên hệ thống sẽ trực tiếp
              tạo dựng niềm tin với nhà cung cấp.
            </Callout>
          </SopSection>

          {/* Checklist */}
          <SopSection id="checklist" icon={CalendarCheck} kicker="Thói quen" title="Checklist mỗi ngày & mỗi thứ Hai">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border bg-card p-5">
                <div className="mb-3 font-semibold">Mỗi ngày làm việc</div>
                <ul className="space-y-2 text-sm">
                  {[
                    "Đọc chuông thông báo, xử lý các email chưa khớp.",
                    "Nhận các buyer ưu tiên cao trong hàng đợi.",
                    "Trả lời mọi buyer đã phản hồi (mục tiêu trong 24 giờ).",
                    "Cập nhật “Bước tiếp theo” cho thương vụ có chuyển động.",
                    "Xử lý các “Việc cần nhà cung cấp làm” sắp đến hạn.",
                    "Gửi email nhắc lại cho hồ sơ chạm mốc 14 ngày.",
                  ].map((x) => (
                    <Check key={x}>{x}</Check>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border bg-card p-5">
                <div className="mb-3 font-semibold">Mỗi thứ Hai</div>
                <ul className="space-y-2 text-sm">
                  {[
                    "Rà màn Đang xử lý: hồ sơ nào đứng một trạng thái quá lâu.",
                    "Danh sách gửi sau 7–10 ngày buyer không phản hồi → tạo bản mới hoặc dừng có lý do.",
                    "Đối chiếu KPI tuần trước tại màn KPI của tôi.",
                    "Kiểm tra chứng chỉ sắp hết hạn của các nhà cung cấp đang giao dịch.",
                    "Chuẩn bị mẫu/lịch họp mà buyer đã yêu cầu tuần trước.",
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
                    ["Đề xuất buyer không còn / đã được xử lý khi bấm Nhận", "Buyer đã thuộc về AE khác, hoặc đề xuất đã hết hạn 7 ngày", "Tải lại trang; nếu buyer quan trọng, báo quản lý để được gán lại."],
                    ["Bạn không có quyền thao tác trên hồ sơ này", "Bạn không phải AE đang sở hữu hồ sơ", "Chỉ AE đang giữ hồ sơ mới thao tác được; cần nhận lại thì yêu cầu quản lý chuyển hồ sơ."],
                    ["Không lưu được danh sách giới thiệu", "Số nhà cung cấp ngoài khoảng cho phép", "Chọn lại trong khoảng từ 1 đến 3 nhà cung cấp."],
                    ["Không lưu được chỉnh sửa danh sách đã gửi", "Danh sách đã gửi là cố định", "Bấm tạo phiên bản mới với các thay đổi, rồi gửi link mới."],
                    ["Bản dự thảo trống khi bấm gửi", "Trong danh sách không còn nhà cung cấp hợp lệ", "Mở lại bản dự thảo, chọn lại nhà cung cấp trước khi gửi."],
                    ["Không hoàn tất việc chuyển thành cơ hội", "Bạn chưa đánh dấu nhà cung cấp chính", "Đánh dấu đúng một nhà là “chính”; các nhà khác để ở vai trò dự phòng."],
                    ["Nhà cung cấp đã đủ số thương vụ đang chạy", "Đã đạt giới hạn 30 thẻ chưa đóng", "Phối hợp quản lý đóng các thẻ cũ rồi chuyển lại."],
                    ["AE được chuyển buyer đã quá tải", "Người đó đang gánh đủ 15 buyer", "Chọn AE khác, hoặc nhờ cấp quản lý cao nhất gán đè."],
                    ["Hồ sơ đã đóng, không cho thao tác tiếp", "Buyer đã được chuyển thành cơ hội hoặc hồ sơ đã dừng", "Mọi việc tiếp theo thực hiện trên thẻ thương vụ tại màn Pipeline."],
                    ["Bị bắt buộc nhập lý do", "Đây là thao tác ngoại lệ (chuyển/trả buyer, gán thủ công)", "Nhập lý do rõ ràng — trường này được lưu lại để truy vết."],
                    ["Báo “bạn không có quyền”", "Vai trò LR/SR không thực hiện được bước này", "Liên hệ quản lý nếu nghiệp vụ phát sinh; không tự đổi vai trò."],
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
              Chụp màn hình thông báo kèm hồ sơ buyer, gửi quản lý trực tiếp hoặc nhóm vận hành. Với
              các nút có ghi dữ liệu (gửi, chuyển thành cơ hội), đừng bấm thử nhiều lần vì mỗi lần
              bấm đều được hệ thống ghi lại.
            </Callout>
          </SopSection>

          {/* KPI */}
          <SopSection id="kpi" icon={BarChart3} kicker="Đo lường" title="KPI của AE">
            <p>Tại màn <Screen>KPI của tôi</Screen>, chọn kỳ xem theo tuần/tháng/quý:</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Tỷ lệ thắng", "Số thương vụ thành công trên tổng thương vụ đã có kết quả, so với trung bình team"],
                ["Doanh thu trong kỳ & đà tăng trưởng", "Tổng giá trị các thương vụ thành công trong kỳ"],
                ["Thành công / Thất bại / Đang chạy", "Phân loại thương vụ theo kết quả trong kỳ"],
                ["Xếp hạng trong team", "Hạng theo hiệu suất; top 1–2 có huy hiệu"],
              ].map(([a, b]) => (
                <div key={a} className="rounded-xl border bg-card p-4">
                  <div className="font-semibold">{a}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{b}</div>
                </div>
              ))}
            </div>
            <p className="text-muted-foreground">
              Cách cải thiện bền vững nhất: phản hồi buyer nhanh, danh sách giới thiệu bám sát nhu
              cầu (tỉ lệ chuyển thành cơ hội cao), và cập nhật Pipeline đầy đủ để hạn chế thẻ thương
              vụ thất bại vì chờ đợi.
            </p>
            <div className="mt-6 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              <BookOpen className="mr-1 inline h-4 w-4" />
              Tài liệu cho LR (tìm &amp; làm giàu buyer) và SR (tuyển nhà cung cấp) đang được biên
              soạn tại <Link href="/admin/knowledge" className="text-teal-600 underline">Trung tâm kiến thức</Link>.
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
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
      <span>{children}</span>
    </li>
  )
}
