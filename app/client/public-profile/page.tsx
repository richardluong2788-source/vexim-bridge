/**
 * Client Public Profile Management Page
 * Allows clients to configure their public company profile (Option A)
 */

"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Eye, EyeOff, Copy, Check } from "lucide-react"

interface PublicProfileData {
  logo_url: string | null
  cover_url: string | null
  company_description: string | null
  production_stats: Record<string, unknown> | null
  company_video_url: string | null
  is_public_profile: boolean
}

interface PublicProfileSettings {
  is_visible: boolean
  show_email: boolean
  show_phone: boolean
  show_website: boolean
  show_factory_address: boolean
}

export default function ClientPublicProfilePage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [profileData, setProfileData] = useState<PublicProfileData>({
    logo_url: null,
    cover_url: null,
    company_description: null,
    production_stats: null,
    company_video_url: null,
    is_public_profile: false,
  })
  const [settings, setSettings] = useState<PublicProfileSettings>({
    is_visible: false,
    show_email: false,
    show_phone: false,
    show_website: false,
    show_factory_address: false,
  })

  const profileUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/share/profile/[your-company-id]`

  const copyToClipboard = () => {
    navigator.clipboard.writeText(profileUrl)
    setCopied(true)
    toast.success("Profile URL copied to clipboard")
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        toast.error("Not authenticated")
        return
      }

      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update(profileData)
        .eq("id", user.id)

      if (profileError) throw profileError

      // Update or create public profile settings
      const { error: settingsError } = await supabase
        .from("company_public_profiles")
        .upsert(
          {
            company_id: user.id,
            ...settings,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "company_id" },
        )

      if (settingsError) throw settingsError

      toast.success("Public profile updated successfully")
    } catch (error) {
      console.error("Error saving profile:", error)
      toast.error("Failed to save profile")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Public Company Profile</h1>
        <p className="text-muted-foreground mt-2">
          Manage how your company appears to potential buyers and partners
        </p>
      </div>

      {/* Visibility Status */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {settings.is_visible ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
            Profile Visibility
          </CardTitle>
          <CardDescription>
            {settings.is_visible
              ? "Your public profile is visible to all visitors"
              : "Your public profile is currently hidden"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground mb-2">Make profile public</p>
              <p className="text-sm text-muted-foreground">
                Once enabled, your profile will be viewable at a public URL
              </p>
            </div>
            <Switch
              checked={settings.is_visible}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, is_visible: checked })
              }
            />
          </div>

          {settings.is_visible && (
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-3">Your public profile URL:</p>
              <div className="flex gap-2">
                <code className="flex-1 px-3 py-2 bg-background rounded border border-border text-sm font-mono">
                  {profileUrl}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyToClipboard}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Company Information */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
          <CardDescription>
            Information that will be displayed on your public profile
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="logo_url">Logo URL</Label>
            <Input
              id="logo_url"
              placeholder="https://example.com/logo.png"
              value={profileData.logo_url || ""}
              onChange={(e) =>
                setProfileData({ ...profileData, logo_url: e.target.value || null })
              }
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              PNG or JPG format recommended. Recommended size: 200x200px
            </p>
          </div>

          <div>
            <Label htmlFor="cover_url">Cover Image URL</Label>
            <Input
              id="cover_url"
              placeholder="https://example.com/cover.jpg"
              value={profileData.cover_url || ""}
              onChange={(e) =>
                setProfileData({ ...profileData, cover_url: e.target.value || null })
              }
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Recommended size: 1920x480px
            </p>
          </div>

          <div>
            <Label htmlFor="description">Company Description</Label>
            <Textarea
              id="description"
              placeholder="Tell potential customers about your company, products, and capabilities..."
              value={profileData.company_description || ""}
              onChange={(e) =>
                setProfileData({
                  ...profileData,
                  company_description: e.target.value || null,
                })
              }
              className="mt-2"
              rows={4}
            />
          </div>

          <div>
            <Label htmlFor="video_url">Factory/Company Video URL</Label>
            <Input
              id="video_url"
              placeholder="https://www.youtube.com/embed/..."
              value={profileData.company_video_url || ""}
              onChange={(e) =>
                setProfileData({ ...profileData, company_video_url: e.target.value || null })
              }
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              YouTube embed URL or similar video platform embed link
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Contact Information Privacy */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Contact Information Privacy</CardTitle>
          <CardDescription>
            Choose which contact details are visible on your public profile. Buyers can always
            use "Request Quote" to contact you privately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-border rounded-lg">
            <div>
              <p className="font-medium text-foreground">Show Email</p>
              <p className="text-sm text-muted-foreground">Display email address on profile</p>
            </div>
            <Switch
              checked={settings.show_email}
              onCheckedChange={(checked) => setSettings({ ...settings, show_email: checked })}
            />
          </div>

          <div className="flex items-center justify-between p-4 border border-border rounded-lg">
            <div>
              <p className="font-medium text-foreground">Show Phone</p>
              <p className="text-sm text-muted-foreground">Display phone number on profile</p>
            </div>
            <Switch
              checked={settings.show_phone}
              onCheckedChange={(checked) => setSettings({ ...settings, show_phone: checked })}
            />
          </div>

          <div className="flex items-center justify-between p-4 border border-border rounded-lg">
            <div>
              <p className="font-medium text-foreground">Show Website</p>
              <p className="text-sm text-muted-foreground">Display website link on profile</p>
            </div>
            <Switch
              checked={settings.show_website}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, show_website: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between p-4 border border-border rounded-lg">
            <div>
              <p className="font-medium text-foreground">Show Factory Address</p>
              <p className="text-sm text-muted-foreground">
                Display exact factory location on profile
              </p>
            </div>
            <Switch
              checked={settings.show_factory_address}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, show_factory_address: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* What's Visible by Default */}
      <Card className="mb-8 border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base">Always Visible on Your Public Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <Badge variant="secondary" className="w-fit">✓</Badge>
              <span>Company name and logo</span>
            </li>
            <li className="flex items-center gap-2">
              <Badge variant="secondary" className="w-fit">✓</Badge>
              <span>Products and pricing</span>
            </li>
            <li className="flex items-center gap-2">
              <Badge variant="secondary" className="w-fit">✓</Badge>
              <span>FDA certification status</span>
            </li>
            <li className="flex items-center gap-2">
              <Badge variant="secondary" className="w-fit">✓</Badge>
              <span>Production capacity and capabilities</span>
            </li>
            <li className="flex items-center gap-2">
              <Badge variant="secondary" className="w-fit">✓</Badge>
              <span>Company videos and certifications</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex gap-4">
        <Button onClick={handleSave} disabled={loading} size="lg">
          {loading ? "Saving..." : "Save Changes"}
        </Button>
        <Button variant="outline" size="lg" asChild>
          <a href="/client">Cancel</a>
        </Button>
      </div>
    </div>
  )
}
