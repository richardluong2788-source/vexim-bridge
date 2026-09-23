import Link from "next/link"
import { CheckCircle2, Clock, ShieldCheck, TrendingUp } from "lucide-react"
import { getLocale } from "@/lib/i18n/server"
import { localizePath } from "@/lib/i18n/routing"
import { localizedAlternates } from "@/lib/seo/alternates"
import { siteConfig } from "@/lib/site-config"
import { Button } from "@/components/ui/button"
import type { Metadata } from "next"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const title = locale === "vi" ? "Cách Vexim sàng lọc NCC | Vexim Trade" : "How Vexim Screens Suppliers | Vexim Trade"
  const description =
    locale === "vi"
      ? "Tìm hiểu quy trình 7 bước sàng lọc NCC của Vexim: định danh, năng lực, lịch sử xuất khẩu, chứng chỉ, tuân thủ FDA/MoCRA, mẫu và phù hợp thương mại."
      : "Learn about Vexim's 7-step supplier screening: identity, capability, export history, certifications, FDA/MoCRA readiness, sample review and commercial fit."
  return {
    title,
    description,
    alternates: localizedAlternates("/how-we-verify", { bilingual: true, locale }),
  }
}

export default async function HowWeVerifyPage() {
  const locale = await getLocale()
  const vi = locale === "vi"

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-5 px-5 sm:px-8 lg:px-10">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <TrendingUp className="h-5 w-5" />
            </span>
            <span className="text-base font-bold tracking-tight text-primary">Vexim Trade</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="border-primary/20">
              <Link href={localizePath("/products", locale)}>{vi ? "Xem NCC" : "Browse suppliers"}</Link>
            </Button>
            <Button asChild className="bg-cta text-cta-foreground hover:bg-cta/90">
              <Link href={localizePath("/#sourcing-request", locale)}>{vi ? "Gửi yêu cầu" : "Submit request"}</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-5 py-16 sm:px-8 lg:py-24">
        <p className="text-xs font-bold tracking-[0.2em] text-primary">VERIFICATION METHODOLOGY</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-primary sm:text-5xl">
          {vi ? "Cách chúng tôi sàng lọc nhà cung cấp" : "How we screen suppliers"}
        </h1>
        <p className="mt-6 text-lg leading-8 text-muted-foreground">
          {vi
            ? "Vexim không bán danh sách NCC. Chúng tôi bán quy trình giảm uncertainty giữa buyer Mỹ và NCC Việt Nam. Dưới đây là chính xác những gì chúng tôi kiểm tra, bằng dữ liệu nào, và mức độ xác minh có ý nghĩa gì."
            : "Vexim does not sell a supplier list. We provide a process to reduce uncertainty between U.S. buyers and Vietnamese suppliers. Here is exactly what we check, with what data, and what verification levels mean."}
        </p>

        <div className="mt-12 rounded-2xl border border-border bg-card p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-primary">{vi ? "Nguyên tắc" : "Principles"}</h2>
          <ul className="mt-4 space-y-3 text-sm leading-7 text-muted-foreground">
            <li className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" /> <span><strong className="text-primary">Bold on process, conservative on claims:</strong> {vi ? "Chúng tôi nói rõ đã kiểm tra gì, không hứa zero rủi ro." : "We state what was checked, not zero risk."}</span></li>
            <li className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" /> <span><strong className="text-primary">Commercial participation does not replace screening:</strong> {vi ? "NCC trả phí dịch vụ không mua được trạng thái Verified." : "Paying for services does not buy Verified status."}</span></li>
            <li className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" /> <span><strong className="text-primary">Evidence over badge:</strong> {vi ? "Thay vì badge 'FDA Registered', chúng tôi hiển thị 'FDA registration reviewed on DATE'." : "Instead of 'FDA Registered' badge, we show 'FDA registration reviewed on DATE'."}</span></li>
          </ul>
        </div>

        <div className="mt-16">
          <h2 className="text-2xl font-semibold text-primary">{vi ? "Quy trình 7 bước" : "7-step screening process"}</h2>
          <div className="mt-8 space-y-6">
            {[
              {
                step: "01",
                title: vi ? "Định danh nhà máy" : "Factory Identity",
                what: vi ? "Pháp nhân, giấy phép KD, địa chỉ, chủ sở hữu, liên hệ" : "Legal entity, business license, address, ownership, contact",
                how: vi ? "Đối chiếu giấy tờ, tra cứu công khai, xác minh liên hệ" : "Document cross-check, public records, contact verification",
              },
              {
                step: "02",
                title: vi ? "Năng lực sản xuất" : "Production Capability",
                what: vi ? "Sản phẩm, công suất, MOQ, thiết bị" : "Products, capacity, MOQ, equipment",
                how: vi ? "Hồ sơ NCC cung cấp + đối chiếu chéo" : "Supplier dossier + cross-reference",
              },
              {
                step: "03",
                title: vi ? "Lịch sử xuất khẩu" : "Export History",
                what: vi ? "Hồ sơ lô hàng, thị trường xuất khẩu" : "Shipment history, export markets",
                how: vi ? "Dữ liệu hải quan hiện có, khi có sẵn" : "Available customs data where available",
              },
              {
                step: "04",
                title: vi ? "Chứng chỉ" : "Certifications",
                what: vi ? "ISO, HACCP, GMP/cGMP..." : "ISO, HACCP, GMP/cGMP...",
                how: vi ? "Rà soát bản sao chứng chỉ, ngày hết hạn" : "Certificate copy review, expiry check",
              },
              {
                step: "05",
                title: vi ? "Sẵn sàng tuân thủ Mỹ" : "U.S. Compliance Readiness",
                what: vi ? "FDA facility registration, MoCRA, nhãn" : "FDA facility registration, MoCRA, labeling",
                how: vi ? "Kiểm tra đăng ký, rà soát nhãn - không phải tư vấn pháp lý" : "Registration check, labeling review - not legal advice. FDA clarifies registration is not approval.",
              },
              {
                step: "06",
                title: vi ? "Sản phẩm & mẫu" : "Product & Sample Review",
                what: vi ? "Thông số, bao bì, mẫu" : "Specs, packaging, sample",
                how: vi ? "Đánh giá tài liệu và mẫu khi có sẵn" : "Document and sample evaluation where available",
              },
              {
                step: "07",
                title: vi ? "Giao tiếp & phù hợp" : "Communication & Fit",
                what: vi ? "Phản hồi, sẵn sàng xuất khẩu" : "Responsiveness, export readiness",
                how: vi ? "Đánh giá trong quá trình làm việc" : "Assessed during engagement",
              },
            ].map((item) => (
              <div key={item.step} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">{item.step}</span>
                  <h3 className="text-base font-semibold text-primary">{item.title}</h3>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
                  <div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">What we check</p><p className="mt-1 text-primary">{item.what}</p></div>
                  <div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">How we check</p><p className="mt-1 text-muted-foreground">{item.how}</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 rounded-2xl bg-primary p-6 sm:p-8 text-primary-foreground">
          <h2 className="text-xl font-semibold text-white">{vi ? "Mức độ xác minh" : "Verification levels"}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            {vi ? "Mỗi hồ sơ hiển thị mức độ đã đạt được:" : "Each profile shows the level achieved:"}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <p className="font-semibold text-white">Screened</p>
              <p className="mt-1 text-sm text-slate-300">{vi ? "Thông tin cơ bản đã được rà soát" : "Basic information reviewed"}</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <p className="font-semibold text-white">Data Reviewed</p>
              <p className="mt-1 text-sm text-slate-300">{vi ? "Lịch sử xuất khẩu và năng lực đã rà soát" : "Export history and capability reviewed"}</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <p className="font-semibold text-white">Compliance Reviewed</p>
              <p className="mt-1 text-sm text-slate-300">{vi ? "Yêu cầu FDA/MoCRA đã được rà soát" : "FDA/MoCRA requirements reviewed"}</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <p className="font-semibold text-white">On-site Verified</p>
              <p className="mt-1 text-sm text-slate-300">{vi ? "Đã thực hiện xác minh tại chỗ" : "On-site verification conducted"}</p>
            </div>
          </div>
          <p className="mt-6 text-xs leading-5 text-slate-400">
            {vi
              ? "Lưu ý: Mức độ xác minh không phải là bảo đảm. FDA làm rõ rằng đăng ký/listing cơ sở không phải là phê duyệt của FDA và FDA không cấp chứng chỉ để xác minh tuân thủ cho việc đăng ký/listing."
              : "Note: Verification levels are not a guarantee. FDA clarifies that facility registration/listing is not FDA approval and FDA does not issue certificates to verify compliance for registration/listing."}
          </p>
        </div>

        <div className="mt-16 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="bg-cta text-cta-foreground hover:bg-cta/90">
            <Link href={localizePath("/#sourcing-request", locale)}>{vi ? "Gửi yêu cầu sourcing" : "Submit sourcing request"}</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href={localizePath("/products", locale)}>{vi ? "Xem NCC đã sàng lọc" : "Browse screened suppliers"}</Link>
          </Button>
        </div>

        <div className="mt-12 text-xs leading-5 text-muted-foreground">
          <p>Last updated: Sep 2026</p>
          <p className="mt-2">Contact: {siteConfig.contact.email} | {siteConfig.contact.hotline}</p>
        </div>
      </section>
    </main>
  )
}
