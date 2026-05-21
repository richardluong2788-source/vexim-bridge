import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getAssessmentByIdAction } from "../actions"
import { ReadinessResults } from "@/components/client/onboarding/readiness-results"

export const metadata = {
  title: "Assessment Results | Vexim Bridge",
  description: "Your Export Readiness Assessment results",
}

interface ResultsPageProps {
  searchParams: Promise<{ id?: string }>
}

export default async function ResultsPage({ searchParams }: ResultsPageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  if (!params.id) {
    redirect("/client/onboarding")
  }

  const { ok, assessment, error } = await getAssessmentByIdAction(params.id)

  if (!ok || !assessment || assessment.status !== "completed") {
    redirect("/client/onboarding")
  }

  // Get profile for language preference
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_name, preferred_language")
    .eq("id", user.id)
    .single()

  return (
    <div className="container max-w-4xl py-8">
      <ReadinessResults
        assessment={assessment}
        companyName={profile?.company_name ?? undefined}
        language={profile?.preferred_language ?? "vi"}
      />
    </div>
  )
}
