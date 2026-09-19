import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Database,
  Factory,
  Globe2,
  Handshake,
  LayoutDashboard,
  Mail,
  Menu,
  Search,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { landingPathForRole, normaliseRole } from "@/lib/auth/permissions"
import { getLocale } from "@/lib/i18n/server"
import { LanguageSwitcher } from "@/components/i18n/language-switcher"
import { ConsultationForm } from "@/components/landing/consultation-form"
import { Button } from "@/components/ui/button"
import { siteConfig } from "@/lib/site-config"

const content = {
  vi: {
    nav: ["Vấn đề", "Giải pháp", "Quy trình", "FAQ"],
    signIn: "Đăng nhập",
    contact: "Đăng ký tư vấn",
    eyebrow: "DỊCH VỤ PHÒNG SALE XUẤT KHẨU",
    heroTitle: "Có sản phẩm tốt nhưng chưa có một đội ngũ sale đủ mạnh để tiếp cận buyer quốc tế?",
    heroText:
      "Vexim trở thành phòng sale xuất khẩu thuê ngoài, đại diện cho Supplier tiếp cận và kết nối trực tiếp với buyer tại thị trường Mỹ dựa trên dữ liệu hải quan thực tế và đội ngũ chuyên gia tại Hoa Kỳ.",
    heroCta: "Đăng ký tư vấn 1:1",
    heroSecondary: "Xem 8 bước quy trình",
    heroNote: "Chi phí vận hành tương đương một nhân sự văn phòng — nhưng Supplier có cả một hệ thống phía sau.",
    statOne: "Dữ liệu Bill of Lading thực",
    statTwo: "Tiêu chí sàng lọc buyer",
    statThree: "Báo cáo tiến độ",
    statFour: "Chuyên gia tại Mỹ",
    painEyebrow: "THỰC TRẠNG SUPPLIER",
    painTitle: "Sản phẩm tốt vẫn có thể bị mắc kẹt trước cánh cửa xuất khẩu.",
    painText: "Những nút thắt lớn nhất khiến nhà sản xuất Việt Nam loay hoay khi muốn tiếp cận thị trường quốc tế.",
    painPoints: [
      ["Không biết cách tiếp cận đúng buyer", "Thiếu kênh liên hệ trực tiếp với người ra quyết định tại các chuỗi bán lẻ và nhà nhập khẩu quốc tế.", Users],
      ["Mua data nhưng không khai thác được", "Danh sách buyer trôi nổi không cho biết lịch sử nhập khẩu, nhu cầu hay thời điểm mua hàng thực tế.", Database],
      ["Chi phí hội chợ quá đắt đỏ", "Tốn ngân sách lớn cho triển lãm quốc tế nhưng khó đo lường hiệu quả và tỷ lệ chuyển đổi đơn hàng.", Building2],
      ["Bị động trên các sàn B2B", "Đăng sản phẩm rồi chờ buyer tìm đến giữa hàng triệu đối thủ cạnh tranh.", Globe2],
      ["Thường xuyên bị buyer ép giá", "Thiếu dữ liệu giá và bối cảnh thương thảo khiến biên lợi nhuận ngày càng mỏng.", CircleDollarSign],
      ["Gánh nặng xây sales nội bộ", "Tuyển dụng, trả lương ngoại tệ, đào tạo và quản lý một đội export sales riêng rất tốn kém.", AlertTriangle],
    ] as const,
    solutionEyebrow: "GIẢI PHÁP TOÀN DIỆN",
    solutionTitle: "Không chỉ cung cấp danh sách buyer — Vexim xây dựng một hệ thống bán hàng xuất khẩu.",
    solutionText: "Từ dữ liệu hải quan đến cuộc họp đàm phán, mọi hoạt động được chuẩn hóa, phân công và cập nhật minh bạch trên Vexim Trade.",
    solutions: [
      ["Buyer intelligence", "Phân tích dữ liệu Bill of Lading và tín hiệu nhập khẩu để chọn đúng buyer trước khi tiếp cận.", Search],
      ["Supplier readiness", "Chuẩn hóa hồ sơ, năng lực nhà máy, sản phẩm và tài liệu tuân thủ trước khi chào hàng.", Factory],
      ["Pipeline visibility", "Supplier theo dõi được buyer, phản hồi, báo giá, hồ sơ và bước tiếp theo trên một hệ thống duy nhất.", LayoutDashboard],
      ["U.S. compliance support", "Kết nối chuyên gia tuân thủ tại Mỹ để chuẩn bị FDA, MoCRA, nhãn mác và yêu cầu kỹ thuật.", ShieldCheck],
    ] as const,
    criteriaEyebrow: "7 TIÊU CHÍ SÀNG LỌC",
    criteriaTitle: "Tiếp cận ít hơn, nhưng đúng buyer hơn.",
    criteriaText: "Mỗi buyer được đánh giá trước dựa trên dữ liệu và mức độ phù hợp với năng lực thực tế của Supplier.",
    criteria: [
      ["Lịch sử nhập khẩu thực tế", "Đối soát Bill of Lading để xác thực buyer có đang nhập hàng từ Việt Nam hoặc châu Á hay không."],
      ["Sản phẩm & nhu cầu", "Xác định SKU, quy cách, dung tích và phân khúc giá buyer đang tìm nguồn thay thế."],
      ["Nhà cung cấp hiện tại", "Phân tích đối thủ để tìm lợi thế của Supplier về chất lượng, công suất hoặc giá."],
      ["Xu hướng tăng trưởng", "Đo lường tần suất nhập khẩu trong 12–24 tháng gần nhất để ưu tiên buyer đang tăng trưởng."],
      ["Thời điểm mua hàng", "Nắm bắt chu kỳ mua hàng, mùa vụ và thời điểm buyer chuẩn bị ký hợp đồng cho mùa mới."],
      ["Khả năng mở rộng", "Đánh giá quy mô phân phối và khả năng mở rộng dải sản phẩm của buyer."],
      ["Độ phù hợp với Supplier", "Đối chiếu MOQ, dung sai sản xuất, chứng chỉ và định hướng phát triển của hai bên."],
    ] as const,
    processEyebrow: "LỘ TRÌNH BÀI BẢN",
    processTitle: "8 bước từ phân tích dữ liệu đến ký kết cùng buyer.",
    process: [
      ["01", "Phân tích & lựa chọn buyer", "Xác định nhóm buyer phù hợp dựa trên dữ liệu nhập khẩu thực tế và tiềm năng phát triển."],
      ["02", "Chuẩn bị hồ sơ & sản phẩm", "Hoàn thiện thông tin doanh nghiệp, thông số, năng lực cung ứng và hồ sơ pháp lý."],
      ["03", "Xây dựng profile chuyên nghiệp", "Đưa Supplier và sản phẩm lên hệ thống Vexim Trade theo chuẩn B2B quốc tế."],
      ["04", "Tiếp cận & chào hàng", "Outreach chuyên nghiệp, giới thiệu năng lực và kết nối với người phụ trách mua hàng."],
      ["05", "Phát triển cơ hội", "Theo dõi phản hồi, nhu cầu, báo giá mục tiêu, Incoterms và yêu cầu kỹ thuật."],
      ["06", "Mẫu & đánh giá sản phẩm", "Chuẩn hóa đóng gói, gửi mẫu sang Mỹ và hỗ trợ quy trình đánh giá chất lượng."],
      ["07", "Meeting & đàm phán", "Kết nối Supplier với buyer trong các buổi meeting và đàm phán hợp đồng."],
      ["08", "Hỗ trợ đón buyer", "Đồng hành khi buyer quốc tế sang Việt Nam tham quan và thẩm định nhà máy."],
    ] as const,
    benefitEyebrow: "LỢI THẾ BỀN VỮNG",
    benefitTitle: "Supplier tập trung vào sản phẩm. Vexim vận hành kênh xuất khẩu.",
    benefits: ["Tiếp cận trực tiếp nhà nhập khẩu Mỹ", "Không phải tự xây và quản lý bộ máy sales", "Tập trung vào sản phẩm, giá bán và công suất", "Mở rộng mạng lưới buyer quốc tế", "Tăng nhận diện thương hiệu tại thị trường Mỹ", "Định vị nhà cung cấp chuyên nghiệp, uy tín"],
    faqEyebrow: "GIẢI ĐÁP THẮC MẮC",
    faqTitle: "Những câu hỏi Supplier thường đặt ra.",
    faqs: [
      ["Tự thuê 1–2 nhân viên sales xuất khẩu có hiệu quả hơn không?", "Vexim không chỉ cung cấp nhân sự. Supplier có thêm dữ liệu buyer, quy trình, hệ thống theo dõi và chuyên gia tuân thủ tại Mỹ trong cùng một mô hình vận hành."],
      ["Mất bao lâu để có đơn hàng đầu tiên?", "Thời gian phụ thuộc vào ngành, mức độ sẵn sàng của hồ sơ, sản phẩm và chu kỳ mua của buyer. Vexim không cam kết đơn hàng nếu chưa có cơ sở dữ liệu đủ chắc chắn; chúng tôi cam kết minh bạch tiến độ và bước tiếp theo."],
      ["Nhà máy chưa có FDA hoặc chưa hoàn thiện nhãn có tham gia được không?", "Có thể bắt đầu bằng bước đánh giá hiện trạng. Đội ngũ sẽ xác định phần hồ sơ cần hoàn thiện trước khi giới thiệu sản phẩm tới buyer phù hợp."],
      ["Làm thế nào để Supplier kiểm soát công việc Vexim?", "Các hoạt động tiếp cận, phản hồi buyer, báo giá và trạng thái deal được cập nhật tập trung trên hệ thống Vexim Trade, kèm báo cáo định kỳ."],
      ["Vexim bảo vệ nhà máy trước rủi ro thanh toán quốc tế thế nào?", "Quy trình đàm phán và xác minh giao dịch được phối hợp với kiểm tra hồ sơ, điều kiện thương mại và các bước xác thực thanh toán phù hợp."],
      ["Mô hình phí có phát sinh chi phí ẩn không?", "Chi phí và phạm vi công việc được trao đổi rõ trước khi triển khai. Buổi tư vấn đầu tiên giúp hai bên xác định mức độ phù hợp và lộ trình cần thiết."],
    ] as const,
    formEyebrow: "KẾT NỐI NGAY HÔM NAY",
    formTitle: "Bạn có sản phẩm tốt. Vexim giúp bạn đưa sản phẩm đó đến đúng buyer.",
    formText: "Chia sẻ thông tin sản phẩm và năng lực cung ứng. Đội ngũ Vexim sẽ phân tích sơ bộ mức độ phù hợp với buyer Mỹ và liên hệ tư vấn 1:1 trong 2–4 giờ làm việc.",
    footerNote: "Dữ liệu thật · Giá trị thật",
  },
  en: {
    nav: ["The challenge", "Solution", "Process", "FAQ"],
    signIn: "Sign in",
    contact: "Request a consultation",
    eyebrow: "OUTSOURCED EXPORT SALES",
    heroTitle: "Great products deserve a sales team strong enough to reach international buyers.",
    heroText: "Vexim becomes your outsourced export sales department, representing Vietnamese suppliers to reach and connect with U.S. buyers using real customs data and U.S.-based expertise.",
    heroCta: "Request a 1:1 consultation",
    heroSecondary: "Explore the 8-step process",
    heroNote: "Operating cost comparable to one office employee — with an entire system behind your factory.",
    statOne: "Real Bill of Lading data",
    statTwo: "Buyer screening criteria",
    statThree: "Progress reporting",
    statFour: "U.S. compliance expertise",
    painEyebrow: "THE SUPPLIER CHALLENGE",
    painTitle: "Even great products can get stuck before the export door.",
    painText: "The bottlenecks that keep Vietnamese manufacturers from reaching international buyers with confidence.",
    painPoints: [
      ["No clear way to reach the right buyer", "Limited access to decision-makers at international importers, retail chains and distributors.", Users],
      ["Data is purchased but not used", "Unverified buyer lists do not reveal import history, demand or real buying timing.", Database],
      ["Trade shows are expensive", "Large exhibition budgets are difficult to measure and rarely create a predictable conversion path.", Building2],
      ["Waiting on B2B marketplaces", "Posting products and waiting to be discovered among millions of competitors is not a sales strategy.", Globe2],
      ["Buyers push prices down", "Without market context and negotiation support, margin gets squeezed before the relationship starts.", CircleDollarSign],
      ["Building an in-house export team", "Hiring, foreign-currency payroll, training and management create a heavy fixed cost.", AlertTriangle],
    ] as const,
    solutionEyebrow: "THE COMPLETE SOLUTION",
    solutionTitle: "Not just a buyer list — an export sales operating system.",
    solutionText: "From customs data to negotiation meetings, every activity is structured, assigned and visible through Vexim Trade.",
    solutions: [
      ["Buyer intelligence", "Analyze Bill of Lading and import signals to choose the right buyers before outreach.", Search],
      ["Supplier readiness", "Prepare factory capability, product information and compliance documents before the first conversation.", Factory],
      ["Pipeline visibility", "See buyers, responses, quotations, documents and next steps in one focused system.", LayoutDashboard],
      ["U.S. compliance support", "Work with U.S. compliance expertise across FDA, MoCRA, labeling and technical requirements.", ShieldCheck],
    ] as const,
    criteriaEyebrow: "7 SCREENING CRITERIA",
    criteriaTitle: "Reach fewer buyers — but reach better-fit buyers.",
    criteriaText: "Each buyer is assessed against real data and the Supplier's actual capability before outreach begins.",
    criteria: [
      ["Real import history", "Validate whether the buyer imports from Vietnam or Asia using Bill of Lading data."],
      ["Product & demand fit", "Identify the SKU, packaging, volume and price segment the buyer is actively sourcing."],
      ["Current suppliers", "Analyze the incumbent supply base to find your advantage in quality, capacity or price."],
      ["Growth momentum", "Measure import frequency across the last 12–24 months to prioritize growing buyers."],
      ["Buying timing", "Understand seasons and purchase cycles so outreach arrives before the next contract window."],
      ["Expansion potential", "Assess the buyer's distribution footprint and room for a broader product range."],
      ["Supplier fit", "Match MOQ, production tolerance, certifications and growth direction on both sides."],
    ] as const,
    processEyebrow: "A DISCIPLINED ROADMAP",
    processTitle: "Eight steps from market data to a buyer agreement.",
    process: [
      ["01", "Analyze & select buyers", "Identify the best-fit buyer group using real import data and growth potential."],
      ["02", "Prepare the supplier dossier", "Complete company information, product specs, capacity and required compliance files."],
      ["03", "Build a professional profile", "Position your factory and products on Vexim Trade for international B2B conversations."],
      ["04", "Outreach & present", "Run professional outreach and connect with the right purchasing contact."],
      ["05", "Develop the opportunity", "Track requirements, target pricing, Incoterms and technical questions."],
      ["06", "Samples & evaluation", "Standardize packaging, coordinate samples and support quality review."],
      ["07", "Meetings & negotiation", "Connect Supplier and buyer for commercial discussion and contract negotiation."],
      ["08", "Buyer visit support", "Support the factory when an international buyer visits Vietnam for due diligence."],
    ] as const,
    benefitEyebrow: "SUSTAINABLE ADVANTAGE",
    benefitTitle: "You focus on the product. Vexim runs the export channel.",
    benefits: ["Direct access to U.S. importers", "No need to build and manage the whole sales team", "More focus on product, price and capacity", "A growing international buyer network", "Stronger brand visibility in the U.S.", "A more credible, strategic supplier position"],
    faqEyebrow: "FREQUENT QUESTIONS",
    faqTitle: "What Suppliers usually ask first.",
    faqs: [
      ["Would hiring one or two export salespeople be more effective?", "Vexim adds more than headcount: buyer intelligence, operating process, reporting, system visibility and U.S. compliance expertise in one model."],
      ["How long does it take to get the first order?", "Timing depends on category, dossier readiness, product fit and buyer buying cycles. Vexim does not promise an order without evidence; we do promise transparent progress and next steps."],
      ["Can a factory join before FDA or labeling is complete?", "Yes. We can start with a readiness review, then identify the documents and steps required before presenting the product to the right buyers."],
      ["How does the Supplier control Vexim's work?", "Outreach, buyer responses, quotations and deal status are updated in Vexim Trade, supported by regular progress reports."],
      ["How do you reduce international payment risk?", "Commercial discussions and transaction verification are supported by document checks, trade terms and appropriate payment validation steps."],
      ["Are there hidden fees?", "Scope and fees are discussed clearly before launch. The first consultation is designed to determine fit and the right operating roadmap."],
    ] as const,
    formEyebrow: "CONNECT TODAY",
    formTitle: "You have a good product. Vexim helps it reach the right buyer.",
    formText: "Share your product and factory capability. A Vexim specialist will review your fit for U.S. buyers and contact you within 2–4 business hours.",
    footerNote: "Real Data · Real Value",
  },
} as const

export default async function RootPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    redirect(landingPathForRole(normaliseRole(profile?.role)))
  }

  const locale = await getLocale()
  const t = content[locale]

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-5 px-5 sm:px-8 lg:px-10">
          <Link href="/" className="group flex items-center gap-3" aria-label="Vexim Trade home">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-transform group-hover:-rotate-3"><TrendingUp className="h-5 w-5" /></span>
            <span className="text-base font-bold tracking-tight text-primary">Vexim Trade</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground lg:flex" aria-label="Primary navigation">
            <a href="#challenge" className="transition-colors hover:text-primary">{t.nav[0]}</a>
            <a href="#solution" className="transition-colors hover:text-primary">{t.nav[1]}</a>
            <a href="#process" className="transition-colors hover:text-primary">{t.nav[2]}</a>
            <a href="#faq" className="transition-colors hover:text-primary">{t.nav[3]}</a>
          </nav>
          <details className="relative lg:hidden">
            <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md border border-border text-primary hover:bg-muted [&::-webkit-details-marker]:hidden" aria-label={localeLabel(locale, "Mở menu", "Open menu")}>
              <Menu className="h-4 w-4" />
            </summary>
            <div className="absolute right-0 top-11 z-50 w-48 rounded-xl border border-border bg-card p-2 shadow-xl">
              <a href="#challenge" className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-primary">{t.nav[0]}</a>
              <a href="#solution" className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-primary">{t.nav[1]}</a>
              <a href="#process" className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-primary">{t.nav[2]}</a>
              <a href="#faq" className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-primary">{t.nav[3]}</a>
            </div>
          </details>
          <div className="flex items-center gap-2"><LanguageSwitcher compact /><Button asChild variant="outline" className="hidden border-primary/20 text-primary hover:bg-primary/5 sm:inline-flex"><Link href="/auth/login">{t.signIn}</Link></Button><Button asChild className="bg-cta text-cta-foreground shadow-sm hover:bg-cta/90"><a href="#consultation">{t.contact}</a></Button></div>
        </div>
      </header>

      <section className="relative isolate overflow-hidden bg-primary text-primary-foreground">
        <div className="pointer-events-none absolute -left-32 -top-40 h-[32rem] w-[32rem] rounded-full bg-accent/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-48 right-0 h-[30rem] w-[30rem] rounded-full bg-cta/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[0.95fr_1.05fr] lg:px-10 lg:py-28">
          <div className="max-w-2xl"><div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-[11px] font-semibold tracking-[0.16em] text-sky-100"><span className="h-1.5 w-1.5 rounded-full bg-cta" />{t.eyebrow}</div><h1 className="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-[-0.04em] text-balance sm:text-6xl lg:text-[4.15rem]">{t.heroTitle}</h1><p className="mt-6 max-w-xl text-base leading-8 text-slate-200 sm:text-lg">{t.heroText}</p><div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"><Button asChild size="lg" className="h-12 bg-cta px-6 text-cta-foreground shadow-lg shadow-amber-950/20 hover:bg-cta/90"><a href="#consultation">{t.heroCta}<ArrowRight className="h-4 w-4" /></a></Button><Button asChild size="lg" variant="ghost" className="h-12 text-slate-100 hover:bg-white/10 hover:text-white"><a href="#process">{t.heroSecondary}</a></Button></div><div className="mt-8 flex items-start gap-3 text-sm leading-6 text-slate-300"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" />{t.heroNote}</div></div>
          <div className="relative mx-auto w-full max-w-xl lg:ml-auto"><div className="absolute -inset-4 rounded-[2rem] bg-accent/10 blur-2xl" /><div className="relative overflow-hidden rounded-[1.4rem] border border-white/20 bg-white/10 p-2 shadow-2xl shadow-slate-950/30 backdrop-blur-sm"><div className="relative aspect-[1.08/1] overflow-hidden rounded-[1rem]"><Image src="/landing/hero-dashboard.jpg" alt="Export operations in a modern warehouse" fill priority sizes="(max-width: 1024px) 90vw, 48vw" className="object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-primary/85 via-transparent to-transparent" /><div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-[0.16em] text-sky-100/80">Vexim operating system</p><p className="mt-1 text-lg font-semibold text-white">Demand → supplier → deal</p></div><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cta text-cta-foreground shadow-lg"><ArrowRight className="h-5 w-5" /></div></div></div></div><div className="absolute -bottom-5 -left-4 hidden rounded-xl border border-white/20 bg-slate-950/80 px-4 py-3 shadow-xl backdrop-blur-md sm:block"><div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20 text-accent"><BarChart3 className="h-4 w-4" /></span><div><p className="text-[10px] uppercase tracking-wider text-slate-400">Pipeline visibility</p><p className="text-sm font-semibold text-white">Built for action</p></div></div></div><div className="absolute -right-4 top-8 hidden rounded-xl border border-white/20 bg-white px-4 py-3 shadow-xl sm:block"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-primary" /><p className="text-sm font-semibold text-primary">Compliance-ready</p></div></div></div>
        </div>
        <div className="relative mx-auto grid max-w-7xl grid-cols-2 border-t border-white/10 px-5 sm:grid-cols-4 sm:px-8 lg:px-10"><Stat value="100%" label={t.statOne} /><Stat value="7" label={t.statTwo} /><Stat value={locale === "vi" ? "Hàng tuần" : "Weekly"} label={t.statThree} /><Stat value="USA" label={t.statFour} /></div>
      </section>

      <section id="challenge" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28"><SectionHeading eyebrow={t.painEyebrow} title={t.painTitle} text={t.painText} /><div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{t.painPoints.map(([title, text, Icon], index) => <article key={title} className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-cta/50 hover:shadow-xl hover:shadow-primary/5"><div className="flex items-center justify-between"><span className="text-xs font-bold tracking-[0.2em] text-muted-foreground">0{index + 1}</span><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cta/15 text-cta-foreground transition-colors group-hover:bg-cta"><Icon className="h-5 w-5" /></span></div><h3 className="mt-6 text-lg font-semibold text-primary">{title}</h3><p className="mt-3 text-sm leading-7 text-muted-foreground">{text}</p></article>)}</div></section>

      <section id="solution" className="border-y border-border bg-muted/40"><div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28"><SectionHeading eyebrow={t.solutionEyebrow} title={t.solutionTitle} text={t.solutionText} /><div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{t.solutions.map(([title, text, Icon]) => <article key={title} className="rounded-2xl border border-border bg-card p-6 shadow-sm"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-primary"><Icon className="h-5 w-5" /></div><h3 className="mt-6 text-base font-semibold text-primary">{title}</h3><p className="mt-3 text-sm leading-7 text-muted-foreground">{text}</p></article>)}</div><div className="mt-12 overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground shadow-xl sm:p-8"><div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between"><div className="max-w-lg"><p className="text-xs font-bold tracking-[0.2em] text-accent">{localeLabel(locale, "HỆ THỐNG PHÍA SAU SUPPLIER", "THE SYSTEM BEHIND YOUR FACTORY")}</p><h3 className="mt-3 text-2xl font-semibold text-white">{localeLabel(locale, "Chi phí của một nhân sự. Năng lực của cả một bộ máy.", "The cost of one employee. The capability of an entire operating system.")}</h3></div><div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"><MiniMetric icon={Database} value="Data" /><MiniMetric icon={Mail} value="Outreach" /><MiniMetric icon={BarChart3} value="Reports" /><MiniMetric icon={Handshake} value="Deals" /></div></div></div></div></section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28"><div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20"><div><p className="text-xs font-bold tracking-[0.2em] text-primary">{t.criteriaEyebrow}</p><h2 className="mt-4 text-3xl font-semibold tracking-tight text-primary sm:text-4xl">{t.criteriaTitle}</h2><p className="mt-4 text-base leading-7 text-muted-foreground">{t.criteriaText}</p><div className="mt-8 flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/10 p-4 text-sm text-primary"><Target className="h-5 w-5 shrink-0 text-primary" />{localeLabel(locale, "Dữ liệu trước. Outreach sau.", "Data first. Outreach second.")}</div></div><div className="grid gap-3 sm:grid-cols-2">{t.criteria.map(([title, text], index) => <div key={title} className="flex gap-4 rounded-xl border border-border bg-card p-4 shadow-sm"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">{index + 1}</span><div><h3 className="text-sm font-semibold text-primary">{title}</h3><p className="mt-1.5 text-xs leading-6 text-muted-foreground">{text}</p></div></div>)}</div></div></section>

      <section id="process" className="border-y border-border bg-primary text-primary-foreground"><div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28"><div className="max-w-2xl"><p className="text-xs font-bold tracking-[0.2em] text-accent">{t.processEyebrow}</p><h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{t.processTitle}</h2></div><div className="mt-12 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">{t.process.map(([number, title, text]) => <div key={number} className="relative border-t border-white/20 pt-5"><span className="text-3xl font-semibold text-accent">{number}</span><h3 className="mt-4 text-base font-semibold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-300">{text}</p></div>)}</div></div></section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28"><div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end"><div><p className="text-xs font-bold tracking-[0.2em] text-primary">{t.benefitEyebrow}</p><h2 className="mt-4 text-3xl font-semibold tracking-tight text-primary sm:text-4xl">{t.benefitTitle}</h2></div><div className="grid gap-3 sm:grid-cols-2">{t.benefits.map((benefit) => <div key={benefit} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-primary shadow-sm"><CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />{benefit}</div>)}</div></div></section>

      <section id="faq" className="border-y border-border bg-muted/40"><div className="mx-auto max-w-4xl px-5 py-20 sm:px-8 lg:py-28"><SectionHeading eyebrow={t.faqEyebrow} title={t.faqTitle} /><div className="mt-10 divide-y divide-border rounded-2xl border border-border bg-card px-5">{t.faqs.map(([question, answer]) => <details key={question} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-left text-sm font-semibold text-primary marker:hidden"><span>{question}</span><span className="text-xl font-normal text-accent transition-transform group-open:rotate-45">+</span></summary><p className="max-w-3xl pr-8 pt-3 text-sm leading-7 text-muted-foreground">{answer}</p></details>)}</div></div></section>

      <section id="consultation" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28"><div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start"><div className="pt-3"><p className="text-xs font-bold tracking-[0.2em] text-primary">{t.formEyebrow}</p><h2 className="mt-4 text-3xl font-semibold tracking-tight text-primary sm:text-4xl">{t.formTitle}</h2><p className="mt-5 text-base leading-8 text-muted-foreground">{t.formText}</p><div className="mt-8 space-y-4"><div className="flex items-center gap-3 text-sm text-primary"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15"><ClipboardCheck className="h-4 w-4" /></span>{localeLabel(locale, "Đánh giá sơ bộ mức độ phù hợp", "Initial fit review")}</div><div className="flex items-center gap-3 text-sm text-primary"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15"><Calendar className="h-4 w-4" /></span>{localeLabel(locale, "Phản hồi trong 2–4 giờ làm việc", "Response within 2–4 business hours")}</div><div className="flex items-center gap-3 text-sm text-primary"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15"><BadgeCheck className="h-4 w-4" /></span>{localeLabel(locale, "Bảo mật thông tin nhà máy", "Factory information stays confidential")}</div></div></div><ConsultationForm locale={locale} /></div></section>

      <footer className="border-t border-border bg-background"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10"><div className="flex items-center gap-2 font-semibold text-primary"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground"><TrendingUp className="h-4 w-4" /></span>Vexim Trade</div><p>{t.footerNote}</p><a href={`tel:${siteConfig.contact.phone}`} className="font-semibold text-primary hover:text-cta">{siteConfig.contact.hotline}</a></div></footer>
    </main>
  )
}

function localeLabel(locale: "vi" | "en", vi: string, en: string) {
  return locale === "vi" ? vi : en
}

function Stat({ value, label }: { value: string; label: string }) {
  return <div className="border-r border-white/10 px-4 py-5 first:pl-0 last:border-r-0"><p className="text-xl font-semibold text-white sm:text-2xl">{value}</p><p className="mt-1 text-xs leading-5 text-slate-300">{label}</p></div>
}

function MiniMetric({ icon: Icon, value }: { icon: LucideIcon; value: string }) {
  return <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-xs text-slate-200"><Icon className="h-4 w-4 text-accent" />{value}</div>
}

function SectionHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return <div className="max-w-2xl"><p className="text-xs font-bold tracking-[0.2em] text-primary">{eyebrow}</p><h2 className="mt-4 text-3xl font-semibold tracking-tight text-primary sm:text-4xl">{title}</h2>{text && <p className="mt-4 text-base leading-7 text-muted-foreground">{text}</p>}</div>
}
