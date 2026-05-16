import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { getProfileWithRelationsByClientId } from "@/lib/profile/actions"
import { AdminProfileManager } from "@/components/admin/admin-profile-manager"
import { getCurrentRole } from "@/lib/auth/guard"
import { canAny, CAPS } from "@/lib/auth/permissions"
import { ownershipScopeFor } from "@/lib/auth/scope"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminClientProfilePage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Auth check
  const current = await getCurrentRole()
  if (!current) return notFound()

  const allowedRoles = canAny(current.role, [
    CAPS.CLIENT_VIEW,
    CAPS.CLIENT_WRITE,
  ])

  if (!allowedRoles) return notFound()

  // Fetch client
  const { data: client } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single()

  if (!client || client.role !== "client") return notFound()

  // Ownership check for AE/researcher
  const scope = ownershipScopeFor(current.role, current.userId)
  if (scope.kind === "owned" && client.account_manager_id !== scope.userId) {
    return notFound()
  }

  // Fetch existing profile (if any)
  const profileResult = await getProfileWithRelationsByClientId(id)
  const existingProfile = profileResult.success ? profileResult.data : null

  // Fetch compliance docs and products for selection
  const [{ data: docs }, { data: products }] = await Promise.all([
    supabase
      .from("compliance_docs")
      .select("*")
      .eq("owner_id", id)
      .in("kind", ["fda_certificate", "coa", "other"])
      .order("created_at", { ascending: false }),
    supabase
      .from("client_products")
      .select("*")
      .eq("client_id", id)
      .eq("status", "active")
      .order("product_name", { ascending: true }),
  ])

  const companyLabel = client.company_name ?? client.full_name ?? client.email ?? "Client"

  return (
    <div className="flex flex-col gap-6 p-8 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/admin/clients/${id}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Client
          </Link>
        </Button>
      </div>

      {/* Title */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Manage Profile
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure the public profile page for {companyLabel}
        </p>
      </div>

      {/* Profile Manager */}
      <AdminProfileManager
        clientId={id}
        clientName={companyLabel}
        existingProfile={existingProfile ?? undefined}
        availableDocs={docs ?? []}
        availableProducts={products ?? []}
      />
    </div>
  )
}
