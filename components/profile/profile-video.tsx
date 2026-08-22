"use client"

import { useState } from "react"
import Image from "next/image"
import { Factory, Play } from "lucide-react"
import type { ClientProfileWithRelations } from "@/lib/supabase/types"

interface ProfileVideoProps {
  profile: ClientProfileWithRelations
}

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

export function ProfileVideo({ profile }: ProfileVideoProps) {
  const [isPlaying, setIsPlaying] = useState(false)

  const hasVideo = Boolean(profile.video_url)
  const hasImage = Boolean(profile.factory_image_url)

  if (!hasVideo && !hasImage) return null

  const youtubeId = profile.video_url ? getYouTubeId(profile.video_url) : null
  const thumbnailUrl =
    profile.video_thumbnail_url ||
    (youtubeId ? `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg` : null)

  const handlePlay = () => {
    setIsPlaying(true)
  }

  // Both present -> side-by-side grid. Only one present -> single centered column.
  const gridClass =
    hasVideo && hasImage
      ? "grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 max-w-5xl mx-auto"
      : "max-w-3xl mx-auto"

  return (
    <section className="py-12 sm:py-16 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-6 text-center">
          Factory Tour
        </h2>

        <div className={gridClass}>
          {hasImage && (
            <div className="relative aspect-video rounded-xl overflow-hidden bg-muted shadow-lg">
              <Image
                src={profile.factory_image_url!}
                alt="Factory"
                fill
                className="object-cover"
              />
            </div>
          )}

          {hasVideo && (
            <div className="relative aspect-video rounded-xl overflow-hidden bg-muted shadow-lg">
              {isPlaying && youtubeId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`}
                  title="Factory Video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                />
              ) : isPlaying && !youtubeId ? (
                <video
                  src={profile.video_url!}
                  controls
                  autoPlay
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <>
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt="Video thumbnail"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
                      <Factory className="w-10 h-10 text-muted-foreground" />
                    </div>
                  )}

                  {/* Play button overlay */}
                  <button
                    onClick={handlePlay}
                    className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors group cursor-pointer"
                    aria-label="Play video"
                  >
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/95 flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                      <Play className="w-8 h-8 sm:w-10 sm:h-10 text-primary ml-1" fill="currentColor" />
                    </div>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
