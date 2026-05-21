import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ReadinessWizard } from "@/components/client/onboarding/readiness-wizard"
import {
  getCurrentAssessmentAction,
  startAssessmentAction,
} from "./actions"

export const metadata = {
  title: "Export Readiness Assessment | Vexim Bridge",
  description: "Evaluate your export readiness for the US market",
}

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Check for existing assessment
  const { assessment } = await getCurrentAssessmentAction()

  // If completed, redirect to results
  if (assessment?.status === "completed") {
    redirect(`/client/onboarding/results?id=${assessment.id}`)
  }

  // If no in-progress assessment, start one
  let assessmentId = assessment?.id
  if (!assessmentId) {
    const result = await startAssessmentAction()
    if (result.ok && result.assessmentId) {
      assessmentId = result.assessmentId
    }
  }

  // Get profile for context
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_name, preferred_language")
    .eq("id", user.id)
    .single()

  return (
    <div className="container max-w-4xl py-8">
      <ReadinessWizard
        assessmentId={assessmentId!}
        initialStep={assessment?.current_step ?? 1}
        initialAnswers={assessment?.answers ?? {}}
        companyName={profile?.company_name ?? undefined}
        language={profile?.preferred_language ?? "vi"}
      />
    </div>
  )
}
