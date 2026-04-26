/**
 * SLA Health Score — pure functions, no DB access.
 *
 * Scoring model (Sprint 1 — simple 3-tier):
 *   GREEN  = 0 violations on the metric for the period   → 100 points
 *   YELLOW = 1-2 violations                              →  60 points
 *   RED    = 3+ violations                               →  20 points
 *
 * Per-client overall score = weighted average across the 7 metrics, with
 * weights coming from sla_targets.weight (defaults to 1/7 each).
 *
 * Why a step function instead of continuous? It is more legible to
 * non-technical users (admin/finance) and avoids over-rewarding clients
 * with tiny breaches.
 */

import type { SlaMetricKey, SlaTarget } from "@/lib/sla/types"

export type SlaTier = "green" | "yellow" | "red" | "untracked"

export interface MetricScore {
  metricKey: SlaMetricKey
  violations: number
  weight: number
  tier: SlaTier
  points: number // 0–100 contribution from this metric
}

export interface ClientScoreInput {
  /**
   * Map metric -> violation count for the period being scored.
   * Missing entries are treated as zero violations.
   */
  violationsByMetric: Partial<Record<SlaMetricKey, number>>
  /**
   * Active SLA targets for the client (plan-specific overrides + defaults
   * already resolved). Used purely for weights here.
   */
  targets: SlaTarget[]
}

export interface ClientScoreResult {
  /** Weighted 0-100 score; null if no targets are configured at all. */
  score: number | null
  metrics: MetricScore[]
  tier: SlaTier
}

const POINTS_BY_TIER: Record<SlaTier, number> = {
  green: 100,
  yellow: 60,
  red: 20,
  untracked: 0,
}

export function tierForViolations(v: number): SlaTier {
  if (v <= 0) return "green"
  if (v <= 2) return "yellow"
  return "red"
}

export function computeClientScore(input: ClientScoreInput): ClientScoreResult {
  // Take the latest target row per metric (callers pass the resolved ones).
  const metrics: MetricScore[] = []
  let totalWeight = 0
  let weightedPoints = 0

  for (const t of input.targets) {
    const violations = input.violationsByMetric[t.metric_key] ?? 0
    const tier = tierForViolations(violations)
    const points = POINTS_BY_TIER[tier]
    const weight = Number(t.weight ?? 0)
    metrics.push({
      metricKey: t.metric_key,
      violations,
      weight,
      tier,
      points,
    })
    totalWeight += weight
    weightedPoints += weight * points
  }

  if (totalWeight === 0) {
    return { score: null, metrics, tier: "untracked" }
  }

  const score = Math.round((weightedPoints / totalWeight) * 10) / 10
  const tier: SlaTier = score >= 85 ? "green" : score >= 60 ? "yellow" : "red"
  return { score, metrics, tier }
}

/** Tailwind-class accent for a tier. Reusable across client + admin UI. */
export function tierBadgeClass(tier: SlaTier): string {
  switch (tier) {
    case "green":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
    case "yellow":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
    case "red":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
    case "untracked":
    default:
      return "bg-muted text-muted-foreground border-border"
  }
}

export function tierLabelVi(tier: SlaTier): string {
  switch (tier) {
    case "green":
      return "Đạt"
    case "yellow":
      return "Cảnh báo"
    case "red":
      return "Vi phạm"
    case "untracked":
    default:
      return "Chưa theo dõi"
  }
}
