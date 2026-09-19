import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Factory,
  Globe2,
  Handshake,
  ShieldCheck,
  TrendingUp,
} from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { landingPathForRole, normaliseRole } from "@/lib/auth/permissions"
import { getLocale } from "@/lib/i18n/server"
import { LanguageSwitcher } from "@/components/i18n/language-switcher"
import { Button } from "@/components/ui/button"
import { siteConfig } from "@/lib/site-config"

const content = {
  vi: {
    nav: ["Giải pháp", "Quy trình", "Ngành hàng"],
    signIn: "Đăng nhập",
    contact: "Trao đổi với chuyên gia",
    eyebrow: "PHÒNG KINH DOANH XUẤT KHẨU THUÊ NGOÀI",
    heroTitle: "Đưa sản phẩm Việt Nam đến đúng buyer Mỹ.",
    heroText:
      "Vexim Trade kết hợp dữ liệu buyer, năng lực sourcing và quy trình tuân thủ để giúp nhà máy Việt Nam xây dựng doanh số xuất khẩu bền vững.",
    heroCta: "Bắt đầu trao đổi",
    heroSecondary: "Xem cách chúng tôi làm việc",
    trust: "Đồng hành từ nhu cầu đầu tiên đến đơn hàng hoàn tất",
    statOne: "buyer được nghiên cứu",
    statTwo: "ngành hàng FDA",
    statThree: "một đội ngũ phụ trách",
    solutionsEyebrow: "NĂNG LỰC CỐT LÕI",
    solutionsTitle: "Một quy trình xuất khẩu rõ ràng, có thể đo lường.",
    solutionsText:
      "Thay vì thuê từng vị trí rời rạc, bạn có một đội ngũ export sales trọn gói cùng hệ thống theo dõi minh bạch.",
    solutions: [
      [Globe2, "Buyer intelligence", "Tìm đúng buyer Mỹ dựa trên dữ liệu mua hàng, ngành và tín hiệu nhu cầu thực tế."],
      [Factory, "Supplier readiness", "Chuẩn hóa hồ sơ, năng lực nhà máy và tài liệu tuân thủ trước khi giới thiệu."],
      [BarChart3, "Pipeline visibility", "Theo dõi từng cơ hội, email, phản hồi và bước tiếp theo trên một dashboard duy nhất."],
    ] as const,
    processEyebrow: "QUY TRÌNH",
    processTitle: "Từ năng lực nhà máy đến cuộc trò chuyện có giá trị.",
    process: [
      ["01", "Hiểu sản phẩm", "Đánh giá ngành hàng, chứng nhận, công suất và lợi thế cạnh tranh của doanh nghiệp."],
      ["02", "Tìm buyer phù hợp", "Nghiên cứu và ưu tiên những buyer có nhu cầu, lịch sử mua và tiêu chí phù hợp."],
      ["03", "Theo sát cơ hội", "Đồng hành cùng buyer qua requirement, shortlist, hồ sơ supplier và đàm phán."],
    ] as const,
    industriesEyebrow: "NGÀNH HÀNG",
    industriesTitle: "Chuyên sâu những ngành cần độ tin cậy cao.",
    industries: ["Thực phẩm & đồ uống", "Thực phẩm chức năng", "Mỹ phẩm & MoCRA", "Thiết bị y tế"],
    finalTitle: "Sẵn sàng xây dựng kênh xuất khẩu bài bản hơn?",
    finalText: "Hãy bắt đầu bằng một cuộc trao đổi ngắn về sản phẩm, thị trường và mục tiêu doanh số của bạn.",
    finalCta: "Liên hệ Vexim Trade",
    footerNote: "Dữ liệu thật · Giá trị thật",
  },
  en: {
    nav: ["Solutions", "How it works", "Industries"],
    signIn: "Sign in",
    contact: "Talk to an expert",
    eyebrow: "OUTSOURCED EXPORT SALES",
    heroTitle: "Bring Vietnamese products to the right U.S. buyers.",
    heroText:
      "Vexim Trade combines buyer intelligence, supplier readiness and compliance workflows to build a more predictable export sales channel for Vietnamese manufacturers.",
    heroCta: "Start a conversation",
    heroSecondary: "See how we work",
    trust: "One accountable team from first demand to completed order",
    statOne: "buyers researched",
    statTwo: "FDA-led verticals",
    statThree: "accountable team",
    solutionsEyebrow: "CORE CAPABILITIES",
    solutionsTitle: "A clearer export sales process, built to be measured.",
    solutionsText:
      "Instead of hiring disconnected roles, you get one export sales team and a transparent operating system for the whole pipeline.",
    solutions: [
      [Globe2, "Buyer intelligence", "Prioritize U.S. buyers using purchase signals, category fit and real demand context."],
      [Factory, "Supplier readiness", "Prepare factory capability, compliance documents and a credible profile before outreach."],
      [BarChart3, "Pipeline visibility", "Track every opportunity, email, response and next step in one focused dashboard."],
    ] as const,
    processEyebrow: "HOW IT WORKS",
    processTitle: "From factory capability to a valuable buyer conversation.",
    process: [
      ["01", "Understand the product", "Review category, certifications, capacity and the commercial advantage of your business."],
      ["02", "Find the right buyers", "Research and prioritize buyers with relevant demand, history and sourcing criteria."],
      ["03", "Move the opportunity forward", "Stay close through requirements, supplier shortlists, documents and negotiation."],
    ] as const,
    industriesEyebrow: "INDUSTRIES",
    industriesTitle: "Deep focus on categories where trust matters.",
    industries: ["Food & beverage", "Dietary supplements", "Cosmetics & MoCRA", "Medical devices"],
    finalTitle: "Ready for a more disciplined export channel?",
    finalText: "Start with a short conversation about your products, target market and revenue goals.",
    finalCta: "Contact Vexim Trade",
    footerNote: "Real Data · Real Value",
  },
} as const

export default async function RootPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()
    redirect(landingPathForRole(normaliseRole(profile?.role)))
  }

  const locale = await getLocale()
  const t = content[locale]

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-5 sm:px-8 lg:px-10">
          <Link href="/" className="group flex items-center gap-3" aria-label="Vexim Trade home">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-transform group-hover:-rotate-3">
              <TrendingUp className="h-5 w-5" />
            </span>
            <span className="text-base font-bold tracking-tight text-primary">Vexim Trade</span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex" aria-label="Primary navigation">
            <a href="#solutions" className="transition-colors hover:text-primary">{t.nav[0]}</a>
            <a href="#process" className="transition-colors hover:text-primary">{t.nav[1]}</a>
            <a href="#industries" className="transition-colors hover:text-primary">{t.nav[2]}</a>
          </nav>

          <div className="flex items-center gap-2">
            <LanguageSwitcher compact />
            <Button asChild variant="outline" className="hidden border-primary/20 text-primary hover:bg-primary/5 sm:inline-flex">
              <Link href="/auth/login">{t.signIn}</Link>
            </Button>
            <Button asChild className="bg-cta text-cta-foreground shadow-sm hover:bg-cta/90">
              <a href={`mailto:${siteConfig.contact.email}`}>{t.contact}</a>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative isolate overflow-hidden bg-primary text-primary-foreground">
        <div className="pointer-events-none absolute -left-32 -top-40 h-[32rem] w-[32rem] rounded-full bg-accent/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-48 right-0 h-[30rem] w-[30rem] rounded-full bg-cta/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[0.95fr_1.05fr] lg:px-10 lg:py-28">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-[11px] font-semibold tracking-[0.18em] text-sky-100">
              <span className="h-1.5 w-1.5 rounded-full bg-cta" />
              {t.eyebrow}
            </div>
            <h1 className="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-[-0.04em] text-balance sm:text-6xl lg:text-[4.25rem]">
              {t.heroTitle}
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-slate-200 sm:text-lg">
              {t.heroText}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg" className="h-12 bg-cta px-6 text-cta-foreground shadow-lg shadow-amber-950/20 hover:bg-cta/90">
                <a href={`mailto:${siteConfig.contact.email}`}>
                  {t.heroCta}
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
              <Button asChild size="lg" variant="ghost" className="h-12 text-slate-100 hover:bg-white/10 hover:text-white">
                <a href="#process">{t.heroSecondary}</a>
              </Button>
            </div>
            <div className="mt-10 flex items-center gap-3 text-sm text-slate-300">
              <CheckCircle2 className="h-5 w-5 text-accent" />
              {t.trust}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl lg:ml-auto">
            <div className="absolute -inset-4 rounded-[2rem] bg-accent/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-[1.4rem] border border-white/20 bg-white/10 p-2 shadow-2xl shadow-slate-950/30 backdrop-blur-sm">
              <div className="relative aspect-[1.08/1] overflow-hidden rounded-[1rem]">
                <Image
                  src="/landing/hero-dashboard.jpg"
                  alt="Export operations in a modern warehouse"
                  fill
                  priority
                  sizes="(max-width: 1024px) 90vw, 48vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-transparent to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-sky-100/80">Vexim operating system</p>
                    <p className="mt-1 text-lg font-semibold text-white">Demand → supplier → deal</p>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cta text-cta-foreground shadow-lg">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-5 -left-4 hidden rounded-xl border border-white/20 bg-slate-950/80 px-4 py-3 shadow-xl backdrop-blur-md sm:block">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20 text-accent"><BarChart3 className="h-4 w-4" /></span>
                <div><p className="text-[10px] uppercase tracking-wider text-slate-400">Pipeline visibility</p><p className="text-sm font-semibold text-white">Built for action</p></div>
              </div>
            </div>
            <div className="absolute -right-4 top-8 hidden rounded-xl border border-white/20 bg-white px-4 py-3 shadow-xl sm:block">
              <div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-primary" /><p className="text-sm font-semibold text-primary">Compliance-ready</p></div>
            </div>
          </div>
        </div>
        <div className="relative mx-auto grid max-w-7xl grid-cols-3 border-t border-white/10 px-5 sm:px-8 lg:px-10">
          <div className="border-r border-white/10 py-5 pr-4"><p className="text-2xl font-semibold text-white">1:1</p><p className="mt-1 text-xs text-slate-300">{t.statOne}</p></div>
          <div className="border-r border-white/10 px-4 py-5"><p className="text-2xl font-semibold text-white">4</p><p className="mt-1 text-xs text-slate-300">{t.statTwo}</p></div>
          <div className="py-5 pl-4"><p className="text-2xl font-semibold text-white">360°</p><p className="mt-1 text-xs text-slate-300">{t.statThree}</p></div>
        </div>
      </section>

      <section id="solutions" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
        <div className="max-w-2xl">
          <p className="text-xs font-bold tracking-[0.2em] text-primary">{t.solutionsEyebrow}</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-primary sm:text-4xl">{t.solutionsTitle}</h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">{t.solutionsText}</p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {t.solutions.map(([Icon, title, text]) => (
            <article key={title} className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-accent/60 hover:shadow-xl hover:shadow-primary/5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-primary transition-colors group-hover:bg-accent group-hover:text-primary"><Icon className="h-5 w-5" /></div>
              <h3 className="mt-6 text-lg font-semibold text-primary">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="process" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <div>
              <p className="text-xs font-bold tracking-[0.2em] text-primary">{t.processEyebrow}</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-primary sm:text-4xl">{t.processTitle}</h2>
            </div>
            <div className="space-y-8">
              {t.process.map(([number, title, text]) => (
                <div key={number} className="flex gap-5 border-b border-border pb-8 last:border-0 last:pb-0">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{number}</span>
                  <div><h3 className="text-lg font-semibold text-primary">{title}</h3><p className="mt-2 max-w-xl text-sm leading-7 text-muted-foreground">{text}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="industries" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div><p className="text-xs font-bold tracking-[0.2em] text-primary">{t.industriesEyebrow}</p><h2 className="mt-4 text-3xl font-semibold tracking-tight text-primary sm:text-4xl">{t.industriesTitle}</h2></div>
          <Handshake className="hidden h-12 w-12 text-accent sm:block" />
        </div>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {t.industries.map((industry) => <div key={industry} className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-4 text-sm font-medium text-primary shadow-sm"><CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />{industry}</div>)}
        </div>
      </section>

      <section className="mx-5 mb-10 overflow-hidden rounded-[1.5rem] bg-primary sm:mx-8 lg:mx-auto lg:mb-16 lg:max-w-7xl">
        <div className="relative px-6 py-14 sm:px-12 sm:py-16 lg:px-16">
          <div className="pointer-events-none absolute -right-20 -top-32 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />
          <div className="relative max-w-2xl"><p className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{t.finalTitle}</p><p className="mt-4 max-w-xl leading-7 text-slate-300">{t.finalText}</p><Button asChild size="lg" className="mt-8 bg-cta text-cta-foreground shadow-lg hover:bg-cta/90"><a href={`mailto:${siteConfig.contact.email}`}>{t.finalCta}<ArrowRight className="h-4 w-4" /></a></Button></div>
        </div>
      </section>

      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <div className="flex items-center gap-2 font-semibold text-primary"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground"><TrendingUp className="h-4 w-4" /></span>Vexim Trade</div>
          <p>{t.footerNote}</p>
          <p>© {new Date().getFullYear()} Vexim Trade</p>
        </div>
      </footer>
    </main>
  )
}
