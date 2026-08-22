"use client"

import type { ReactNode } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProfileProducts } from "./profile-products"
import { ProfileCertifications } from "./profile-certifications"
import type { PublicCapability } from "@/lib/assessment/actions"
import type { ClientProfileWithRelations } from "@/lib/supabase/types"

interface ProfileTabsProps {
  profile: ClientProfileWithRelations
  capability: PublicCapability | null
}

const QUALITY_SYSTEM_LABELS: Record<string, string> = {
  HACCP: "HACCP",
  GMP: "GMP",
  ISO22000: "ISO 22000",
  SOP: "Quy trình vận hành nội bộ (SOP)",
  QC: "Quy trình kiểm soát chất lượng (QC)",
}

const TRACEABILITY_LABELS: Record<string, string> = {
  lot: "Truy xuất theo lô (Lot)",
  input: "Ghi nhận nguyên liệu đầu vào",
  finished: "Ghi nhận thành phẩm đầu ra",
  recall: "Quy trình thu hồi sản phẩm",
  "batch-lot": "Mã hóa theo Batch/Lot",
}

const AUDIT_LABELS: Record<string, string> = {
  onsite: "Chấp nhận kiểm tra thực tế nhà máy",
  online: "Hỗ trợ kiểm tra trực tuyến",
}

const MARKET_LABELS: Record<string, string> = {
  US: "Hoa Kỳ",
  EU: "Liên minh Châu Âu",
  JP: "Nhật Bản",
  KR: "Hàn Quốc",
  CN: "Trung Quốc",
  ASEAN: "ASEAN",
  ME: "Trung Đông",
}

function InfoGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-foreground mb-3">{title}</h3>
      <div className="rounded-lg border border-border bg-card divide-y divide-border/60 px-4 sm:px-5">
        {children}
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 py-3">
      <span className="text-sm text-muted-foreground sm:w-56 shrink-0">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}

function ChipsRow({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="py-3">
      <p className="text-sm text-muted-foreground mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * Tab "Ho So cong ty" / "San pham" — gop lai noi dung tu ProfileDescription,
 * ProfileUSP, ProfileStats, ProfileCapabilities, ProfileCertifications thanh
 * bang label/value 2 cot theo tung nhom, va ProfileProducts trong tab rieng.
 * Khong thay doi nguon du lieu, chi to chuc lai noi render + style.
 */
export function ProfileTabs({ profile, capability }: ProfileTabsProps) {
  const quality = (capability?.quality_systems ?? [])
    .map((q) => QUALITY_SYSTEM_LABELS[q])
    .filter((label): label is string => Boolean(label))

  const traceability = (capability?.traceability ?? [])
    .filter((t) => t !== "none")
    .map((t) => TRACEABILITY_LABELS[t])
    .filter((label): label is string => Boolean(label))

  const audit = (capability?.audit_readiness ?? [])
    .filter((a) => a !== "not-ready")
    .map((a) => AUDIT_LABELS[a])
    .filter((label): label is string => Boolean(label))

  const foodSafety = [
    capability?.food_safety_training_regular ? "Đào tạo an toàn thực phẩm định kỳ" : null,
    capability?.equipment_calibration_regular ? "Kiểm định máy móc định kỳ" : null,
    capability?.water_testing ? "Nguồn nước được kiểm định định kỳ" : null,
  ].filter((item): item is string => Boolean(item))

  const markets = (capability?.export_markets ?? [])
    .map((m) => MARKET_LABELS[m] ?? m)
    .filter((m) => m !== "other")

  const incoterms = capability?.incoterms ?? []
  const oem = (capability?.oem_odm ?? []).filter((o) => o !== "none")

  const hasCertifications = (profile.certifications || []).length > 0
  const uspPoints = profile.usp_points || []

  const yearsOnVexim = (() => {
    const startYear = capability?.export_since_year || new Date(profile.created_at).getFullYear()
    const years = new Date().getFullYear() - startYear
    return years > 0 ? years : null
  })()

  const hasOverview = Boolean(
    profile.description ||
      capability?.export_since_year ||
      capability?.company_scale ||
      profile.profiles.country ||
      uspPoints.length > 0
  )
  const hasProduction = Boolean(
    profile.production_capacity || profile.moq || profile.lead_time_days
  )
  const hasQuality =
    quality.length > 0 ||
    traceability.length > 0 ||
    audit.length > 0 ||
    foodSafety.length > 0 ||
    hasCertifications
  const hasTrade = markets.length > 0 || incoterms.length > 0 || oem.length > 0
  const hasAnyCompanyInfo = hasOverview || hasProduction || hasQuality || hasTrade

  return (
    <section className="py-8 sm:py-12 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <Tabs defaultValue="company" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="company">Hồ Sơ công ty</TabsTrigger>
            <TabsTrigger value="products">Sản phẩm</TabsTrigger>
          </TabsList>

          <TabsContent value="company" className="space-y-8">
            {hasOverview && (
              <InfoGroup title="Tổng quan">
                {profile.description && (
                  <div className="py-3">
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                      {profile.description}
                    </p>
                  </div>
                )}
                {profile.profiles.country && (
                  <InfoRow label="Địa điểm" value={profile.profiles.country} />
                )}
                {capability?.export_since_year && (
                  <InfoRow
                    label="Năm bắt đầu xuất khẩu"
                    value={capability.export_since_year}
                  />
                )}
                {yearsOnVexim && (
                  <InfoRow label="Số năm trên Vexim" value={`${yearsOnVexim} năm`} />
                )}
                {capability?.company_scale && (
                  <InfoRow label="Quy mô công ty" value={capability.company_scale} />
                )}
                {uspPoints.length > 0 && (
                  <ChipsRow
                    label="Điểm nổi bật"
                    items={uspPoints.map((p) => p.title).filter(Boolean)}
                  />
                )}
              </InfoGroup>
            )}

            {hasProduction && (
              <InfoGroup title="Năng lực sản xuất">
                {profile.production_capacity && (
                  <InfoRow label="Công suất sản xuất" value={profile.production_capacity} />
                )}
                {profile.moq && <InfoRow label="Số lượng đặt hàng tối thiểu (MOQ)" value={profile.moq} />}
                {profile.lead_time_days && (
                  <InfoRow label="Thời gian giao hàng" value={profile.lead_time_days} />
                )}
              </InfoGroup>
            )}

            {hasQuality && (
              <InfoGroup title="Kiểm soát chất lượng">
                <ChipsRow label="Hệ thống chất lượng" items={quality} />
                <ChipsRow label="Truy xuất nguồn gốc" items={traceability} />
                <ChipsRow label="Sẵn sàng kiểm tra" items={audit} />
                <ChipsRow label="An toàn thực phẩm & thiết bị" items={foodSafety} />
                {hasCertifications && (
                  <div className="py-3 -mx-4 sm:-mx-5">
                    <ProfileCertifications profile={profile} />
                  </div>
                )}
              </InfoGroup>
            )}

            {hasTrade && (
              <InfoGroup title="Kinh nghiệm thương mại">
                <ChipsRow label="Thị trường xuất khẩu" items={markets} />
                <ChipsRow label="Điều khoản Incoterms" items={incoterms} />
                <ChipsRow label="OEM / ODM" items={oem} />
              </InfoGroup>
            )}

            {!hasAnyCompanyInfo && (
              <p className="text-sm text-muted-foreground text-center py-12">
                Chưa có thông tin hồ sơ công ty.
              </p>
            )}
          </TabsContent>

          <TabsContent value="products">
            <ProfileProducts profile={profile} />
            {(!profile.products || profile.products.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-12">
                Chưa có sản phẩm nào được đăng.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </section>
  )
}
