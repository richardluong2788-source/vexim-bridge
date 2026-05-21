"use server"

/**
 * Readiness Assessment Server Actions
 *
 * Các server actions để quản lý quá trình đánh giá mức độ sẵn sàng xuất khẩu
 * của client thông qua wizard onboarding.
 */

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  analyzeReadiness,
  calculateTier,
} from "@/lib/ai/readiness-coach"
import type {
  AssessmentAnswers,
  ReadinessAssessment,
  AssessmentStatus,
} from "@/lib/types/readiness"

// ============================================================
// Types
// ============================================================

type ActionError =
  | "notAuthenticated"
  | "notClient"
  | "invalidInput"
  | "dbError"
  | "notFound"
  | "assessmentCompleted"
  | "analysisError"

export interface StartAssessmentResult {
  ok: boolean
  error?: ActionError
  assessmentId?: string
}

export interface SaveAnswersResult {
  ok: boolean
  error?: ActionError
}

export interface CompleteAssessmentResult {
  ok: boolean
  error?: ActionError
  assessment?: ReadinessAssessment
}

export interface GetAssessmentResult {
  ok: boolean
  error?: ActionError
  assessment?: ReadinessAssessment
}

// ============================================================
// Start Assessment
// ============================================================

/**
 * Khởi tạo assessment mới cho client.
 * Nếu đã có assessment in_progress, trả về assessment đó.
 */
export async function startAssessmentAction(): Promise<StartAssessmentResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: "notAuthenticated" }
  }

  // Check if user is a client
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "client") {
    return { ok: false, error: "notClient" }
  }

  const admin = createAdminClient()

  // Check for existing in-progress assessment
  const { data: existing } = await admin
    .from("export_readiness_assessments")
    .select("id")
    .eq("client_id", user.id)
    .eq("status", "in_progress")
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (existing) {
    return { ok: true, assessmentId: existing.id }
  }

  // Create new assessment
  const { data: newAssessment, error: insertErr } = await admin
    .from("export_readiness_assessments")
    .insert({
      client_id: user.id,
      status: "in_progress",
      current_step: 1,
      answers: {},
    })
    .select("id")
    .single()

  if (insertErr || !newAssessment) {
    console.error("[v0] startAssessmentAction db error:", insertErr)
    return { ok: false, error: "dbError" }
  }

  return { ok: true, assessmentId: newAssessment.id }
}

// ============================================================
// Save Step Answers
// ============================================================

/**
 * Lưu câu trả lời của một step trong wizard.
 * Merge với answers hiện có và update current_step.
 */
export async function saveStepAnswersAction(
  assessmentId: string,
  stepKey: keyof AssessmentAnswers,
  stepData: AssessmentAnswers[keyof AssessmentAnswers],
  nextStep: number
): Promise<SaveAnswersResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: "notAuthenticated" }
  }

  const admin = createAdminClient()

  // Verify ownership and status
  const { data: assessment } = await admin
    .from("export_readiness_assessments")
    .select("client_id, status, answers")
    .eq("id", assessmentId)
    .single()

  if (!assessment) {
    return { ok: false, error: "notFound" }
  }

  if (assessment.client_id !== user.id) {
    return { ok: false, error: "notAuthenticated" }
  }

  if (assessment.status === "completed") {
    return { ok: false, error: "assessmentCompleted" }
  }

  // Merge new answers with existing
  const currentAnswers = (assessment.answers as AssessmentAnswers) || {}
  const updatedAnswers: AssessmentAnswers = {
    ...currentAnswers,
    [stepKey]: stepData,
  }

  // Update assessment
  const { error: updateErr } = await admin
    .from("export_readiness_assessments")
    .update({
      answers: updatedAnswers,
      current_step: nextStep,
      updated_at: new Date().toISOString(),
    })
    .eq("id", assessmentId)

  if (updateErr) {
    console.error("[v0] saveStepAnswersAction db error:", updateErr)
    return { ok: false, error: "dbError" }
  }

  revalidatePath("/client/onboarding")
  return { ok: true }
}

// ============================================================
// Complete Assessment
// ============================================================

/**
 * Hoàn tất assessment và chạy AI analysis.
 * Tính điểm, xác định tier, và tạo action plan.
 */
export async function completeAssessmentAction(
  assessmentId: string
): Promise<CompleteAssessmentResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: "notAuthenticated" }
  }

  const admin = createAdminClient()

  // Get assessment
  const { data: assessment } = await admin
    .from("export_readiness_assessments")
    .select("*")
    .eq("id", assessmentId)
    .single()

  if (!assessment) {
    return { ok: false, error: "notFound" }
  }

  if (assessment.client_id !== user.id) {
    return { ok: false, error: "notAuthenticated" }
  }

  if (assessment.status === "completed") {
    // Already completed, return existing
    return {
      ok: true,
      assessment: assessment as unknown as ReadinessAssessment,
    }
  }

  // Run AI analysis
  let analysisResult
  try {
    analysisResult = await analyzeReadiness(
      assessment.answers as AssessmentAnswers
    )
  } catch (err) {
    console.error("[v0] completeAssessmentAction analysis error:", err)
    return { ok: false, error: "analysisError" }
  }

  const { scoreBreakdown, strengths, gaps, actionPlan } = analysisResult

  // Update assessment with results
  const { data: updated, error: updateErr } = await admin
    .from("export_readiness_assessments")
    .update({
      readiness_score: scoreBreakdown.totalScore,
      tier: scoreBreakdown.tier,
      strengths,
      gaps,
      action_plan: actionPlan,
      status: "completed" as AssessmentStatus,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", assessmentId)
    .select("*")
    .single()

  if (updateErr || !updated) {
    console.error("[v0] completeAssessmentAction update error:", updateErr)
    return { ok: false, error: "dbError" }
  }

  // The database trigger will automatically update profiles.readiness_tier
  // and profiles.last_assessment_id

  revalidatePath("/client/onboarding")
  revalidatePath("/client/onboarding/results")
  revalidatePath("/client")

  return {
    ok: true,
    assessment: updated as unknown as ReadinessAssessment,
  }
}

// ============================================================
// Get Assessment
// ============================================================

/**
 * Lấy assessment theo ID.
 */
export async function getAssessmentByIdAction(
  assessmentId: string
): Promise<GetAssessmentResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: "notAuthenticated" }
  }

  const { data: assessment, error } = await supabase
    .from("export_readiness_assessments")
    .select("*")
    .eq("id", assessmentId)
    .single()

  if (error || !assessment) {
    return { ok: false, error: "notFound" }
  }

  // Check ownership (RLS should handle this, but double-check)
  if (assessment.client_id !== user.id) {
    // Check if user is staff/admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    const staffRoles = ["admin", "super_admin", "staff", "account_executive", "lead_researcher"]
    if (!profile || !staffRoles.includes(profile.role)) {
      return { ok: false, error: "notAuthenticated" }
    }
  }

  return {
    ok: true,
    assessment: assessment as unknown as ReadinessAssessment,
  }
}

/**
 * Lấy assessment mới nhất của client hiện tại.
 */
export async function getLatestAssessmentAction(): Promise<GetAssessmentResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: "notAuthenticated" }
  }

  const { data: assessment, error } = await supabase
    .from("export_readiness_assessments")
    .select("*")
    .eq("client_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (error || !assessment) {
    // No assessment found is not an error
    return { ok: true, assessment: undefined }
  }

  return {
    ok: true,
    assessment: assessment as unknown as ReadinessAssessment,
  }
}

/**
 * Lấy assessment đang in_progress hoặc completed mới nhất của client.
 * Dùng cho wizard page để quyết định redirect.
 */
export async function getCurrentAssessmentAction(): Promise<GetAssessmentResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: "notAuthenticated" }
  }

  // First check for in_progress
  const { data: inProgress } = await supabase
    .from("export_readiness_assessments")
    .select("*")
    .eq("client_id", user.id)
    .eq("status", "in_progress")
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (inProgress) {
    return {
      ok: true,
      assessment: inProgress as unknown as ReadinessAssessment,
    }
  }

  // Check for completed
  const { data: completed } = await supabase
    .from("export_readiness_assessments")
    .select("*")
    .eq("client_id", user.id)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .single()

  return {
    ok: true,
    assessment: completed as unknown as ReadinessAssessment,
  }
}

// ============================================================
// Admin: Get Client Assessment
// ============================================================

/**
 * Admin/Staff lấy assessment của một client cụ thể.
 */
export async function getClientAssessmentAction(
  clientId: string
): Promise<GetAssessmentResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: "notAuthenticated" }
  }

  // Verify caller is staff/admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const staffRoles = ["admin", "super_admin", "staff", "account_executive", "lead_researcher"]
  if (!profile || !staffRoles.includes(profile.role)) {
    return { ok: false, error: "notAuthenticated" }
  }

  const admin = createAdminClient()

  const { data: assessment, error } = await admin
    .from("export_readiness_assessments")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .single()

  if (error || !assessment) {
    return { ok: true, assessment: undefined }
  }

  return {
    ok: true,
    assessment: assessment as unknown as ReadinessAssessment,
  }
}
