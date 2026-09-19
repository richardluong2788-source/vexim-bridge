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
  Scale,
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
    nav: ["Buyer & Supplier", "Giải pháp", "Quy trình", "FAQ"],
    signIn: "Đăng nhập",
    contact: "Đăng ký tư vấn",
    eyebrow: "TỪ NHÀ MÁY VIỆT NAM ĐẾN BUYER MỸ",
    heroTitle: "Sản phẩm tốt cần gặp đúng người mua.",
    heroText:
      "Bạn hiểu sản phẩm và nhà máy của mình. Vexim lo phần tìm đúng buyer, kiểm tra mức độ phù hợp và giúp hai bên bắt đầu cuộc trò chuyện trên cùng một mặt bằng thông tin.",
    heroCta: "Nói chuyện với Vexim",
    heroSecondary: "Xem Vexim làm việc ra sao",
    heroNote: "Buyer biết mình đang xem gì. Supplier biết mình cần chuẩn bị gì. Không bên nào phải quyết định chỉ bằng lời hứa.",
    audienceEyebrow: "CÂU CHUYỆN CỦA CẢ HAI PHÍA",
    audienceTitle: "Buyer cần nguồn cung có thể tin. Supplier cần một buyer thật sự phù hợp.",
    audienceText: "Một mối quan hệ xuất khẩu tốt không bắt đầu bằng việc nói cho hay. Nó bắt đầu bằng việc hiểu đúng nhu cầu, năng lực và giới hạn của nhau.",
    audiences: [
      ["Nếu bạn là Buyer Mỹ", "Tìm nguồn cung Việt Nam đàng hoàng", "Bạn có thể xem năng lực nhà máy, hồ sơ tuân thủ, MOQ, công suất và điều kiện thương mại trước khi dành thời gian trao đổi sâu hơn.", Users],
      ["Nếu bạn là Supplier Việt Nam", "Được giới thiệu khi đã sẵn sàng", "Vexim cùng bạn rà lại sản phẩm, chất lượng, chứng từ, nhãn mác và khả năng giao hàng — để mỗi cuộc chào buyer bắt đầu từ năng lực thật.", Factory],
    ] as const,
    fairnessTitle: "Để hai bên cùng biết mình đang bước vào điều gì.",
    fairnessText: "Buyer có cơ sở để đánh giá. Supplier có phản hồi để hoàn thiện và thương lượng. Vexim nói rõ cả điểm mạnh lẫn phần còn thiếu, thay vì làm đẹp thông tin cho một phía.",
    statOne: "Dữ liệu Bill of Lading thực",
    statTwo: "Tiêu chí sàng lọc buyer",
    statThree: "Báo cáo tiến độ",
    statFour: "Chuyên gia tại Mỹ",
    painEyebrow: "ĐIỀU NHIỀU NHÀ MÁY GẶP PHẢI",
    painTitle: "Bạn có thể làm hàng rất tốt, nhưng vẫn chưa biết bắt đầu từ đâu.",
    painText: "Không phải nhà máy nào cũng thiếu năng lực. Nhiều khi chỉ thiếu đúng dữ liệu, đúng người và một quy trình đủ kiên nhẫn để đi đến cùng.",
    painPoints: [
      ["Không biết nên bắt đầu với buyer nào", "Có rất nhiều cái tên trên thị trường, nhưng không phải ai cũng đang mua đúng sản phẩm bạn làm.", Users],
      ["Có data nhưng chưa đọc được câu chuyện phía sau", "Một danh sách email không nói cho bạn biết buyer đang nhập gì, mua bao nhiêu và khi nào sẽ mua lại.", Database],
      ["Hội chợ tốn nhiều hơn bạn nghĩ", "Một gian hàng đẹp chưa chắc đưa bạn đến đúng người mua, và càng khó biết cuộc gặp nào thật sự có cơ hội.", Building2],
      ["Không muốn ngồi chờ trên sàn B2B", "Đăng sản phẩm là bước đầu. Để có cuộc trò chuyện thật, vẫn cần người tìm hiểu và chủ động mở lời.", Globe2],
      ["Dễ rơi vào thế bị ép giá", "Khi chưa hiểu buyer, thị trường và giá trị của mình, cuộc thương lượng thường bắt đầu ở thế bất lợi.", CircleDollarSign],
      ["Tự xây cả đội sales là một bài toán lớn", "Tìm người, đào tạo, quản lý và giữ người giỏi — tất cả đều cần thời gian trước khi có kết quả.", AlertTriangle],
    ] as const,
    solutionEyebrow: "VEXIM ĐỨNG Ở GIỮA ĐỂ LÀM RÕ HAI PHÍA",
    solutionTitle: "Vexim lo phần đường đi, để buyer và supplier có thể nói chuyện thật với nhau.",
    solutionText: "Chúng tôi tìm hiểu buyer, rà lại mức độ sẵn sàng của supplier, rồi theo sát từng bước trên một hệ thống mà cả đội ngũ đều nhìn thấy.",
    solutions: [
      ["Tìm đúng buyer", "Đọc dữ liệu nhập khẩu và nhu cầu thực tế để không gửi lời chào hàng một cách may rủi.", Search],
      ["Rà lại nhà máy", "Cùng supplier nhìn thẳng vào sản phẩm, hồ sơ, chất lượng và khả năng đáp ứng trước khi giới thiệu.", Factory],
      ["Theo sát từng cơ hội", "Buyer, phản hồi, báo giá, hồ sơ và bước tiếp theo không nằm rải rác trong những file riêng lẻ.", LayoutDashboard],
      ["Hiểu yêu cầu của Mỹ", "Có người cùng rà FDA, MoCRA, nhãn mác và các yêu cầu kỹ thuật trước khi buyer hỏi đến.", ShieldCheck],
    ] as const,
    criteriaEyebrow: "TRƯỚC KHI GỬI MỘT EMAIL",
    criteriaTitle: "Chúng tôi muốn mỗi lời chào đều có lý do để được gửi đi.",
    criteriaText: "Không phải buyer nào cũng phù hợp, và không phải supplier nào cũng nên nhận cùng một cơ hội. Bảy tiêu chí giúp hai bên gặp nhau đúng lúc hơn.",
    criteria: [
      ["Buyer đã từng nhập gì?", "Nhìn vào Bill of Lading để biết buyer có thật sự mua từ Việt Nam hoặc châu Á hay không."],
      ["Buyer đang tìm gì?", "Từ SKU, quy cách đến phân khúc giá — càng hiểu rõ, lời chào càng bớt chung chung."],
      ["Buyer đang mua của ai?", "Biết đối thủ hiện tại để supplier hiểu mình có thể cạnh tranh ở chất lượng, công suất hay giá."],
      ["Nhu cầu đang tăng hay giảm?", "Nhìn vào nhịp nhập khẩu 12–24 tháng gần đây thay vì chỉ nhìn một giao dịch đơn lẻ."],
      ["Bao giờ nên mở lời?", "Đúng sản phẩm nhưng sai thời điểm vẫn là một cuộc chào hàng bỏ lỡ."],
      ["Hai bên có thể đi xa đến đâu?", "Xem buyer có không gian mở rộng sản phẩm và supplier có thể đi cùng tốc độ đó không."],
      ["Có thật sự hợp nhau không?", "MOQ, chứng chỉ, dung sai, năng lực giao hàng và cách làm việc đều cần được đặt lên bàn."],
    ] as const,
    processEyebrow: "ĐI CÙNG NHAU TỪ BƯỚC ĐẦU",
    processTitle: "Không vội chốt. Đi từng bước để đi được đường dài.",
    process: [
      ["01", "Tìm hiểu buyer", "Bắt đầu từ dữ liệu và nhu cầu thật, không bắt đầu bằng việc gửi hàng loạt email."],
      ["02", "Rà lại hồ sơ nhà máy", "Cùng supplier bổ sung những thông tin buyer Mỹ thực sự cần để đánh giá."],
      ["03", "Kể đúng câu chuyện sản phẩm", "Biến năng lực nhà máy thành một profile rõ ràng, dễ hiểu và có căn cứ."],
      ["04", "Mở lời đúng cách", "Kết nối với đúng người phụ trách mua hàng, bằng một lời chào có liên quan."],
      ["05", "Nghe và làm rõ nhu cầu", "Ghi nhận câu hỏi, giá mục tiêu, Incoterms và những điều buyer còn băn khoăn."],
      ["06", "Gửi mẫu, nhận phản hồi", "Phối hợp gửi mẫu và để buyer đánh giá sản phẩm bằng trải nghiệm thực tế."],
      ["07", "Ngồi vào bàn cùng nhau", "Khi đã đủ cơ sở, Vexim kết nối hai bên cho cuộc họp và thương lượng cụ thể."],
      ["08", "Đón buyer tại nhà máy", "Nếu buyer muốn sang Việt Nam, Vexim cùng supplier chuẩn bị một chuyến thăm tử tế và thực chất."],
    ] as const,
    benefitEyebrow: "ĐIỀU SUPPLIER NHẬN LẠI",
    benefitTitle: "Supplier làm tốt phần mình. Vexim giúp phần còn lại có người lo.",
    benefits: ["Nói chuyện trực tiếp với nhà nhập khẩu Mỹ", "Không phải tự dựng cả đội sales từ đầu", "Có thêm thời gian cho sản phẩm và công suất", "Mở rộng dần mạng lưới buyer quốc tế", "Được nhìn nhận chuyên nghiệp hơn tại thị trường Mỹ", "Biết rõ mình đang ở đâu trong mỗi cơ hội"],
    faqEyebrow: "NÓI THẲNG VỚI NHAU",
    faqTitle: "Những điều Supplier thường muốn biết trước khi bắt đầu.",
    faqs: [
      ["Tự thuê một, hai bạn sales xuất khẩu có đơn giản hơn không?", "Có thể phù hợp với một số doanh nghiệp. Nhưng nếu bạn còn thiếu dữ liệu buyer, quy trình và người hiểu thị trường Mỹ, bài toán không chỉ là tuyển thêm người."],
      ["Bao lâu thì có đơn hàng đầu tiên?", "Không có một con số đúng cho mọi ngành. Còn tùy sản phẩm, hồ sơ, mức độ phù hợp và chu kỳ mua của buyer. Vexim không hứa một đơn hàng khi chưa có cơ sở; chúng tôi sẽ nói rõ tiến độ và phần việc tiếp theo."],
      ["Chưa có FDA hoặc nhãn còn phải hoàn thiện thì sao?", "Vẫn có thể bắt đầu bằng một buổi rà soát. Bạn sẽ biết phần nào đã ổn, phần nào cần làm trước khi đưa sản phẩm ra trước buyer Mỹ."],
      ["Tôi theo dõi công việc Vexim bằng cách nào?", "Các cuộc tiếp cận, phản hồi buyer, báo giá và bước tiếp theo đều được cập nhật trên Vexim Trade, không phải chờ đến cuối tháng mới biết tình hình."],
      ["Vexim hỗ trợ gì về rủi ro thanh toán?", "Chúng tôi cùng kiểm tra hồ sơ, điều kiện thương mại và các bước xác thực phù hợp. Những điểm chưa rõ sẽ được nêu ra trước khi hai bên đi tiếp."],
      ["Phí có rõ ngay từ đầu không?", "Có. Phạm vi công việc và chi phí sẽ được nói rõ trước khi bắt đầu. Buổi đầu tiên chủ yếu để xem hai bên có phù hợp hay không."],
    ] as const,
    formEyebrow: "BẮT ĐẦU BẰNG MỘT CUỘC NÓI CHUYỆN",
    formTitle: "Bạn kể chúng tôi nghe về sản phẩm. Cùng xem thị trường Mỹ có phù hợp không.",
    formText: "Không cần chuẩn bị một bài thuyết trình dài. Chỉ cần cho chúng tôi biết bạn đang làm gì, năng lực hiện tại ra sao và muốn đi đến đâu. Vexim sẽ liên hệ lại trong 2–4 giờ làm việc.",
    footerNote: "Dữ liệu thật · Giá trị thật",
  },
  en: {
    nav: ["Buyer & Supplier", "Solution", "Process", "FAQ"],
    signIn: "Sign in",
    contact: "Request a consultation",
    eyebrow: "FROM VIETNAMESE FACTORIES TO U.S. BUYERS",
    heroTitle: "Good products should meet the right buyers.",
    heroText: "You know your product and your factory. Vexim helps find the right buyer, check the fit and give both sides a clearer place to start.",
    heroCta: "Talk to Vexim",
    heroSecondary: "See how we work",
    heroNote: "Buyers know what they are reviewing. Suppliers know what they need to prepare. No one has to decide on promises alone.",
    audienceEyebrow: "A STORY THAT INCLUDES BOTH SIDES",
    audienceTitle: "Buyers need supply they can trust. Suppliers need a buyer who is truly a fit.",
    audienceText: "A good export relationship does not start with polished promises. It starts with understanding each side's needs, capability and limits.",
    audiences: [
      ["If you are a U.S. Buyer", "Vietnamese supply worth a closer look", "Review factory capability, compliance documents, MOQ, capacity and trade terms before investing more time in the conversation.", Users],
      ["If you are a Vietnamese Supplier", "Be introduced when you are ready", "Review product, quality, documents, labeling and delivery capability so every buyer conversation starts from what is real.", Factory],
    ] as const,
    fairnessTitle: "Both sides should know what they are walking into.",
    fairnessText: "Buyers get enough context to evaluate. Suppliers get useful feedback to improve and negotiate. Vexim does not hide one side's risk to make the other side look better.",
    statOne: "Real Bill of Lading data",
    statTwo: "Buyer screening criteria",
    statThree: "Progress reporting",
    statFour: "U.S. compliance expertise",
    painEyebrow: "WHAT MANY FACTORIES RUN INTO",
    painTitle: "You can make a great product and still not know where to start.",
    painText: "The problem is not always capability. Sometimes it is the missing data, the missing contact or a process that never gets enough time to work.",
    painPoints: [
      ["You do not know which buyer to start with", "There are plenty of names in the market, but not all of them buy what you make.", Users],
      ["You have data, but not the story behind it", "A list of emails does not tell you what the buyer imports, how much they buy or when they will buy again.", Database],
      ["Trade shows cost more than the booth", "A good-looking stand does not guarantee the right conversation — or tell you which meeting had real potential.", Building2],
      ["You do not want to wait on a B2B marketplace", "Listing a product is only the first step. Real conversations still need research and a thoughtful introduction.", Globe2],
      ["You start every negotiation on the back foot", "Without market and buyer context, it is easy to give away margin before the real conversation begins.", CircleDollarSign],
      ["Building an export team is a lot to take on", "Hiring, training, managing and keeping good people takes time before it creates a return.", AlertTriangle],
    ] as const,
    solutionEyebrow: "WHERE VEXIM FITS IN",
    solutionTitle: "We take care of the road between a buyer and a supplier.",
    solutionText: "We learn about the buyer, review the supplier's readiness and keep the next step visible to the whole team in Vexim Trade.",
    solutions: [
      ["Find the right buyer", "Read import data and demand signals so outreach starts with a reason, not a guess.", Search],
      ["Review the factory", "Look honestly at product, documents, quality and delivery capability before making an introduction.", Factory],
      ["Stay close to every opportunity", "Buyer replies, quotations, documents and next steps should not disappear across separate files.", LayoutDashboard],
      ["Understand the U.S. requirements", "Get help thinking through FDA, MoCRA, labeling and technical questions before the buyer asks.", ShieldCheck],
    ] as const,
    criteriaEyebrow: "BEFORE WE SEND AN EMAIL",
    criteriaTitle: "Every introduction should have a reason behind it.",
    criteriaText: "Not every buyer is a fit, and not every supplier should receive the same opportunity. These seven questions help both sides meet at a better time.",
    criteria: [
      ["What has the buyer imported?", "Use Bill of Lading data to see whether the buyer actually imports from Vietnam or Asia."],
      ["What is the buyer looking for?", "SKU, packaging, volume and price all matter when you want an introduction to feel relevant."],
      ["Who supplies them today?", "The current supplier base shows where a factory may compete — quality, capacity, price or something else."],
      ["Is demand growing or slowing?", "Look at import rhythm across 12–24 months instead of one isolated shipment."],
      ["When is the right time to talk?", "Even the right product can miss the opportunity if it arrives at the wrong point in the buying cycle."],
      ["Could both sides grow together?", "Look at the buyer's reach and whether the supplier can grow with the opportunity."],
      ["Are they genuinely a fit?", "MOQ, certifications, production tolerance, delivery and working style all belong in the conversation."],
    ] as const,
    processEyebrow: "WE STAY WITH IT",
    processTitle: "No rush to close. Eight practical steps to build something that can last.",
    process: [
      ["01", "Learn about the buyer", "Start with real demand and context, not a mass email list."],
      ["02", "Review the supplier dossier", "Work with the factory to fill the information a U.S. buyer actually needs."],
      ["03", "Tell the product story clearly", "Turn factory capability into a profile that is easy to understand and backed by facts."],
      ["04", "Open the conversation", "Reach the right purchasing contact with a message that is actually relevant."],
      ["05", "Listen and clarify", "Capture questions, target pricing, Incoterms and what the buyer still needs to know."],
      ["06", "Send samples and learn", "Coordinate samples and let the buyer evaluate the product through a real experience."],
      ["07", "Sit down together", "When there is enough substance, connect both sides for a focused meeting and negotiation."],
      ["08", "Welcome the buyer", "If a buyer visits Vietnam, help the factory prepare a visit that is honest and useful."],
    ] as const,
    benefitEyebrow: "WHAT THE SUPPLIER GETS BACK",
    benefitTitle: "You do your part well. Vexim makes sure the rest has an owner.",
    benefits: ["Talk directly with U.S. importers", "Do not build the entire sales team from scratch", "Keep more time for product and capacity", "Build an international buyer network over time", "Show up more credibly in the U.S. market", "Know where each opportunity really stands"],
    faqEyebrow: "LET'S BE CLEAR FROM THE START",
    faqTitle: "What Suppliers usually want to know before starting.",
    faqs: [
      ["Would hiring one or two export salespeople be simpler?", "It can be right for some businesses. But if you are also missing buyer data, process and U.S. market context, the problem is bigger than headcount."],
      ["How long until the first order?", "There is no honest one-size-fits-all answer. It depends on category, readiness, fit and the buyer's cycle. We will not promise an order without evidence; we will be clear about progress and next steps."],
      ["What if FDA or labeling is not complete yet?", "Start with a readiness review. You will see what is ready, what is missing and what should happen before the product goes in front of a U.S. buyer."],
      ["How do I keep track of Vexim's work?", "Outreach, buyer replies, quotations and next steps are updated in Vexim Trade instead of waiting for a monthly surprise."],
      ["What do you do about payment risk?", "We review documents, trade terms and appropriate verification steps with you. Anything unclear should be surfaced before both sides move forward."],
      ["Are fees clear from the start?", "Yes. Scope and fees are discussed before launch. The first conversation is mainly about whether the two sides are a good fit."],
    ] as const,
    formEyebrow: "START WITH A CONVERSATION",
    formTitle: "Tell us about the product. Together, we can see whether the U.S. market is a fit.",
    formText: "No long presentation needed. Tell us what you make, where you are today and where you want to go. A Vexim specialist will call within 2–4 business hours.",
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
            <a href="#audience" className="transition-colors hover:text-primary">{t.nav[0]}</a>
            <a href="#solution" className="transition-colors hover:text-primary">{t.nav[1]}</a>
            <a href="#process" className="transition-colors hover:text-primary">{t.nav[2]}</a>
            <a href="#faq" className="transition-colors hover:text-primary">{t.nav[3]}</a>
          </nav>
          <details className="relative lg:hidden">
            <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md border border-border text-primary hover:bg-muted [&::-webkit-details-marker]:hidden" aria-label={localeLabel(locale, "Mở menu", "Open menu")}>
              <Menu className="h-4 w-4" />
            </summary>
            <div className="absolute right-0 top-11 z-50 w-48 rounded-xl border border-border bg-card p-2 shadow-xl">
              <a href="#audience" className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-primary">{t.nav[0]}</a>
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
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.12fr_0.88fr] lg:gap-12 lg:px-10 lg:py-28">
          <div className="max-w-xl lg:pr-4"><div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-[11px] font-semibold tracking-[0.16em] text-sky-100"><span className="h-1.5 w-1.5 rounded-full bg-cta" />{t.eyebrow}</div><h1 className="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-[-0.04em] text-balance sm:text-5xl lg:text-[3.75rem]">{t.heroTitle}</h1><p className="mt-6 max-w-xl text-base leading-8 text-slate-200 sm:text-lg">{t.heroText}</p><div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"><Button asChild size="lg" className="h-12 bg-cta px-6 text-cta-foreground shadow-lg shadow-amber-950/20 hover:bg-cta/90"><a href="#consultation">{t.heroCta}<ArrowRight className="h-4 w-4" /></a></Button><Button asChild size="lg" variant="ghost" className="h-12 text-slate-100 hover:bg-white/10 hover:text-white"><a href="#process">{t.heroSecondary}</a></Button></div><div className="mt-8 flex items-start gap-3 text-sm leading-6 text-slate-300"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" />{t.heroNote}</div></div>
          <div className="relative mx-auto w-full max-w-lg lg:ml-auto lg:justify-self-end"><div className="absolute -inset-4 rounded-[2rem] bg-accent/10 blur-2xl" /><div className="relative overflow-hidden rounded-[1.4rem] border border-white/20 bg-white/10 p-2 shadow-2xl shadow-slate-950/30 backdrop-blur-sm"><div className="relative aspect-[1.18/1] overflow-hidden rounded-[1rem]"><Image src="/landing/hero-dashboard.jpg" alt="Export operations in a modern warehouse" fill priority sizes="(max-width: 1024px) 90vw, 48vw" className="object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-primary/85 via-transparent to-transparent" /><div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-[0.16em] text-sky-100/80">{localeLabel(locale, "Mạng lưới Vexim Trade", "Vexim Trade network")}</p><p className="mt-1 text-lg font-semibold text-white">{localeLabel(locale, "Buyer ↔ supplier ↔ cơ hội", "Buyer ↔ supplier ↔ opportunity")}</p></div><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cta text-cta-foreground shadow-lg"><ArrowRight className="h-5 w-5" /></div></div></div></div><div className="absolute -bottom-5 -left-4 hidden rounded-xl border border-white/20 bg-slate-950/80 px-4 py-3 shadow-xl backdrop-blur-md sm:block"><div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20 text-accent"><BarChart3 className="h-4 w-4" /></span><div><p className="text-[10px] uppercase tracking-wider text-slate-400">{localeLabel(locale, "Cùng nhìn một bức tranh", "One shared picture")}</p><p className="text-sm font-semibold text-white">{localeLabel(locale, "Biết bước tiếp theo", "Know the next step")}</p></div></div></div><div className="absolute -right-4 top-8 hidden rounded-xl border border-white/20 bg-white px-4 py-3 shadow-xl sm:block"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-primary" /><p className="text-sm font-semibold text-primary">{localeLabel(locale, "Sẵn sàng để kiểm tra", "Ready to review")}</p></div></div></div>
        </div>
        <div className="relative mx-auto grid max-w-7xl grid-cols-2 border-t border-white/10 px-5 sm:grid-cols-4 sm:px-8 lg:px-10"><Stat value="100%" label={t.statOne} /><Stat value="7" label={t.statTwo} /><Stat value={locale === "vi" ? "Hàng tuần" : "Weekly"} label={t.statThree} /><Stat value="USA" label={t.statFour} /></div>
      </section>

      <section id="audience" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-24">
        <SectionHeading eyebrow={t.audienceEyebrow} title={t.audienceTitle} text={t.audienceText} />
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {t.audiences.map(([title, subtitle, text, Icon]) => (
            <article key={title} className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
              <div className="flex items-start justify-between gap-5"><div><p className="text-xs font-bold tracking-[0.16em] text-accent-foreground">{subtitle}</p><h3 className="mt-3 text-2xl font-semibold tracking-tight text-primary">{title}</h3></div><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/20 text-primary"><Icon className="h-6 w-6" /></span></div>
              <p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground">{text}</p>
            </article>
          ))}
        </div>
        <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-accent/30 bg-accent/10 p-5 sm:flex-row sm:items-center sm:p-6">
          <Scale className="h-7 w-7 shrink-0 text-primary" />
          <div><h3 className="font-semibold text-primary">{t.fairnessTitle}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{t.fairnessText}</p></div>
        </div>
      </section>

      <section id="challenge" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28"><SectionHeading eyebrow={t.painEyebrow} title={t.painTitle} text={t.painText} /><div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{t.painPoints.map(([title, text, Icon], index) => <article key={title} className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-cta/50 hover:shadow-xl hover:shadow-primary/5"><div className="flex items-center justify-between"><span className="text-xs font-bold tracking-[0.2em] text-muted-foreground">0{index + 1}</span><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cta/15 text-cta-foreground transition-colors group-hover:bg-cta"><Icon className="h-5 w-5" /></span></div><h3 className="mt-6 text-lg font-semibold text-primary">{title}</h3><p className="mt-3 text-sm leading-7 text-muted-foreground">{text}</p></article>)}</div></section>

      <section id="solution" className="border-y border-border bg-muted/40"><div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28"><SectionHeading eyebrow={t.solutionEyebrow} title={t.solutionTitle} text={t.solutionText} /><div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{t.solutions.map(([title, text, Icon]) => <article key={title} className="rounded-2xl border border-border bg-card p-6 shadow-sm"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-primary"><Icon className="h-5 w-5" /></div><h3 className="mt-6 text-base font-semibold text-primary">{title}</h3><p className="mt-3 text-sm leading-7 text-muted-foreground">{text}</p></article>)}</div><div className="mt-12 overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground shadow-xl sm:p-8"><div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between"><div className="max-w-lg"><p className="text-xs font-bold tracking-[0.2em] text-accent">{localeLabel(locale, "HỆ THỐNG PHÍA SAU SUPPLIER", "THE SYSTEM BEHIND YOUR FACTORY")}</p><h3 className="mt-3 text-2xl font-semibold text-white">{localeLabel(locale, "Chi phí của một nhân sự. Năng lực của cả một bộ máy.", "The cost of one employee. The capability of an entire operating system.")}</h3></div><div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"><MiniMetric icon={Database} value={localeLabel(locale, "Dữ liệu", "Data")} /><MiniMetric icon={Mail} value={localeLabel(locale, "Kết nối", "Outreach")} /><MiniMetric icon={BarChart3} value={localeLabel(locale, "Theo dõi", "Progress")} /><MiniMetric icon={Handshake} value={localeLabel(locale, "Thương lượng", "Deals")} /></div></div></div></div></section>

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
