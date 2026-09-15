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
  AppLink,
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
          một buyer từ khi AI matching đẩy vào inbox, qua hỏi nhu cầu — giới thiệu nhà cung cấp —
          chốt supplier, đến khi cơ hội chạy trên kanban và giao hàng. Đọc theo sơ đồ là hiểu được
          ngay cần bấm gì, hệ thống tự làm gì, và giới hạn nào không được vượt.
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
              { href: "#phase1", label: "B1 — Nhận buyer từ Inbox", icon: Inbox },
              { href: "#phase2", label: "B2 — Hỏi nhu cầu buyer", icon: MailPlus },
              { href: "#phase3", label: "B3 — Ghi nhận nhu cầu", icon: ClipboardList },
              { href: "#phase4", label: "B4 — Dựng shortlist", icon: Wand2 },
              { href: "#phase5", label: "B5 — Gửi & theo dõi shortlist", icon: Send },
              { href: "#phase6", label: "B6 — Convert / Drop", icon: GitMerge },
              { href: "#phase7", label: "B7 — Vận hành kanban", icon: Kanban },
              { href: "#phase8", label: "B8 — Chứng từ tuân thủ", icon: FileCheck2 },
              { href: "#phase9", label: "B9 — Chốt & sau chốt", icon: Handshake },
              { href: "#exceptions", label: "Chuyển / Trả buyer", icon: ArrowRightLeft },
              { href: "#thresholds", label: "Bảng ngưỡng hệ thống", icon: Gauge },
              { href: "#client-visibility", label: "Client nhìn thấy gì", icon: Eye },
              { href: "#checklist", label: "Checklist ngày & tuần", icon: CalendarCheck },
              { href: "#errors", label: "Lỗi thường gặp", icon: CircleAlert },
              { href: "#kpi", label: "KPI của AE", icon: BarChart3 },
            ]}
          />
        </aside>

        <article className="min-w-0 space-y-2">
          {/* 1. Mission */}
          <SopSection id="mission" icon={Target} kicker="Tổng quan" title="Vai trò & màn hình chính">
            <p>
              AE là người <strong>sở hữu buyer</strong> sau khi AI matching phân bổ: tiếp cận, khai
              thác nhu cầu, giới thiệu đúng nhà cung cấp Việt Nam (client), và đưa cơ hội vào kanban
              cho tới khi giao hàng. AE không tự tìm buyer (việc của LR), không tự tạo client (việc
              của SR), không thấy giá vốn (R-06) và không tự gán buyer cho mình.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border bg-card p-4">
                <div className="mb-2 flex items-center gap-2 font-semibold">
                  <Inbox className="h-4 w-4 text-teal-600" /> Làm việc mỗi ngày
                </div>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  <li><AppLink href="/admin/ae-inbox">/admin/ae-inbox</AppLink> — hàng đợi buyer được matching &amp; các engagement đang phụ trách</li>
                  <li><AppLink href="/admin/engagements">/admin/engagements</AppLink> — bảng “Đang xử lý”</li>
                  <li><AppLink href="/admin/pipeline">/admin/pipeline</AppLink> — kanban cơ hội sau convert</li>
                  <li><AppLink href="/admin/my-kpi">/admin/my-kpi</AppLink> — win rate, doanh thu, xếp hạng team</li>
                </ul>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="mb-2 flex items-center gap-2 font-semibold">
                  <MessagesSquare className="h-4 w-4 text-teal-600" /> Tra cứu khi cần
                </div>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  <li><AppLink href="/admin/buyers">/admin/buyers</AppLink> — kho buyer &amp; điểm AI</li>
                  <li><AppLink href="/admin/clients">/admin/clients</AppLink> — nhà cung cấp do AE quản lý (tối đa 7)</li>
                  <li><AppLink href="/admin/sourcing">/admin/sourcing</AppLink> — nhu cầu &amp; nguồn cung</li>
                  <li><AppLink href="/admin/sla">/admin/sla</AppLink> — chỉ số SLA của riêng AE</li>
                </ul>
              </div>
            </div>
            <Callout kind="info" title="Ba vai trò trong sàn giao dịch">
              <strong>LR (Lead Researcher)</strong> tìm buyer nước ngoài → <strong>AI</strong> chấm
              điểm và đẩy cho AE phù hợp → <strong>AE</strong> giao tiếp với buyer và giới thiệu{" "}
              <strong>SR</strong> đã tuyển nhà cung cấp (client) lên hệ thống. AE là mắt xích duy
              nhất nói chuyện với cả hai phía.
            </Callout>
          </SopSection>

          {/* 2. Golden rules */}
          <SopSection id="golden-rules" icon={ShieldCheck} kicker="Bắt buộc nhớ" title="8 nguyên tắc vàng">
            <DoDont
              dos={[
                <>Nhận buyer qua nút <strong>Nhận (Claim)</strong> trong inbox; làm đúng thứ tự stage, mỗi lần chuyển stage là một dấu vết hệ thống lưu lại.</>,
                <>Dùng <strong>email công vụ cá nhân</strong> (tên@veximtrade.com) cho mọi email gửi buyer — hệ thống tự cấp, không cần xin IT.</>,
                "Ghi đầy đủ 6 trường nhu cầu của buyer trước khi dựng shortlist — đây là dữ liệu đầu vào cho AI chấm supplier.",
                "Gửi shortlist 1–3 nhà cung cấp, luôn để buyer tự bấm phản hồi trên link token để hệ thống tính giờ và thông báo tự động.",
                "Khi buyer xin mẫu / muốn họp / muốn bàn đơn: phản hồi nhanh và chủ động liên hệ supplier — đây là tín hiệu có thời hạn.",
                "Cập nhật next_step trên kanban mỗi khi có tiến triển; gắn client_action_required + hạn khi cần nhà cung cấp làm gì.",
                "Mọi ngoại lệ (chuyển buyer cho AE khác, trả về hộp chung) đều bắt buộc nhập lý do.",
              ]}
              donts={[
                "Tự tạo/gán buyer cho mình, hay nhận hộ đồng nghiệp — phân bổ do AI và admin/super_admin quyết định.",
                <>Hé lộ tên/thông tin buyer cho supplier <strong>trước khi cơ hội đạt giai đoạn “Đã chốt giá”</strong> (price_agreed) — vi phạm quy tắc ẩn danh R-07.</>,
                "Gửi danh sách supplier qua email/Zalo riêng bên ngoài link shortlist — sẽ mất snapshot bất biến và mất tín hiệu phản hồi.",
                "Xem/sửa giá vốn (cost_price): AE bị chặn quyền theo R-06; chỉ thao tác giá bán & số lượng.",
                "Xóa hay tự ý sửa điểm AI, sửa shortlist đã gửi (status = sent) — phải tạo phiên bản mới.",
                "Bỏ trống lý do khi drop/transfer/return, hoặc đóng engagement khi chưa ghi nhận kết quả thật.",
                "Để engagement quá 14 ngày không nhúc nhích — hệ thống sẽ coi là tồn đọng và nhắc nhở.",
              ]}
            />
          </SopSection>

          {/* 3. Big picture */}
          <SopSection id="big-picture" icon={Route} kicker="Sơ đồ" title="Toàn cảnh hành trình một buyer">
            <p>Có <strong>hai đường ống nối tiếp nhau</strong>: engagement (tiền-kanban, ẩn danh) và opportunities (kanban, lộ danh tính dần).</p>

            <SubHeading>Đường ống A — Engagement: AI matching → buyer chọn supplier</SubHeading>
            <Flow>
              <FlowNode tone="slate" title="AI đẩy inbox" sub="HSD 7 ngày · điểm 6 nhân tố" badge="B1" icon={Bot} />
              <FlowNode tone="blue" title="Claim" sub="Hết hạn bản copy của AE khác" icon={UserCheck} />
              <FlowNode tone="blue" title="Email hỏi nhu cầu" sub="AI soạn, AE gửi" badge="B2" icon={MailPlus} />
              <FlowNode tone="indigo" title="Ghi nhận nhu cầu" sub="6 trường" badge="B3" icon={ClipboardList} />
              <FlowNode tone="violet" title="Dựng shortlist" sub="1–3 supplier · AI chấm" badge="B4" icon={Wand2} />
              <FlowNode tone="amber" title="Gửi link token" sub="HSD 30 ngày" badge="B5" icon={Send} />
              <FlowNode tone="amber" title="Buyer xem / phản hồi" sub="Xin mẫu · họp · bàn đơn" icon={Eye} />
              <FlowNode tone="teal" title="Convert" sub="Tạo cơ hội ở cột ‘Yêu cầu mẫu’" badge="B6" icon={GitMerge} />
            </Flow>

            <SubHeading>Đường ống B — Kanban: cơ hội thương mại với từng supplier</SubHeading>
            <Flow>
              <FlowNode tone="violet" title="Yêu cầu mẫu" />
              <FlowNode tone="purple" title="Đã gửi mẫu" />
              <FlowNode tone="orange" title="Đàm phán" />
              <FlowNode tone="sky" title="Đã chốt giá" sub="Từ đây mới lộ tên buyer cho client" />
              <FlowNode tone="indigo" title="Đang sản xuất" />
              <FlowNode tone="teal" title="Đã giao hàng" />
              <FlowNode tone="emerald" title="Thành công (won)" />
            </Flow>

            <SubHeading>Ai làm gì — sơ đồ làn đường</SubHeading>
            <Swimlane
              lanes={[
                {
                  actor: "Hệ thống AI",
                  tone: "slate",
                  icon: Bot,
                  steps: [
                    { title: "Chấm điểm 6 nhân tố", sub: "mỗi đêm 06:00 (UTC+7)" },
                    { title: "Đẩy inbox + thông báo", sub: "priority cao/thấp" },
                    { title: "Chấm supplier cho shortlist", sub: "đóng băng điểm/snapshot" },
                    { title: "Phân loại reply", sub: "giá/mẫu/phản đối/chốt" },
                  ],
                },
                {
                  actor: "AE (bạn)",
                  tone: "teal",
                  icon: UserCheck,
                  steps: [
                    { title: "Claim" },
                    { title: "Hỏi & ghi nhu cầu" },
                    { title: "Duyệt & gửi shortlist" },
                    { title: "Convert / drop" },
                    { title: "Chạy kanban + chứng từ" },
                  ],
                },
                {
                  actor: "Buyer",
                  tone: "amber",
                  icon: Eye,
                  steps: [
                    { title: "Trả lời nhu cầu", sub: "email/WA/gặp" },
                    { title: "Mở link /shortlist" },
                    { title: "Bấm quan tâm", sub: "hỏi tin · xin mẫu · họp" },
                    { title: "Chọn supplier chính" },
                  ],
                },
                {
                  actor: "Supplier (client)",
                  tone: "indigo",
                  icon: Factory,
                  steps: [
                    { title: "Được báo ẩn danh", sub: "có người xin mẫu…" },
                    { title: "Chuẩn bị mẫu/báo giá", sub: "qua AE" },
                    { title: "Vào kanban sau convert" },
                    { title: "Nhận báo cáo tuần/tháng" },
                  ],
                },
              ]}
            />
            <Callout kind="tip" title="Mẹo đọc trang này">
              Mỗi giai đoạn B1–B9 dưới đây có: (1) điều kiện vào, (2) các bước bấm, (3) hệ thống tự
              động làm gì, (4) stage sau khi hoàn thành. Bấm tên màn hình trong ô{" "}
              <AppLink href="/admin/ae-inbox">như thế này</AppLink> để mở luôn.
            </Callout>
          </SopSection>

          {/* Phase 0 */}
          <SopSection id="phase0" icon={Coffee} kicker="B0 · Chuẩn bị" title="Chuẩn bị đầu ngày (5 phút)">
            <StepList>
              <Step n={1} title="Đảm bảo email công vụ đã sẵn sàng">
                Hệ thống tự cấp địa chỉ <span className="font-mono text-sm">tên@veximtrade.com</span> khi
                bạn gửi email đầu tiên (qua Resend, không cần hộp thư riêng). Mọi thư buyer trả lời
                được tự động bắt về engagement — đừng gửi từ Gmail cá nhân.
              </Step>
              <Step n={2} title="Mở chuông thông báo và (tùy chọn) liên kết Telegram">
                Vào <AppLink href="/settings/notifications">/settings/notifications</AppLink>, bật
                nhóm <Pill tone="amber">action_required</Pill> và <Pill tone="blue">status_update</Pill>.
                Telegram giúp nhận tin buyer phản hồi ngay trên điện thoại.
              </Step>
              <Step n={3} title="Đọc 3 hàng đợi">
                Chuông thông báo (buyer reply, email chưa khớp) → <AppLink href="/admin/ae-inbox">Buyer của tôi</AppLink> →
                tab <AppLink href="/admin/engagements">Đang xử lý</AppLink> ưu tiên thẻ có nhãn “quá
                hạn sắp tới” và “buyer đã phản hồi”.
              </Step>
              <Step n={4} title="Xử lý email chưa khớp nếu có">
                Thẻ tại <AppLink href="/admin/unmatched-emails">/admin/unmatched-emails</AppLink> là
                thư hệ thống chưa gắn được vào buyer/engagement nào — gắn đúng đối tượng rồi mới tiếp
                tục, để AI không bỏ sót tín hiệu.
              </Step>
            </StepList>
          </SopSection>

          {/* Phase 1 */}
          <SopSection id="phase1" icon={Inbox} kicker="B1 · Claim" title="Nhận buyer từ Inbox AI matching">
            <SubHeading>Buyer vào inbox như thế nào</SubHeading>
            <p>
              Mỗi đêm (cron 06:00 giờ VN), AI chấm từng buyer mới với từng AE theo{" "}
              <strong>6 nhân tố</strong>: độ khớp sản phẩm · ngành hàng · tuân thủ FDA của client ·
              tải công việc của AE · tỷ lệ thắng lịch sử · độ khớp quốc gia/thị trường. Điểm tổng
              0–100, cộng điểm ưu tiên (vd buyer có inquiry đang nóng). Điểm cao → priority{" "}
              <Pill tone="rose">high</Pill>, trung bình <Pill tone="amber">medium</Pill>, thấp{" "}
              <Pill tone="slate">low</Pill>.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { v: "7 ngày", l: "Hạn sống của mỗi đề xuất trong inbox — quá hạn tự hết quyền nhận." },
                { v: "12 / 15", l: "Cảnh cáo mềm / chặn cứng số engagement đang hoạt động của AE." },
                { v: "1 buyer", l: "Chỉ một AE đang xử lý tại một thời điểm (ràng buộc unique)." },
              ].map((x) => (
                <div key={x.v} className="rounded-xl border bg-card p-4 text-center">
                  <div className="text-2xl font-bold text-teal-600">{x.v}</div>
                  <div className="mt-1 text-xs leading-5 text-muted-foreground">{x.l}</div>
                </div>
              ))}
            </div>

            <SubHeading>Các bước</SubHeading>
            <StepList>
              <Step n={1} title="Mở tab Inbox tại /admin/ae-inbox và đọc điểm + lý do AI">
                Thẻ hiển thị tổng điểm, điểm chi tiết 6 nhân tố và thông tin buyer (sản phẩm chính,
                HS code, quốc gia, inquiry đang mở nếu có). Sắp xếp theo priority rồi đến thời gian.
              </Step>
              <Step n={2} title="Bấm “Nhận buyer (Claim)” nếu phù hợp với client bạn quản lý">
                Hệ thống tạo <code className="rounded bg-muted px-1.5 py-0.5 text-[12px]">buyer_engagements</code> ở
                stage <Pill tone="slate">claimed — chưa hỏi nhu cầu</Pill>, chấp nhận bản copy trong
                inbox của bạn và <strong>hết hạn toàn bộ bản copy của AE khác</strong> để tránh hai
                người cùng làm một buyer.
              </Step>
              <Step n={3} title="Nếu không hợp năng lực: để yên cho hết hạn, hoặc đề nghị chuyển">
                Không claim rồi bỏ đó. Nếu lỡ claim rồi mới nhận ra sai ngành, dùng nút{" "}
                <strong>Chuyển AE</strong> kèm lý do (xem mục <a href="#exceptions" className="text-teal-600 underline">Chuyển / Trả buyer</a>).
              </Step>
            </StepList>

            <Callout kind="warning" title="Gán tay bởi admin/super_admin">
              Admin có thể gán thẳng buyer cho AE bất kể điểm AI. Khi AE được chọn lệch ứng viên số 1
              từ <strong>15 điểm trở lên</strong>, admin bắt buộc nhập lý do; AE nhìn thấy nhãn{" "}
              <Pill tone="violet">assignment_source = manual</Pill> trên lịch sử. Vượt mốc 15
              engagement chỉ super_admin mới được gán đè.
            </Callout>
            <Callout kind="tip" title="Khi nào nên claim nhanh">
              Buyer có <code>has_active_inquiry</code> (đã gửi yêu cầu thật: sản phẩm, số lượng, giá
              mục tiêu, thời hạn) thường ở priority cao và đối thủ đang tiếp cận — ưu tiên claim
              trong ngày.
            </Callout>
          </SopSection>

          {/* Phase 2 */}
          <SopSection id="phase2" icon={MailPlus} kicker="B2 · Tiếp cận" title="Gửi email hỏi nhu cầu buyer">
            <Flow>
              <FlowNode tone="slate" title="claimed" sub="Chưa hỏi nhu cầu" />
              <FlowArrow label="gửi email" />
              <FlowNode tone="blue" title="requirement_email_sent" sub="Đang chờ buyer trả lời" />
              <FlowArrow label="buyer trả lời" />
              <FlowNode tone="indigo" title="requirements_received" />
            </Flow>
            <StepList>
              <Step n={1} title="Mở engagement, bấm “Soạn email hỏi nhu cầu”">
                AI sinh sẵn thư dựa trên sản phẩm/HS code/quốc gia của buyer. Bạn có thể dùng nút{" "}
                <strong>Tạo lại</strong>, chỉnh giọng văn, rồi gửi bằng email công vụ. Hỏi đúng bộ
                thông tin phục vụ shortlist: sản phẩm &amp; đặc tả, số lượng/MOQ, giá mục tiêu, điều
                khoản thanh toán, đóng gói/nhãn mác, thời gian cần hàng.
              </Step>
              <Step n={2} title="Hệ thống chuyển stage và khởi động đồng hồ SLA">
                Stage lên <Pill tone="blue">requirement_email_sent</Pill>, thư được lưu làm draft/nhật
                ký. Sau 14 ngày không chuyển stage và buyer không hồi âm, cron tồn đọng sẽ nhắc bạn
                và cấp trên.
              </Step>
              <Step n={3} title="Buyer im lặng: bấm “Gửi follow-up”">
                Nút follow-up sinh thư nhắc và <strong>reset đồng hồ tồn đọng</strong> — đừng lạm dụng;
                nên đổi góc tiếp cận (báo giá thị trường, chứng chỉ sẵn có, nhà máy thực tế).
              </Step>
              <Step n={4} title="Buyer trả lời ở kênh khác (WhatsApp/gặp/điện thoại)">
                Mở engagement chọn kênh tiếp xúc (bắt buộc nếu ngoài email) rồi dán nội dung/tóm tắt
                vào bước ghi nhận nhu cầu. Hệ thống vẫn tính tiến độ cho bạn.
              </Step>
            </StepList>
            <Callout kind="info" title="Thư buyer trả lời được AI xử lý thế nào">
              Mọi hồi âm qua email đi qua webhook Resend: AI gắn vào đúng engagement và gắn nhãn ý
              định <Pill tone="amber">Hỏi giá</Pill> <Pill tone="blue">Xin mẫu</Pill>{" "}
              <Pill tone="rose">Phản đối</Pill> <Pill tone="emerald">Dấu hiệu chốt</Pill>. Thư gắn
              sai sẽ nằm ở <AppLink href="/admin/unmatched-emails">Email chưa khớp</AppLink> để bạn
              nối lại thủ công.
            </Callout>
          </SopSection>

          {/* Phase 3 */}
          <SopSection id="phase3" icon={ClipboardList} kicker="B3 · Đầu vào shortlist" title="Ghi nhận nhu cầu buyer">
            <p>Điền form <strong>“Ghi nhận nhu cầu buyer”</strong> gồm 6 trường — đây là snapshot để AI chấm supplier và sẽ tự động chuyển vào ghi chú cơ hội sau này:</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                ["Sản phẩm yêu cầu", "Tên hàng, đặc tả, quy cách"],
                ["Khoảng giá mục tiêu", "USD/kg, FOB/CIF…"],
                ["MOQ", "Số lượng tối thiểu/chuyến"],
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
            <p>Lưu xong stage lên <Pill tone="indigo">requirements_received</Pill> và nút “Dựng shortlist (AI)” được mở khóa.</p>
            <Callout kind="warning" title="Thiếu thông tin thì đừng vượt bước">
              Nếu buyer mới cho ý chung chung (“cần cà phê giá tốt”), hãy hỏi tiếp 1–2 lượt để có ít
              nhất sản phẩm + số lượng/giá. Shortlist dựng trên nhu cầu mờ sẽ ra supplier sai, mất
              uy tín khi buyer mở link.
            </Callout>
          </SopSection>

          {/* Phase 4 */}
          <SopSection id="phase4" icon={Wand2} kicker="B4 · AI chấm supplier" title="Dựng shortlist nhà cung cấp">
            <StepList>
              <Step n={1} title="Bấm “Dựng shortlist” trên engagement">
                AI đối chiếu nhu cầu buyer với toàn bộ client đã có hồ sơ công khai (sản phẩm, HS
                code, ngành, chứng chỉ FDA/COA, năng lực, giá) và đề xuất danh sách theo điểm.
              </Step>
              <Step n={2} title="Chọn từ 1 đến 3 nhà cung cấp">
                Đây là giới hạn cứng của hệ thống (<code>shortlist_must_have_1_to_3_clients</code>):
                buyer không nên thấy quá 3 lựa chọn. Ưu tiên điểm cao, đa dạng phân khúc giá; kiểm
                tra chứng từ còn hạn và năng lực khớp MOQ.
              </Step>
              <Step n={3} title="Đọc lý do AI và rủi ro còn lại trước khi lưu">
                Mỗi supplier có điểm chi tiết, lý do ghép cặp và “remaining risks” (vd: chưa có FDA
                cho thị trường này). Bạn chịu trách nhiệm quyết định cuối — có thể bỏ ứng viên AI đề
                xuất và chọn người khác.
              </Step>
              <Step n={4} title="Lưu bản nháp (draft)">
                Hệ thống tạo <strong>phiên bản (version)</strong> dạng draft và đóng băng: điểm, yếu
                tố, lý do, rủi ro, và bản chụp hồ sơ nhà cung cấp tại thời điểm đó. Sau này nhà cung
                cấp có sửa hồ sơ thì thứ buyer đã xem cũng không đổi.
              </Step>
            </StepList>
            <Callout kind="danger" title="Bất biến sau khi gửi">
              Phiên bản đã <code>sent</code> không sửa được (mọi nút lưu sẽ trả{" "}
              <code>version_not_a_draft</code>). Muốn thay đổi danh sách? Tạo{" "}
              <strong>phiên bản mới</strong> — phiên bản cũ tự chuyển trạng thái “superseded”, link
              cũ của buyer vẫn mở đúng snapshot cũ.
            </Callout>
          </SopSection>

          {/* Phase 5 */}
          <SopSection id="phase5" icon={Send} kicker="B5 · Buyer phản hồi" title="Duyệt, gửi link & theo dõi phản hồi">
            <StepList>
              <Step n={1} title="Bấm “Duyệt & gửi shortlist”">
                Hệ thống tạo link công khai dạng <span className="font-mono text-xs">/shortlist/&lt;token&gt;</span> (hết hạn sau{" "}
                <strong>30 ngày</strong>, có thể thu hồi), stage lên{" "}
                <Pill tone="amber">shortlist_sent</Pill>. Gửi link cho buyer bằng email công vụ (hoặc
                kênh đang trao đổi), kèm thời hạn phản hồi.
              </Step>
              <Step n={2} title="Theo dõi tín hiệu trên engagement">
                Buyer mở link → <Pill tone="amber">buyer_viewed</Pill> (hệ thống còn ghi thời gian
                dừng ở mỗi thẻ nhà cung cấp). Bấm phản hồi → <Pill tone="emerald">buyer_responded /
                qualified_interest</Pill>. Bạn nhận thông báo tức thì (chuông/email/Telegram).
              </Step>
              <Step n={3} title="Đọc đúng 5 nút buyer được bấm">
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Pill tone="slate">Quan tâm (chưa chi tiết)</Pill>
                  <Pill tone="blue">Hỏi thêm thông tin</Pill>
                  <Pill tone="blue">Xin mẫu</Pill>
                  <Pill tone="violet">Muốn họp</Pill>
                  <Pill tone="emerald">Muốn trao đổi đặt hàng</Pill>
                </div>
              </Step>
              <Step n={4} title="Hành động theo từng tín hiệu">
                <strong>Xin mẫu</strong>: liên hệ supplier chuẩn bị mẫu + chi phí/gửi; <strong>Muốn
                họp</strong>: chốt lịch kéo supplier vào; <strong>Muốn bàn đơn</strong>: đây là tín
                hiệu đủ điều kiện convert; <strong>Hỏi thông tin</strong>: trả lời trong vòng 24h và
                bổ sung tài liệu.
              </Step>
            </StepList>
            <Callout kind="tip" title="Vì sao supplier nhận thông báo nhưng không biết buyer là ai">
              Khi buyer bấm <em>xin mẫu / họp / bàn đơn</em>, hệ thống gửi nhà cung cấp một thông báo{" "}
              <strong>ẩn danh</strong> (“Một buyer muốn nhận mẫu…”) và gửi bạn thông báo đầy đủ. Bạn
              là người kiểm soát thời điểm lộ danh tính — không chủ động gửi tên/email buyer cho
              supplier trước khi convert và đạt price_agreed.
            </Callout>
            <Callout kind="info" title="Các trạng thái nội bộ AE tự ghi">
              <Pill tone="emerald">Chọn làm supplier chính</Pill>, <Pill tone="teal">Đã gửi giá/số
              lượng</Pill>, <Pill tone="teal">Đã gửi PO</Pill> là các nhãn AE ghi khi việc thật sự
              xảy ra — buyer không có nút bấm các giá trị này trên trang công khai.
            </Callout>
          </SopSection>

          {/* Phase 6 */}
          <SopSection id="phase6" icon={GitMerge} kicker="B6 · Ngã ba quyết định" title="Convert, gửi lại, hay dừng engagement">
            <Decision
              question="Buyer đã chọn / có tín hiệu đủ mạnh để vào đàm phán?"
              yes={
                <Flow>
                  <FlowNode tone="emerald" title="Convert" sub="Chọn ≥1 supplier CHÍNH + tối đa 2 dự phòng" icon={GitMerge} />
                </Flow>
              }
              no={
                <Flow>
                  <FlowNode tone="violet" title="Tạo version mới" sub="Đổi/bổ sung supplier rồi gửi lại" />
                  <FlowNode tone="rose" title="Drop" sub="Bắt buộc ghi lý do" />
                </Flow>
              }
            />
            <SubHeading>Khi convert: AE làm gì, hệ thống làm gì</SubHeading>
            <StepList>
              <Step n={1} title="Chọn supplier chính (primary) — bắt buộc đúng một">
                Có thể thêm tối đa 2 supplier dự phòng (backup). Thiếu primary sẽ bị chặn với{" "}
                <code>primary_supplier_required</code>.
              </Step>
              <Step n={2} title="Nhập giá trị tiềm năng (nếu có)">
                Lấy theo supplier chính; cập nhật lại sau trên kanban khi chốt giá thật.
              </Step>
              <Step n={3} title="Hệ thống tạo cơ hội cho từng supplier">
                Mỗi nhà được chọn có một <code>opportunity</code> xuất hiện trên kanban ở cột{" "}
                <Pill tone="violet">Yêu cầu mẫu (sample_requested)</Pill>; toàn bộ 6 trường nhu cầu
                được chép vào <strong>ghi chú cơ hội</strong>; engagement chuyển{" "}
                <Pill tone="teal">converted</Pill> và ẩn khỏi hàng đợi; activity{" "}
                <code>engagement_converted</code> được ghi lại.
              </Step>
            </StepList>
            <Callout kind="warning" title="Giới hạn 30 cơ hội đang chạy / nhà cung cấp">
              Một client không thể có quá 30 cơ hội chưa won/lost (<code>client_at_capacity</code>).
              Nếu supplier được chọn đã đầy, phối hợp admin đóng bớt cơ hội cũ trước khi convert.
            </Callout>
            <Callout kind="danger" title="Khi drop">
              Chỉ dùng <strong>Drop</strong> khi buyer rõ ràng không mua (từ chối, mất liên lạc sau
              nhiều follow-up, sai phân khúc). Bắt buộc nhập lý do — dữ liệu này dùng để phân tích
              chất lượng matching và đào tạo lại scorer. Sau khi converted/dropped, engagement khóa
              lại, không chuyển tiếp được nữa.
            </Callout>
          </SopSection>

          {/* Phase 7 */}
          <SopSection id="phase7" icon={Kanban} kicker="B7 · Cơ hội" title="Vận hành kanban sau convert">
            <SubHeading>10 giai đoạn và quy tắc lộ danh tính</SubHeading>
            <div className="overflow-x-auto rounded-xl border p-3">
              <div className="flex min-w-[860px] flex-col gap-2">
                <div className="flex gap-1.5">
                  {[
                    ["Mới", "slate"], ["Đã liên hệ", "amber"], ["Yêu cầu mẫu", "violet"], ["Đã gửi mẫu", "violet"],
                    ["Đàm phán", "amber"], ["Đã chốt giá", "sky"], ["Đang sản xuất", "indigo"],
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
                  Supplier chỉ thấy MÃ buyer (vd BYR-2026-0142) ở các cột trước “Đã chốt giá”. Từ
                  price_agreed trở đi (chốt giá / sản xuất / giao hàng / won) tên thật mới hiện — quy
                  tắc ẩn danh R-07 áp dụng cho cả báo cáo tuần, PDF và email.
                </div>
              </div>
            </div>

            <SubHeading>Hai loại cập nhật gửi về client</SubHeading>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border bg-card p-4">
                <div className="mb-1 flex items-center gap-2 font-semibold text-blue-600">
                  <TimerReset className="h-4 w-4" /> next_step — “bên Vexim đang làm gì”
                </div>
                <p className="text-sm text-muted-foreground">
                  Cập nhật mỗi khi bạn hành động (đang lấy mẫu, đang xác nhận lịch sản xuất…).
                  Client nhận thông báo <Pill tone="blue">status_update</Pill> “Cập nhật tiến độ”.
                </p>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="mb-1 flex items-center gap-2 font-semibold text-rose-600">
                  <Bell className="h-4 w-4" /> client_action_required — “cần nhà cung cấp làm”
                </div>
                <p className="text-sm text-muted-foreground">
                  Ghi việc cần client xử lý + <strong>hạn chót</strong> (gửi mẫu, duyệt PI, đặt cọc,
                  cấp hồ sơ…). Client nhận thông báo <Pill tone="rose">action_required</Pill> “Cần
                  bạn xử lý” và SLA được tính dựa trên hạn này.
                </p>
              </div>
            </div>
            <Callout kind="tip" title="Mẹo giữ điểm SLA và sự an tâm của client">
              Cứ có chuyển động thật là cập nhật <code>next_step</code> trong cùng ngày, kể cả khi
              chưa có kết quả cuối. Client tự nhận thông báo, AE không phải nhắn tay, và cron đánh
              giá SLA cuối tháng sẽ ghi nhận bạn phản hồi đúng hạn.
            </Callout>
          </SopSection>

          {/* Phase 8 */}
          <SopSection id="phase8" icon={FileCheck2} kicker="B8 · Tuân thủ" title="Chứng từ & kiểm soát giao dịch">
            <p>
              Trên thẻ cơ hội, AE có quyền tải lên chứng từ thương mại (hợp đồng/PI, PO, packing
              list, BL…) và cập nhật khối tuân thủ. Chứng từ pháp lý chỉ nhận <strong>file tải
              lên</strong>, không dán link ngoài.
            </p>
            <Flow>
              <FlowNode tone="violet" title="PI / Báo giá" sub="client duyệt, chốt giá" />
              <FlowNode tone="indigo" title="PO" sub="đặt cọc theo điều khoản" />
              <FlowNode tone="indigo" title="Xác minh LC" sub="người thứ hai kiểm tra" />
              <FlowNode tone="teal" title="SWIFT chuyển tiền" sub="tách biệt trách nhiệm" />
              <FlowNode tone="teal" title="Sản xuất · BL · Giao hàng" />
            </Flow>
            <Callout kind="danger" title="Nguyên tắc tách biệt SWIFT (segregation of duties)">
              Người soạn/lệnh thanh toán không được tự xác minh SWIFT — một người thứ hai được phân
              quyền mới được bấm xác minh. Không dùng chung tài khoản để vượt kiểm soát này.
            </Callout>
            <Callout kind="warning" title="Hồ sơ hết hạn là việc của mọi người">
              Cron quét hằng ngày cảnh báo FDA (trước hạn 90 ngày) và các chứng chỉ khác (30/7 ngày)
              cho cả client lẫn nội bộ. Nếu cơ hội đang chạy mà chứng chỉ sắp hết hạn, bạn là người
              thúc supplier gia hạn sớm — đừng để kẹt lúc giao hàng.
            </Callout>
          </SopSection>

          {/* Phase 9 */}
          <SopSection id="phase9" icon={Handshake} kicker="B9 · Kết thúc" title="Chốt đơn và chăm sóc sau won">
            <StepList>
              <Step n={1} title="Kéo thẻ sang won / lost và để lại lý do">
                Client nhận thông báo <Pill tone="emerald">deal_closed</Pill> “Thương vụ thành công/kết
                thúc”; AE phụ trách cũng được ghi nhận cho KPI. Sau won/lost chủ sở hữu cơ hội bị{" "}
                <strong>khóa</strong> — không thể chuyển buyer đã chốt cho người khác.
              </Step>
              <Step n={2} title="Phí success fee & hóa đơn chạy tự động">
                Cron đối chiếu deal won để tạo khoản success fee; finance phát hành hóa đơn (retainer
                tháng, success fee, nhắc thu quá hạn) — AE chỉ cần đảm bảo giá trị/số liệu trên cơ
                hội là đúng.
              </Step>
              <Step n={3} title="Đơn lặp lại sau 90 ngày">
                Hệ thống tự nhắc client (và AE thấy trên activity) khi đã 90 ngày kể từ won để chào
                đơn tiếp theo. AE chủ động soạn email check-in trước thời điểm đó càng tốt.
              </Step>
              <Step n={4} title="Cơ hội lost được lưu trữ tự động">
                Cron archive dọn các thẻ lost; dữ liệu vẫn dùng cho phân tích nguyên nhân thua theo
                quốc gia/ngành trên <AppLink href="/admin/analytics">/admin/analytics</AppLink>.
              </Step>
            </StepList>
          </SopSection>

          {/* Exceptions */}
          <SopSection id="exceptions" icon={ArrowRightLeft} kicker="Ngoại lệ" title="Chuyển buyer, trả về hộp chung">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-2 font-semibold">
                  <ArrowRightLeft className="h-4 w-4 text-blue-600" /> Chuyển cho AE khác
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Dùng khi buyer thực ra thuộc ngành/thị trường AE khác. Chọn AE đích (hệ thống hiện
                  số engagement đang gánh để tránh dồn việc), <strong>bắt buộc lý do</strong>. Hệ
                  thống kiểm tra tải 12/15, đổi chủ engagement, reset đồng hồ SLA, báo cho cả hai AE.
                </p>
              </div>
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-2 font-semibold">
                  <Undo2 className="h-4 w-4 text-amber-600" /> Trả về hộp thư chung
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Khi bạn không thể tiếp tục phục vụ buyer: bấm “Trả về inbox” kèm lý do. Engagement
                  được đóng, buyer xuất hiện lại trong inbox của tất cả AE bán hàng trong 7 ngày để
                  người khác nhận; điểm gán tay được nhả ra.
                </p>
              </div>
            </div>
            <Callout kind="info" title="Admin gán buyer trực tiếp">
              Trường hợp cấp thiết, admin/super_admin dùng “Gán cho AE…” trên trang Buyer, chi tiết
              buyer hoặc thẻ inbox. AE được gán nhận thông báo <Pill tone="violet">new_assignment</Pill>;
              các guardrail về điểm lệch ≥15 và tải 12/15 vẫn áp dụng như mục B1.
            </Callout>
          </SopSection>

          {/* Thresholds */}
          <SopSection id="thresholds" icon={Gauge} kicker="Tra cứu nhanh" title="Bảng ngưỡng & quy tắc hệ thống">
            <RuleTable
              rows={[
                { rule: "Hạn sống đề xuất trong AE inbox", value: "7 ngày", note: "Quá hạn bản copy hết hiệu lực, buyer có thể được matching lại." },
                { rule: "Số nhà cung cấp tối đa trên 1 shortlist", value: "1–3", note: "Lỗi shortlist_must_have_1_to_3_clients nếu ngoài khoảng." },
                { rule: "Hạn sống link shortlist gửi buyer", value: "30 ngày", note: "Có thể thu hồi (revoke); tạo phiên bản mới khi cần gửi lại." },
                { rule: "Engagement tồn đọng (stale)", value: "14 ngày", note: "Không chuyển stage và buyer không hồi âm → nhắc AE/quản lý." },
                { rule: "Tải AE — cảnh báo mềm", value: "12 engagement", note: "Hiển thị vàng khi admin gán buyer." },
                { rule: "Tải AE — chặn cứng", value: "15 engagement", note: "Chỉ super_admin được gán đè." },
                { rule: "Số client (nhà cung cấp) mỗi AE quản lý", value: "7", note: "Khác hẳn tải engagement — là số hồ sơ client gắn account_manager_id." },
                { rule: "Số cơ hội đang chạy trên 1 client", value: "30", note: "MAX_ACTIVE_BUYERS_PER_CLIENT, không tính won/lost." },
                { rule: "Lý do bắt buộc khi gán lệch AI", value: "≥ 15 điểm", note: "Hoặc AE đích chưa được AI chấm điểm." },
                { rule: "Ngưỡng lộ tên buyer cho client (R-07)", value: "price_agreed", note: "Trước đó chỉ hiện mã buyer trên mọi báo cáo/email/PDF." },
                { rule: "Báo cáo tuần cho client", value: "T2 09:00 UTC", note: "16:00 giờ VN, gồm cả khối giới thiệu ẩn danh." },
              ]}
            />
          </SopSection>

          {/* Client visibility */}
          <SopSection id="client-visibility" icon={Eye} kicker="Hệ quả" title="Mỗi thao tác của AE, client nhìn thấy gì">
            <p>Hiểu bảng này để biết khi nào cần cập nhật và khi nào không nên hứa trước hệ thống:</p>
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left">
                  <tr>
                    <th className="px-4 py-2.5">Sự kiện bạn tạo</th>
                    <th className="px-4 py-2.5">Client nhận</th>
                    <th className="px-4 py-2.5">Danh tính buyer</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[
                    ["Gửi shortlist có client", "Đếm ‘được giới thiệu cho buyer’ ở báo cáo tuần/tháng", "Ẩn danh"],
                    ["Buyer mở link xem hồ sơ", "Đếm ‘buyer đã xem hồ sơ’", "Ẩn danh"],
                    ["Buyer bấm xin mẫu / họp / bàn đơn", "Thông báo tức thì ‘một buyer muốn…’ + đếm báo cáo", "Ẩn danh"],
                    ["Convert sang cơ hội", "Cơ hội xuất hiện trên /client/leads (cột Yêu cầu mẫu)", "Chỉ thấy mã buyer"],
                    ["Bạn cập nhật next_step", "Chuông + email ‘Cập nhật tiến độ’", "Mã buyer"],
                    ["Gắn client_action_required", "Chuông + email ‘Cần bạn xử lý’ kèm hạn chót", "Mã buyer"],
                    ["Kéo stage qua Đã chốt giá", "Tên thật của buyer bắt đầu hiện", "Tên thật"],
                    ["Won / lost", "Thông báo ‘Thương vụ thành công/kết thúc’", "Tên thật"],
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
            <Callout kind="tip" title="Báo cáo client là ‘gương phản chiếu’ công việc của bạn">
              Tuần không có cơ hội mới nhưng bạn gửi được shortlist, client vẫn nhận báo cáo có số
              liệu giới thiệu — vì vậy đếm đúng mọi hành động trên hệ thống sẽ trực tiếp tạo dựng sự
              tin tưởng với nhà cung cấp.
            </Callout>
          </SopSection>

          {/* Checklist */}
          <SopSection id="checklist" icon={CalendarCheck} kicker="Thói quen" title="Checklist ngày & tuần">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border bg-card p-5">
                <div className="mb-3 font-semibold">Mỗi ngày làm việc</div>
                <ul className="space-y-2 text-sm">
                  {[
                    "Đọc chuông + xử lý email chưa khớp.",
                    "Claim buyer priority high trong inbox.",
                    "Trả lời mọi buyer đã phản hồi (mục tiêu trong 24h).",
                    "Cập nhật next_step cho cơ hội có chuyển động.",
                    "Xử lý client_action_required sắp hạn.",
                    "Gửi follow-up cho engagement tới mốc 14 ngày.",
                  ].map((x) => (
                    <Check key={x}>{x}</Check>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border bg-card p-5">
                <div className="mb-3 font-semibold">Mỗi thứ Hai</div>
                <ul className="space-y-2 text-sm">
                  {[
                    "Rà tab Đang xử lý: engagement nào đứng stage quá lâu.",
                    "Shortlist gửi sau 7–10 ngày buyer không phản hồi → tạo version mới hoặc drop có lý do.",
                    "Đối chiếu KPI tuần trước trên /admin/my-kpi.",
                    "Kiểm tra chứng từ sắp hết hạn của client đang giao dịch.",
                    "Chuẩn bị mẫu/lịch họp mà buyer đã yêu cầu tuần trước.",
                  ].map((x) => (
                    <Check key={x}>{x}</Check>
                  ))}
                </ul>
              </div>
            </div>
          </SopSection>

          {/* Errors */}
          <SopSection id="errors" icon={CircleAlert} kicker="Bảng tra" title="Lỗi thường gặp & cách xử lý">
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left">
                  <tr>
                    <th className="px-4 py-2.5 font-mono text-xs">Mã lỗi</th>
                    <th className="px-4 py-2.5">Ý nghĩa</th>
                    <th className="px-4 py-2.5">Cách xử lý</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[
                    ["inbox_item_not_found / inbox_item_already_processed", "Đề xuất không còn hoặc đã được nhận/hết hạn", "Tải lại trang; buyer đã thuộc về AE khác hoặc hết hạn chờ matching lại."],
                    ["not_your_inbox_item / not_your_engagement", "Bạn không phải chủ sở hữu", "Chỉ chủ engagement mới thao tác; cần làm thì xin chuyển qua admin."],
                    ["shortlist_must_have_1_to_3_clients", "Shortlist ngoài khoảng 1–3 nhà", "Bỏ bớt hoặc thêm cho đủ từ 1 đến 3 supplier."],
                    ["version_not_a_draft", "Phiên bản đã gửi, không sửa được", "Tạo phiên bản mới thay vì sửa bản cũ."],
                    ["shortlist_empty", "Phiên bản không còn nhà cung cấp hợp lệ", "Mở lại bản nháp, chọn lại supplier."],
                    ["primary_supplier_required / no_clients_selected", "Convert thiếu nhà cung cấp chính", "Đánh dấu đúng một primary trước khi convert."],
                    ["client_at_capacity", "Supplier đã có 30 cơ hội đang chạy", "Phối hợp đóng bớt cơ hội cũ với admin rồi convert lại."],
                    ["ae_at_capacity", "AE đích đã có 15 engagement", "Chọn AE khác hoặc nhờ super_admin gán đè."],
                    ["engagement_already_closed", "Engagement đã converted/dropped", "Mọi chỉnh sửa tiếp theo thực hiện trên cơ hội (kanban)."],
                    ["reason_required", "Thiếu lý do chuyển/trả/gán", "Nhập lý do rõ ràng — trường này bắt buộc và được lưu audit."],
                    ["forbidden", "Tài khoản không có quyền", "LR/SR không claim hay convert; liên hệ admin nếu cần phân quyền."],
                  ].map((r, i) => (
                    <tr key={i} className={i % 2 ? "bg-muted/30" : "bg-card"}>
                      <td className="px-4 py-2.5 align-top font-mono text-[12px]">{r[0]}</td>
                      <td className="px-4 py-2.5 align-top">{r[1]}</td>
                      <td className="px-4 py-2.5 align-top text-muted-foreground">{r[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Callout kind="info" title="Gặp lỗi không có trong bảng">
              Chụp màn hình mã lỗi và engagement, gửi cho quản lý trực tiếp hoặc nhóm vận hành. Đừng
              thử lại nhiều lần với thao tác ghi (gửi/convert) vì mỗi lần thử đều tạo dấu vết.
            </Callout>
          </SopSection>

          {/* KPI */}
          <SopSection id="kpi" icon={BarChart3} kicker="Đo lường" title="KPI của AE">
            <p>Tại <AppLink href="/admin/my-kpi">/admin/my-kpi</AppLink>, chọn kỳ (tuần/tháng/quý) để xem:</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Win rate", "Tỷ lệ won trên tổng quyết định, so với trung bình team"],
                ["Doanh thu tháng & tăng trưởng", "Tổng giá trị deal won trong kỳ"],
                ["Số deal won / lost / đang chạy", "Phân loại trạng thái cơ hội trong kỳ"],
                ["Xếp hạng team", "Hạng theo hiệu suất; top 1–2 có huy hiệu"],
              ].map(([a, b]) => (
                <div key={a} className="rounded-xl border bg-card p-4">
                  <div className="font-semibold">{a}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{b}</div>
                </div>
              ))}
            </div>
            <p className="text-muted-foreground">
              Cải thiện bền vững nhất đến từ: phản hồi buyer nhanh, shortlist bám sát nhu cầu (tỉ lệ
              convert cao), và cập nhật kanban đầy đủ để hạn chế deal bị lost do chờ đợi.
            </p>
            <div className="mt-6 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              <BookOpen className="mr-1 inline h-4 w-4" />
              Tài liệu LR (tìm &amp; làm giàu buyer) và SR (tuyển nhà cung cấp) đang được biên soạn
              tại <Link href="/admin/knowledge" className="text-teal-600 underline">Trung tâm kiến thức</Link>.
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
