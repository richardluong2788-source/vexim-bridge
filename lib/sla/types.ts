/**
 * Shared type definitions for the SLA tracking feature.
 *
 * Naming mirrors the §7.3 contract clauses:
 *   M1 pipeline_update_response
 *   M2 monthly_qualified_leads
 *   M3 monthly_email_outreach
 *   M4 client_request_response
 *   M5 swift_verification_lag
 *   M6 fda_renewal_alert
 *   M7 monthly_status_report
 */

export const SLA_METRIC_KEYS = [
  "pipeline_update_response",
  "monthly_qualified_leads",
  "monthly_email_outreach",
  "client_request_response",
  "swift_verification_lag",
  "fda_renewal_alert",
  "monthly_status_report",
] as const

export type SlaMetricKey = (typeof SLA_METRIC_KEYS)[number]

/**
 * Comparison direction for a metric:
 *   "max" — measured ≤ target is compliant (response time, lag in days)
 *   "min" — measured ≥ target is compliant (lead/email volumes)
 *   "boolean" — measured = target (1) is compliant (monthly report sent)
 */
export type SlaDirection = "max" | "min" | "boolean"

/** Display unit for the target/measured number. */
export type SlaUnit = "hours" | "business_days" | "count" | "days" | "boolean"

export interface SlaMetricMeta {
  key: SlaMetricKey
  /** Vietnamese label, used in the admin dashboard and client portal. */
  labelVi: string
  /** English fallback for clients with preferred_language=en. */
  labelEn: string
  /** Short description shown beside the score chip. */
  descVi: string
  descEn: string
  direction: SlaDirection
  unit: SlaUnit
  /**
   * Whether this metric produces at most one row per client per month
   * (monthly aggregate) or potentially many (per offending event).
   */
  perEvent: boolean
}

export const SLA_METRIC_META: Record<SlaMetricKey, SlaMetricMeta> = {
  pipeline_update_response: {
    key: "pipeline_update_response",
    labelVi: "Cập nhật pipeline",
    labelEn: "Pipeline updates",
    descVi:
      "Mỗi opportunity active phải được cập nhật trong 1 ngày làm việc kể từ thay đổi gần nhất.",
    descEn:
      "Each active opportunity must be updated within 1 business day of the last change.",
    direction: "max",
    unit: "hours",
    perEvent: true,
  },
  monthly_qualified_leads: {
    key: "monthly_qualified_leads",
    labelVi: "Lead đủ điều kiện / tháng",
    labelEn: "Qualified leads / month",
    descVi:
      "Số opportunity được nâng cấp khỏi giai đoạn 'new' trong tháng phải đạt mức cam kết.",
    descEn:
      "Count of opportunities qualified out of the 'new' stage during the month must hit the plan threshold.",
    direction: "min",
    unit: "count",
    perEvent: false,
  },
  monthly_email_outreach: {
    key: "monthly_email_outreach",
    labelVi: "Email gửi tới buyer",
    labelEn: "Buyer emails sent",
    descVi:
      "Số email đã gửi (status='sent') tới buyer trong tháng cho client phải đạt mức cam kết.",
    descEn:
      "Buyer emails marked as sent during the month for this client must hit the plan threshold.",
    direction: "min",
    unit: "count",
    perEvent: false,
  },
  client_request_response: {
    key: "client_request_response",
    labelVi: "Phản hồi yêu cầu của client",
    labelEn: "Client request response",
    descVi:
      "Mỗi yêu cầu của client phải được phản hồi đầu tiên trong 24 giờ làm việc.",
    descEn:
      "Each client request must receive its first response within 24 business hours.",
    direction: "max",
    unit: "hours",
    perEvent: true,
  },
  swift_verification_lag: {
    key: "swift_verification_lag",
    labelVi: "Xác minh Swift",
    labelEn: "Swift verification",
    descVi:
      "Swift wire copy phải được verify trong 2 ngày làm việc kể từ khi upload.",
    descEn:
      "Swift wire copies must be verified within 2 business days of upload.",
    direction: "max",
    unit: "business_days",
    perEvent: true,
  },
  fda_renewal_alert: {
    key: "fda_renewal_alert",
    labelVi: "Cảnh báo gia hạn FDA",
    labelEn: "FDA renewal alert",
    descVi:
      "Khi FDA của client sắp hết hạn, hệ thống phải gửi cảnh báo trước ít nhất 90 ngày.",
    descEn:
      "When a client's FDA approaches expiry, an alert must be sent at least 90 days in advance.",
    direction: "min",
    unit: "days",
    perEvent: false,
  },
  monthly_status_report: {
    key: "monthly_status_report",
    labelVi: "Báo cáo tháng",
    labelEn: "Monthly status report",
    descVi:
      "Báo cáo tổng hợp tháng phải được gửi tới client trước mùng 5 tháng kế tiếp.",
    descEn:
      "The monthly digest report must be delivered before the 5th of the following month.",
    direction: "boolean",
    unit: "boolean",
    perEvent: false,
  },
}

// ---------------------------------------------------------------------
// Row shapes — match the tables in scripts/031_sla_tracking.sql.
// ---------------------------------------------------------------------

export interface SlaTarget {
  id: string
  billing_plan_id: string | null
  metric_key: SlaMetricKey
  target_value: number
  weight: number
  penalty_usd_cents: number
  active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface SlaViolation {
  id: string
  client_id: string
  billing_plan_id: string | null
  sla_target_id: string | null
  metric_key: SlaMetricKey
  period_month: string // 'YYYY-MM-DD' (1st of month)
  occurrence_in_month: number
  measured_value: number
  target_value: number
  delta: number
  source_kind: string | null
  source_id: string | null
  status: "logged" | "pending_review" | "overridden" | "applied" | "waived"
  detail: Record<string, unknown> | null
  detected_at: string
}

export interface ClientRequestRow {
  id: string
  client_id: string
  channel:
    | "portal"
    | "email"
    | "zalo"
    | "phone"
    | "whatsapp"
    | "other"
  subject: string
  body: string | null
  priority: "low" | "normal" | "high" | "urgent"
  received_at: string
  first_response_at: string | null
  first_response_by: string | null
  first_response_note: string | null
  resolved_at: string | null
  status: "open" | "in_progress" | "resolved" | "closed"
  logged_by: string | null
  logged_via_channel: boolean
  created_at: string
  updated_at: string
}

export interface SlaHoliday {
  holiday_date: string // 'YYYY-MM-DD'
  label: string
  country: string
}

export interface SlaEvaluationRun {
  period_month: string
  started_at: string
  completed_at: string | null
  status: "running" | "completed" | "failed"
  triggered_by: string
  scanned_clients: number
  violations_inserted: number
  error_message: string | null
}

/**
 * Aggregate row from the sla_monthly_summary view.
 */
export interface SlaMonthlyRow {
  client_id: string
  period_month: string
  metric_key: SlaMetricKey
  violations: number
  total_delta: number
  last_detected_at: string
}

/**
 * Result of evaluating a single (client, metric) pair for a given month.
 * The cron writes violations from this; the dashboard renders them.
 */
export interface MetricEvaluation {
  metricKey: SlaMetricKey
  targetValue: number
  /**
   * For per-event metrics: count of failing events.
   * For aggregate metrics: the actual count/days/etc.
   * For boolean: 0 or 1.
   */
  measuredValue: number
  /** Number of newly-detected violations on this run. */
  newViolations: number
  /** Optional human-readable breakdown for the admin UI. */
  detail?: Record<string, unknown>
}
