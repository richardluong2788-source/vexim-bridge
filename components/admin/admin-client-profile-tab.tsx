"use client"

import Link from "next/link"
import {
  Globe,
  EyeOff,
  ExternalLink,
  Settings,
  Eye,
  Users,
  Calendar,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ClientProfile } from "@/lib/supabase/types"

interface AdminClientProfileTabProps {
  clientId: string
  clientName: string
  clientProfile: ClientProfile | null
}

export function AdminClientProfileTab({
  clientId,
  clientName,
  clientProfile,
}: AdminClientProfileTabProps) {
  if (!clientProfile) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Globe className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            No Profile Created Yet
          </h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Create a public profile page for {clientName} to share with US buyers.
            The profile showcases their products, certifications, and production
            capabilities.
          </p>
          <Button asChild>
            <Link href={`/admin/clients/${clientId}/profile`}>
              <Settings className="w-4 h-4 mr-2" />
              Create Profile
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const profileUrl = `/profile/${clientProfile.slug}`

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Profile Status
                <Badge variant={clientProfile.is_published ? "default" : "secondary"}>
                  {clientProfile.is_published ? (
                    <>
                      <Globe className="w-3 h-3 mr-1" />
                      Published
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3 h-3 mr-1" />
                      Draft
                    </>
                  )}
                </Badge>
              </CardTitle>
              <CardDescription className="mt-1">
                {clientProfile.display_name || clientName}
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              {clientProfile.is_published && (
                <Button variant="outline" size="sm" asChild>
                  <a href={profileUrl} target="_blank" rel="noopener noreferrer">
                    <Eye className="w-4 h-4 mr-1" />
                    View Live
                  </a>
                </Button>
              )}
              <Button size="sm" asChild>
                <Link href={`/admin/clients/${clientId}/profile`}>
                  <Settings className="w-4 h-4 mr-1" />
                  Edit Profile
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* URL */}
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <ExternalLink className="w-4 h-4" />
                Profile URL
              </div>
              <p className="font-mono text-sm truncate">/profile/{clientProfile.slug}</p>
            </div>

            {/* Views */}
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Users className="w-4 h-4" />
                Total Views
              </div>
              <p className="text-2xl font-semibold">
                {(clientProfile.view_count || 0).toLocaleString()}
              </p>
            </div>

            {/* Published Date */}
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Calendar className="w-4 h-4" />
                {clientProfile.is_published ? "Published" : "Created"}
              </div>
              <p className="text-sm">
                {clientProfile.is_published && clientProfile.published_at
                  ? new Date(clientProfile.published_at).toLocaleDateString()
                  : new Date(clientProfile.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile Content</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">USP Points</p>
              <p className="font-medium">{clientProfile.usp_points?.length || 0} / 4</p>
            </div>
            <div>
              <p className="text-muted-foreground">Certifications</p>
              <p className="font-medium">{clientProfile.featured_certifications?.length || 0}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Products</p>
              <p className="font-medium">{clientProfile.featured_products?.length || 0} / 6</p>
            </div>
            <div>
              <p className="text-muted-foreground">Video</p>
              <p className="font-medium">{clientProfile.video_url ? "Yes" : "No"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tagline Preview */}
      {clientProfile.tagline && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tagline</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground italic">&ldquo;{clientProfile.tagline}&rdquo;</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
