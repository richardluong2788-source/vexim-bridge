import type { SVGProps } from "react"

/**
 * Vexim Bridge logo mark. Two connected nodes (VN + US) bridged by a
 * teal arc, rendered on a navy rounded square. Pure SVG — scales
 * crisply at any size and inherits color from CSS tokens.
 */
export function BrandMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label="Vexim Bridge"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path
        d="M7 20 C 11 10, 21 10, 25 20"
        className="stroke-accent"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="7" cy="20" r="2.5" className="fill-primary-foreground" />
      <circle cx="25" cy="20" r="2.5" className="fill-primary-foreground" />
    </svg>
  )
}
