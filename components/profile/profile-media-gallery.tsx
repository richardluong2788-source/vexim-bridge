"use client"

import { useState } from "react"
import Image from "next/image"
import { Factory, Play, ShieldCheck } from "lucide-react"
import type { ClientProfileWithRelations } from "@/lib/supabase/types"

interface ProfileMediaGalleryProps {
  profile: ClientProfileWithRelations
  isVerified?: boolean
}

type MediaItem =
  | { type: "video"; url: string; thumbnail: string | null }
  | { type: "image"; url: string }

/**
 * Extracts YouTube video ID from various URL formats.
 */
function getYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }

  return null
}

/**
 * Marketplace-style media viewer (Alibaba-style "Factory Tour"): large
 * viewer on top, thumbnail strip below to switch between the factory
 * video and photos. Meant to sit next to the header info card.
 */
export function ProfileMediaGallery({ profile, isVerified }: ProfileMediaGalleryProps) {
  const factoryImages = profile.factory_image_urls || []
  const hasVideo = Boolean(profile.video_url)

  const youtubeId = hasVideo && profile.video_url ? getYouTubeId(profile.video_url) : null
  const videoThumbnail =
    profile.video_thumbnail_url ||
    (youtubeId ? `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg` : null)

  const items: MediaItem[] = [
    ...(hasVideo && profile.video_url
      ? [{ type: "video" as const, url: profile.video_url, thumbnail: videoThumbnail }]
      : []),
    ...factoryImages.map((url) => ({ type: "image" as const, url })),
  ]

  const [activeIndex, setActiveIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  if (items.length === 0) return null

  const active = items[activeIndex]

  const handleSelect = (index: number) => {
    setActiveIndex(index)
    setIsPlaying(false)
  }

  return (
    <div className="flex flex-col gap-2.5">
      {/* Main viewer */}
      <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-muted border border-border">
        {isVerified && (
          <div className="absolute top-3 left-3 z-10 inline-flex items-center gap-1 rounded-md bg-foreground/85 px-2 py-1 text-xs font-medium text-background">
            <ShieldCheck className="w-3.5 h-3.5" />
            Verified
          </div>
        )}

        {active.type === "image" ? (
          <Image
            src={active.url || "/placeholder.svg"}
            alt="Factory"
            fill
            className="object-cover"
          />
        ) : isPlaying ? (
          youtubeId ? (
            <iframe
              src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`}
              title="Factory Video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          ) : (
            <video
              src={active.url}
              controls
              autoPlay
              className="absolute inset-0 w-full h-full object-cover"
            />
          )
        ) : (
          <>
            {active.thumbnail ? (
              <img
                src={active.thumbnail || "/placeholder.svg"}
                alt="Video thumbnail"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
                <Factory className="w-10 h-10 text-muted-foreground" />
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsPlaying(true)}
              className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors group cursor-pointer"
              aria-label="Play factory video"
            >
              <div className="w-14 h-14 rounded-full bg-white/95 flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                <Play className="w-6 h-6 text-primary ml-0.5" fill="currentColor" />
              </div>
            </button>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {items.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {items.map((item, index) => (
            <button
              key={`${item.type}-${item.url}-${index}`}
              type="button"
              onClick={() => handleSelect(index)}
              className={`relative aspect-square rounded-md overflow-hidden border-2 transition-colors ${
                index === activeIndex ? "border-accent" : "border-transparent hover:border-border"
              }`}
              aria-label={item.type === "video" ? "Show factory video" : `Show factory photo ${index + 1}`}
            >
              <img
                src={(item.type === "video" ? item.thumbnail : item.url) || "/placeholder.svg"}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
              {item.type === "video" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                  <Play className="w-4 h-4 text-white" fill="currentColor" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
