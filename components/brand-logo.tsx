import Image from "next/image"
import { cn } from "@/lib/utils"

/**
 * The real Vexim brand artwork, in one place.
 *
 * Before this existed the app drew a generic lucide glyph (`TrendingUp`) in a
 * coloured square wherever it needed a logo, so the real brand only ever
 * appeared on the three landing pages. Every badge, sidebar and auth screen
 * now renders actual brand art through this component.
 *
 * Two crops of the same master artwork in /public, so they cannot drift:
 *   - `mark`   - the square "V" glyph, for compact slots (sidebars, auth
 *                headers, intake links). A 36px box keeps it legible.
 *   - `lockup` - mark + "VEXIM" wordmark, for horizontal slots.
 *
 * The mark is dark navy (it matches `--primary`), so on a dark surface pass
 * `onDark` to seat it on a light plate - otherwise it vanishes into the
 * background. The plate mirrors the treatment the landing footer already used.
 */

const MARK_SRC = "/vexim-mark.png"
const LOCKUP_SRC = "/vexim-logo.png"

/** Lockup is 412x271 in the source PNG. */
const LOCKUP_RATIO = 412 / 271

interface BrandLogoProps {
  /**
   * `mark` is the square glyph, `lockup` adds the "VEXIM" wordmark.
   * @default "mark"
   */
  variant?: "mark" | "lockup"
  /** Outer box in CSS pixels. For `lockup` this is the height. @default 36 */
  size?: number
  /** Seat the artwork on a light plate so it stays legible on dark surfaces. */
  onDark?: boolean
  className?: string
  imgClassName?: string
  /** Preload the image — set this on above-the-fold headers only. */
  priority?: boolean
  alt?: string
}

export function BrandLogo({
  variant = "mark",
  size = 36,
  onDark = false,
  className,
  imgClassName,
  priority = false,
  alt = "Vexim Trade",
}: BrandLogoProps) {
  if (variant === "lockup") {
    const width = Math.round(size * LOCKUP_RATIO)
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center overflow-hidden",
          onDark && "rounded-lg bg-white",
          className,
        )}
        style={{ width, height: size, ...(onDark ? { padding: Math.round(size * 0.08) } : null) }}
      >
        <Image
          src={LOCKUP_SRC}
          alt={alt}
          width={width}
          height={size}
          priority={priority}
          className={cn("object-contain", imgClassName)}
        />
      </span>
    )
  }

  // Inset the artwork inside its plate so the glyph does not touch the edges.
  const pad = onDark ? Math.max(2, Math.round(size * 0.12)) : 0
  const inner = size - pad * 2

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        onDark && "rounded-lg bg-white",
        className,
      )}
      style={{ width: size, height: size, ...(onDark ? { padding: pad } : null) }}
    >
      <Image
        src={MARK_SRC}
        alt={alt}
        width={inner}
        height={inner}
        priority={priority}
        className={cn("object-contain", imgClassName)}
      />
    </span>
  )
}
