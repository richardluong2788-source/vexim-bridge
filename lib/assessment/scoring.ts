import type { ClientFactoryAssessment } from "@/lib/supabase/types"

// ============================================================
// Factory Assessment Scoring (100 diem -> A/B/C/D)
// ============================================================

export interface ScoreCategory {
  key: string
  label: string
  score: number
  max: number
}

export interface ScoreResult {
  total: number
  grade: "A" | "B" | "C" | "D"
  breakdown: ScoreCategory[]
}

export interface FdaInfo {
  fda_registration_number: string | null
  fda_expires_at: string | null
}

const has = (arr: string[] | null | undefined, v: string) =>
  Array.isArray(arr) && arr.includes(v)

export function gradeFromScore(total: number): "A" | "B" | "C" | "D" {
  if (total >= 80) return "A"
  if (total >= 60) return "B"
  if (total >= 40) return "C"
  return "D"
}

export function computeScore(
  a: Partial<ClientFactoryAssessment>,
  fda: FdaInfo
): ScoreResult {
  const breakdown: ScoreCategory[] = []

  // 1. Chung nhan / QLCL (20d)
  let qs = 0
  if (has(a.quality_systems, "HACCP")) qs += 6
  if (has(a.quality_systems, "GMP")) qs += 6
  if (has(a.quality_systems, "ISO22000")) qs += 6
  if (has(a.quality_systems, "SOP")) qs += 2
  if (has(a.quality_systems, "QC")) qs += 2
  qs = Math.min(qs, 20)
  breakdown.push({ key: "quality", label: "Chứng nhận / QLCL", score: qs, max: 20 })

  // 2. Kinh nghiem xuat khau (15d)
  let ex = 0
  if (a.export_since_year) ex += 5
  if (has(a.export_markets, "US")) ex += 10
  else if (has(a.export_markets, "EU") || has(a.export_markets, "JP")) ex += 5
  ex = Math.min(ex, 15)
  breakdown.push({ key: "export", label: "Kinh nghiệm xuất khẩu", score: ex, max: 15 })

  // 3. FDA (10d)
  let fdaScore = 0
  if (fda.fda_registration_number) {
    const expired = fda.fda_expires_at
      ? new Date(fda.fda_expires_at).getTime() < Date.now()
      : false
    fdaScore = expired ? 4 : 10
  }
  breakdown.push({ key: "fda", label: "Đăng ký FDA", score: fdaScore, max: 10 })

  // 4. Truy xuat nguon goc (10d)
  const trace = (a.traceability ?? []).filter((t) => t !== "none").length
  const traceScore = Math.min(trace * 2, 10)
  breakdown.push({ key: "trace", label: "Truy xuất nguồn gốc", score: traceScore, max: 10 })

  // 5. Buyer Audit (10d)
  let audit = 0
  if (has(a.audit_readiness, "onsite")) audit += 6
  if (has(a.audit_readiness, "online")) audit += 4
  audit = Math.min(audit, 10)
  breakdown.push({ key: "audit", label: "Sẵn sàng Buyer Audit", score: audit, max: 10 })

  // 6. Nang luc thuong mai (10d)
  const inco = Math.min((a.incoterms ?? []).length * 2, 6)
  const pay = a.payment_policy && a.payment_policy.trim() !== "" ? 4 : 0
  breakdown.push({
    key: "trade",
    label: "Năng lực thương mại",
    score: inco + pay,
    max: 10,
  })

  // 7. Nhan su (10d)
  let staff = 0
  if (a.has_export_dept) staff += 5
  if (a.has_english_staff) staff += 5
  breakdown.push({ key: "staff", label: "Nhân sự xuất khẩu", score: staff, max: 10 })

  // 8. OEM/ODM (5d)
  const oem = (a.oem_odm ?? []).some((o) => o !== "none") ? 5 : 0
  breakdown.push({ key: "oem", label: "Năng lực OEM/ODM", score: oem, max: 5 })

  // 9. Quy mo (5d)
  const scale = a.company_scale && a.company_scale.trim() !== "" ? 5 : 0
  breakdown.push({ key: "scale", label: "Quy mô doanh nghiệp", score: scale, max: 5 })

  // 10. Cam ket (5d)
  let commit = 0
  if ((a.commitments ?? []).length >= 3) commit += 3
  if (a.project_priority === "high") commit += 2
  breakdown.push({ key: "commit", label: "Cam kết triển khai", score: commit, max: 5 })

  // 11. Lao dong & moi truong (10d)
  let labor = 0
  // Gio lam viec hop ly: <=8h/ngay va <=6 ngay/tuan (chong lao dong cuong buc/qua gio)
  if (a.work_hours_start && a.work_hours_end) {
    const [sh, sm] = a.work_hours_start.split(":").map(Number)
    const [eh, em] = a.work_hours_end.split(":").map(Number)
    if (!Number.isNaN(sh) && !Number.isNaN(eh)) {
      let hours = eh + em / 60 - (sh + sm / 60)
      if (hours < 0) hours += 24
      if (hours <= 8.5) labor += 2
    }
  }
  if (a.work_days_per_week != null && a.work_days_per_week <= 6) labor += 1
  if (a.food_safety_training_regular) labor += 2
  if (a.equipment_calibration_regular) labor += 2
  if (has(a.water_source, "municipal") || has(a.water_source, "filtered")) labor += 1
  if (a.water_testing) labor += 1
  if (a.near_pollution_source === false) labor += 1
  labor = Math.min(labor, 10)
  breakdown.push({ key: "labor_env", label: "Lao động & môi trường", score: labor, max: 10 })

  // Chuan hoa ve thang 100 (tong max cac hang muc hien la 110 sau khi
  // them "Lao dong & moi truong") de nguong xep hang A/B/C/D khong doi.
  const rawTotal = breakdown.reduce((s, c) => s + c.score, 0)
  const maxTotal = breakdown.reduce((s, c) => s + c.max, 0)
  const total = maxTotal > 0 ? Math.round((rawTotal / maxTotal) * 100) : 0
  return { total, grade: gradeFromScore(total), breakdown }
}

// Nhan tieng Viet cho grade
export const GRADE_LABELS: Record<string, string> = {
  A: "Xuất sắc — sẵn sàng ký",
  B: "Tốt — cần bổ sung ít",
  C: "Trung bình — cần hỗ trợ",
  D: "Yếu — chưa sẵn sàng",
}

export const GRADE_COLORS: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-800 border-emerald-200",
  B: "bg-blue-100 text-blue-800 border-blue-200",
  C: "bg-amber-100 text-amber-800 border-amber-200",
  D: "bg-red-100 text-red-800 border-red-200",
}
