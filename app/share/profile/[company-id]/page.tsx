/**
 * Public Company Profile Page (Option A)
 * 
 * Displays a company's public profile with:
 * ✅ SHOW: Company name, logo, cover, products, certifications, production stats, video
 * ❌ HIDE: Email, phone, website, specific factory address
 * 🔗 CTA: "Request Quote" button through ESH system
 * 
 * Route: /share/profile/[company-id]
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Building2, Package, Award, BarChart3, Video, MessageSquare } from "lucide-react"
import Link from "next/link"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ "company-id": string }>
}

export default async function PublicCompanyProfilePage({ params }: PageProps) {
  const { "company-id": companyId } = await params
  const admin = createAdminClient()

  // Fetch company profile
  const { data: profile } = await admin
    .from("profiles")
    .select("id, company_name, logo_url, cover_url, company_description, production_stats, company_video_url, industry, fda_registration_number")
    .eq("id", companyId)
    .eq("is_public_profile", true)
    .maybeSingle()

  if (!profile) return notFound()

  // Fetch company's products
  const { data: products } = await admin
    .from("client_products")
    .select("id, product_name, category, subcategory, description, monthly_capacity_units, min_unit_price, max_unit_price, currency")
    .eq("client_id", companyId)
    .eq("status", "active")
    .order("created_at", { ascending: false })

  // Fetch certifications (compliance docs)
  const { data: certifications } = await admin
    .from("compliance_docs")
    .select("id, kind, title, url, notes")
    .eq("owner_id", companyId)
    .in("kind", ["fda_certificate", "coa"])
    .order("created_at", { ascending: false })

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section with Cover Image */}
      <div className="relative">
        {profile.cover_url ? (
          <img
            src={profile.cover_url}
            alt={`${profile.company_name} cover`}
            className="w-full h-80 object-cover"
          />
        ) : (
          <div className="w-full h-80 bg-gradient-to-br from-primary/10 to-primary/5" />
        )}

        {/* Company Info Card */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="-mt-16 relative z-10 mb-8">
            <Card className="border-border shadow-lg">
              <CardContent className="flex flex-col sm:flex-row items-start gap-6 p-6">
                {/* Logo */}
                {profile.logo_url ? (
                  <img
                    src={profile.logo_url}
                    alt={`${profile.company_name} logo`}
                    className="w-32 h-32 object-contain rounded-lg bg-muted p-4 flex-shrink-0"
                  />
                ) : (
                  <div className="w-32 h-32 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-16 h-16 text-muted-foreground" />
                  </div>
                )}

                {/* Company Header Info */}
                <div className="flex-1 min-w-0">
                  <h1 className="text-3xl font-bold text-foreground">{profile.company_name}</h1>
                  {profile.industry && (
                    <p className="text-muted-foreground mt-1">{profile.industry}</p>
                  )}
                  {profile.fda_registration_number && (
                    <Badge variant="secondary" className="mt-3">
                      FDA Certified
                    </Badge>
                  )}
                </div>

                {/* CTA Button */}
                <div className="flex flex-col gap-2">
                  <Button asChild size="lg" className="whitespace-nowrap">
                    <Link href={`/request-quote?company=${companyId}`}>
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Request Quote
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Company Description */}
            {profile.company_description && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">About Our Company</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">
                    {profile.company_description}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Company Video */}
            {profile.company_video_url && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Video className="w-5 h-5" />
                    Factory Video
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                    <iframe
                      src={profile.company_video_url}
                      className="w-full h-full"
                      allowFullScreen
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      title="Company Video"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Products */}
            {products && products.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Our Products
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {products.map((product) => (
                      <div
                        key={product.id}
                        className="p-4 border border-border rounded-lg hover:bg-muted/50 transition"
                      >
                        <h3 className="font-semibold text-foreground">{product.product_name}</h3>
                        {product.category && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {product.category}
                            {product.subcategory && ` · ${product.subcategory}`}
                          </p>
                        )}
                        {product.description && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            {product.description}
                          </p>
                        )}
                        <div className="flex flex-col sm:flex-row gap-4 mt-3 text-sm">
                          {product.monthly_capacity_units && (
                            <div>
                              <span className="text-muted-foreground">Capacity: </span>
                              <span className="font-medium">
                                {product.monthly_capacity_units.toLocaleString()} units/month
                              </span>
                            </div>
                          )}
                          {product.min_unit_price && (
                            <div>
                              <span className="text-muted-foreground">Price: </span>
                              <span className="font-medium">
                                {product.currency} {product.min_unit_price}
                                {product.max_unit_price && ` - ${product.max_unit_price}`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Certifications */}
            {certifications && certifications.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Award className="w-5 h-5" />
                    Certifications
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {certifications.map((cert) => (
                      <div
                        key={cert.id}
                        className="flex items-center justify-between p-3 border border-border rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-foreground">
                            {cert.title || (cert.kind === "fda_certificate" ? "FDA Certificate" : "Certificate of Analysis")}
                          </p>
                          {cert.notes && (
                            <p className="text-sm text-muted-foreground mt-1">{cert.notes}</p>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <a href={cert.url} target="_blank" rel="noopener noreferrer">
                            View
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Production Stats & Quick Info */}
          <div className="space-y-8">
            {/* Production Stats */}
            {profile.production_stats && Object.keys(profile.production_stats).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Production Stats
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(profile.production_stats).map(([key, value]) => (
                      <div key={key}>
                        <p className="text-sm text-muted-foreground capitalize">
                          {key.replace(/_/g, " ")}
                        </p>
                        <p className="text-lg font-semibold text-foreground">
                          {typeof value === "number" ? value.toLocaleString() : String(value)}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Get in Touch</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Interested in our products? Reach out to us for quotes and detailed information.
                </p>
                <Button asChild className="w-full">
                  <Link href={`/request-quote?company=${companyId}`}>
                    Request a Quote
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
