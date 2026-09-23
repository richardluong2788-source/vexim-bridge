"use client"

/**
 * Image element that uses the Next.js optimizer when it is safe to do so.
 *
 * `next/image` needs either a local path or a host listed in
 * `images.remotePatterns`; handing it anything else produces a failed image
 * request. Rather than assume every row holds a well-behaved URL (suppliers
 * paste URLs from their own sites, old rows predate the current upload path),
 * we check the source and fall back to a plain <img>. Nothing can render
 * worse than the unoptimized baseline, and supplier photos get AVIF/WebP plus
 * width-based srcset sizing.
 */
import Image from "next/image"
import * as React from "react"

import { isOptimizableImageSrc } from "@/lib/images/hosts.mjs"

interface SmartImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string
  alt: string
  /** Lay the image over a positioned parent (needs `sizes`). */
  fill?: boolean
  width?: number
  height?: number
  sizes?: string
  /** Only for above-the-fold heroes: skip lazy loading. */
  priority?: boolean
  quality?: number
}

export function SmartImage({
  src,
  alt,
  fill = false,
  width,
  height,
  sizes,
  priority = false,
  quality = 75,
  ...rest
}: SmartImageProps) {
  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || undefined

  if (!isOptimizableImageSrc(src, siteOrigin)) {
    const { style, ...imgRest } = rest
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        // `fill` is a next/image behaviour, not an <img> one: without these
        // styles a fallback image stops covering its parent and the layout
        // collapses. Duplicating what next/image inlines keeps both branches
        // visually identical, which is the whole promise of this component.
        style={
          fill
            ? { position: "absolute", inset: 0, height: "100%", width: "100%", maxWidth: "100%", ...style }
            : style
        }
        {...imgRest}
      />
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      sizes={sizes}
      priority={priority}
      quality={quality}
      {...(rest as Omit<React.ComponentProps<typeof Image>, "src" | "alt">)}
    />
  )
}
