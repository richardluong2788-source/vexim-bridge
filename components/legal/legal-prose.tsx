import type { ReactNode } from "react"

/**
 * Tiny set of typed primitives used inside legal page bodies. Centralising
 * them keeps the policy pages readable (no inline tailwind clutter) and lets
 * us tweak the typography of all legal docs from one place.
 */

export function LegalSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-24">
      <h2
        id={`${id}-heading`}
        className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
      >
        {title}
      </h2>
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  )
}

export function LegalSubheading({ children }: { children: ReactNode }) {
  return <h3 className="mt-2 text-base font-semibold text-foreground">{children}</h3>
}

export function LegalParagraph({ children }: { children: ReactNode }) {
  return <p className="leading-relaxed text-foreground/85">{children}</p>
}

export function LegalList({
  items,
  variant = "bullet",
}: {
  items: ReactNode[]
  variant?: "bullet" | "ordered"
}) {
  const Tag = variant === "ordered" ? "ol" : "ul"
  const listClass =
    variant === "ordered"
      ? "ml-5 list-decimal flex flex-col gap-2 text-foreground/85"
      : "ml-5 list-disc flex flex-col gap-2 text-foreground/85"
  return (
    <Tag className={listClass}>
      {items.map((item, i) => (
        <li key={i} className="leading-relaxed">
          {item}
        </li>
      ))}
    </Tag>
  )
}

export function LegalCallout({ tone = "info", children }: { tone?: "info" | "warning"; children: ReactNode }) {
  const toneClass =
    tone === "warning"
      ? "border-l-4 border-amber-500/70 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"
      : "border-l-4 border-primary/70 bg-muted/60 text-foreground"
  return (
    <aside role="note" className={`rounded-md ${toneClass} px-4 py-3 text-sm leading-relaxed`}>
      {children}
    </aside>
  )
}

export function LegalDefinitionList({
  items,
}: {
  items: { term: string; definition: ReactNode }[]
}) {
  return (
    <dl className="flex flex-col gap-3 rounded-md border border-border/60 bg-muted/30 p-4 text-sm">
      {items.map((it) => (
        <div key={it.term} className="flex flex-col gap-1 sm:flex-row sm:gap-3">
          <dt className="min-w-[10rem] font-semibold text-foreground">{it.term}</dt>
          <dd className="text-foreground/80">{it.definition}</dd>
        </div>
      ))}
    </dl>
  )
}
