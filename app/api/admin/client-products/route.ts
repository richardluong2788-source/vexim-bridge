import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get("clientId")

  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 })
  }

  const supabase = await createClient()

  // Verify user is authenticated and has access
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Fetch products for the client
  const { data: products, error } = await supabase
    .from("client_products")
    .select("id, product_name, category, status")
    .eq("client_id", clientId)
    .eq("status", "active")
    .order("product_name", { ascending: true })

  if (error) {
    console.error("[v0] Error fetching client products:", error)
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 })
  }

  return NextResponse.json({ products: products || [] })
}
