/**
 * Visual building blocks for internal SOP / knowledge-base pages.
 *
 * Pure presentational, server-compatible components — no client JS. The
 * goal is that an AE skimming the operations manual can follow the whole
 * workflow from the diagrams alone, using the same colors/icons as the
 * product itself.
 */
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  ArrowRight,
  Info,
  Lightbulb,
  TriangleAlert,
  OctagonX,
  Check,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Section + table of contents
// ---------------------------------------------------------------------------

export function SopSection({
  id,
  icon: Icon,
  kicker,
  title,
  children,
  className,
}: {
  id: string
  icon?: LucideIcon
  kicker?: string
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      id={id}
      className={cn("scroll-mt-24 border-t border-border/60 py-10 first:border-t-0 first:pt-2", className)}
    >
      <h2 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
        {Icon && (
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
            <Icon className="h-5 w-5" />
          </span>
        )}
        <span>
          {kicker && (
            <span className="mr-2 align-middle text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {kicker}
            </span>
          )}
          {title}
        </span>
      </h2>
      <div className="mt-5 space-y-4 text-[15px] leading-7 text-foreground/90">{children}</div>
    </section>
  )
}

export function SubHeading({
  id,
  children,
}: {
  id?: string
  children: React.ReactNode
}) {
  return (
    <h3 id={id} className="scroll-mt-24 pt-2 text-lg font-semibold tracking-tight">
      {children}
    </h3>
  )
}

export function Toc({
  items,
}: {
  items: Array<{ href: string; label: string; icon?: LucideIcon }>
}) {
  return (
    <nav className="rounded-xl border bg-card p-4 text-sm shadow-sm">
      <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Nội dung tài liệu
      </div>
      <ol className="space-y-1">
        {items.map((it, i) => (
          <li key={it.href}>
            <Link
              href={it.href}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-bold tabular-nums">
                {i + 1}
              </span>
              {it.icon && <it.icon className="h-3.5 w-3.5" />}
              <span>{it.label}</span>
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Flow diagrams
// ---------------------------------------------------------------------------

export interface FlowNodeProps {
  title: string
  sub?: string
  icon?: LucideIcon
  /** tailwind classes for the node accent */
  tone?:
    | "slate"
    | "blue"
    | "indigo"
    | "violet"
    | "purple"
    | "amber"
    | "orange"
    | "sky"
    | "emerald"
    | "teal"
    | "rose"
  badge?: string
  small?: boolean
}

export const TONE: Record<NonNullable<FlowNodeProps["tone"]>, { box: string; dot: string }> = {
  slate: { box: "border-slate-300/70 bg-slate-50 dark:bg-slate-950/40", dot: "bg-slate-500" },
  blue: { box: "border-blue-300/70 bg-blue-50 dark:bg-blue-950/30", dot: "bg-blue-500" },
  indigo: { box: "border-indigo-300/70 bg-indigo-50 dark:bg-indigo-950/30", dot: "bg-indigo-500" },
  violet: { box: "border-violet-300/70 bg-violet-50 dark:bg-violet-950/30", dot: "bg-violet-500" },
  purple: { box: "border-purple-300/70 bg-purple-50 dark:bg-purple-950/30", dot: "bg-purple-500" },
  amber: { box: "border-amber-300/70 bg-amber-50 dark:bg-amber-950/30", dot: "bg-amber-500" },
  orange: { box: "border-orange-300/70 bg-orange-50 dark:bg-orange-950/30", dot: "bg-orange-500" },
  sky: { box: "border-sky-300/70 bg-sky-50 dark:bg-sky-950/30", dot: "bg-sky-500" },
  emerald: { box: "border-emerald-300/70 bg-emerald-50 dark:bg-emerald-950/30", dot: "bg-emerald-500" },
  teal: { box: "border-teal-300/70 bg-teal-50 dark:bg-teal-950/30", dot: "bg-teal-500" },
  rose: { box: "border-rose-300/70 bg-rose-50 dark:bg-rose-950/30", dot: "bg-rose-500" },
}

export function FlowNode({ title, sub, icon: Icon, tone = "slate", badge, small }: FlowNodeProps) {
  const t = TONE[tone]
  return (
    <div
      className={cn(
        "relative flex min-w-[132px] flex-1 flex-col rounded-lg border px-3 py-2.5",
        t.box,
        small ? "gap-0.5" : "gap-1",
      )}
    >
      {badge && (
        <span className="absolute -top-2 left-2 rounded-full bg-foreground px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-background">
          {badge}
        </span>
      )}
      <div className="flex items-center gap-1.5">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", t.dot)} />
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />}
        <span className={cn("font-semibold leading-tight", small ? "text-xs" : "text-[13px]")}>{title}</span>
      </div>
      {sub && (
        <div className={cn("text-muted-foreground", small ? "text-[10.5px] leading-snug" : "text-[11px] leading-snug")}>
          {sub}
        </div>
      )}
    </div>
  )
}

export function FlowArrow({ label, vertical }: { label?: string; vertical?: boolean }) {
  if (vertical) {
    return (
      <div className="flex flex-col items-center py-0.5">
        {label && <span className="mb-0.5 text-[10px] font-medium text-muted-foreground">{label}</span>}
        <ArrowRight className="h-4 w-4 rotate-90 text-muted-foreground/60" />
      </div>
    )
  }
  return (
    <div className="flex shrink-0 items-center px-0.5">
      {label && <span className="mr-1 whitespace-nowrap text-[10px] font-medium text-muted-foreground">{label}</span>}
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
    </div>
  )
}

/** Horizontal, wrapping pipeline of nodes connected by arrows. */
export function Flow({ children }: { children: React.ReactNode }) {
  const items = Array.isArray(children) ? children : [children]
  return (
    <div className="flex flex-wrap items-stretch gap-y-2 rounded-xl border bg-background/60 p-3">
      {items.map((child, i) => (
        <div key={i} className="flex items-center">
          {child}
          {i < items.length - 1 && (
            <ArrowRight className="mx-1 h-4 w-4 shrink-0 self-center text-muted-foreground/50" />
          )}
        </div>
      ))}
    </div>
  )
}

/** Decision point with two branches. */
export function Decision({
  question,
  yes,
  no,
  yesTone = "emerald",
  noTone = "rose",
}: {
  question: string
  yes: React.ReactNode
  no: React.ReactNode
  yesTone?: FlowNodeProps["tone"]
  noTone?: FlowNodeProps["tone"]
}) {
  return (
    <div className="rounded-xl border bg-background/60 p-4">
      <div className="mx-auto mb-4 w-fit rounded-md border-2 border-amber-400 bg-amber-50 px-4 py-1.5 text-center text-sm font-semibold dark:bg-amber-950/40">
        {question}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-600">
            <Check className="h-3.5 w-3.5" /> Đúng / đủ điều kiện
          </div>
          <div className="rounded-lg border border-dashed p-2 [&>div]:w-full">{yes}</div>
        </div>
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-600">
            <X className="h-3.5 w-3.5" /> Không / chưa đủ
          </div>
          <div className="rounded-lg border border-dashed p-2 [&>div]:w-full">{no}</div>
        </div>
      </div>
    </div>
  )
}

/**
 * Swimlane diagram: each lane is one actor. Put `FlowNode`s inside and
 * show who is responsible for every step at a glance.
 */
export function Swimlane({
  lanes,
}: {
  lanes: Array<{
    actor: string
    icon?: LucideIcon
    tone?: FlowNodeProps["tone"]
    steps: Array<FlowNodeProps & { note?: string }>
  }>
}) {
  return (
    <div className="space-y-2 rounded-xl border bg-background/60 p-3">
      {lanes.map((lane) => {
        const t = TONE[lane.tone ?? "slate"]
        return (
          <div key={lane.actor} className="grid gap-2 md:grid-cols-[150px_1fr] md:items-stretch">
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold",
                t.box,
              )}
            >
              {lane.icon && <lane.icon className="h-4 w-4" />}
              <span>{lane.actor}</span>
            </div>
            <div className="flex flex-wrap items-stretch gap-2">
              {lane.steps.map((s, i) => (
                <div key={i} className="flex items-center">
                  <FlowNode small {...s} />
                  {i < lane.steps.length - 1 && <ArrowRight className="mx-1 h-3.5 w-3.5 text-muted-foreground/50" />}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Callouts, do/don't, rules
// ---------------------------------------------------------------------------

const CALLOUT_STYLE = {
  info: { box: "border-blue-300/60 bg-blue-50/70 dark:bg-blue-950/20", icon: Info, iconColor: "text-blue-600", label: "Chi tiết" },
  tip: { box: "border-teal-300/60 bg-teal-50/70 dark:bg-teal-950/20", icon: Lightbulb, iconColor: "text-teal-600", label: "Mẹo" },
  warning: { box: "border-amber-300/70 bg-amber-50/80 dark:bg-amber-950/20", icon: TriangleAlert, iconColor: "text-amber-600", label: "Lưu ý" },
  danger: { box: "border-rose-300/70 bg-rose-50/80 dark:bg-rose-950/20", icon: OctagonX, iconColor: "text-rose-600", label: "Cấm / rủi ro" },
} as const

export function Callout({
  kind = "info",
  title,
  children,
}: {
  kind?: keyof typeof CALLOUT_STYLE
  title?: string
  children: React.ReactNode
}) {
  const s = CALLOUT_STYLE[kind]
  const Icon = s.icon
  return (
    <div className={cn("flex gap-3 rounded-xl border p-4 text-sm leading-6", s.box)}>
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", s.iconColor)} />
      <div className="space-y-1">
        <div className="font-semibold">{title ?? s.label}</div>
        <div className="text-foreground/85">{children}</div>
      </div>
    </div>
  )
}

export function DoDont({
  dos,
  donts,
}: {
  dos: React.ReactNode[]
  donts: React.ReactNode[]
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-xl border border-emerald-300/60 bg-emerald-50/60 p-4 dark:bg-emerald-950/15">
        <div className="mb-2 flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-400">
          <Check className="h-4 w-4" /> Nên làm
        </div>
        <ul className="space-y-1.5 text-sm">
          {dos.map((d, i) => (
            <li key={i} className="flex gap-2">
              <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span>{d}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl border border-rose-300/60 bg-rose-50/60 p-4 dark:bg-rose-950/15">
        <div className="mb-2 flex items-center gap-2 text-sm font-bold text-rose-700 dark:text-rose-400">
          <X className="h-4 w-4" /> Tuyệt đối không
        </div>
        <ul className="space-y-1.5 text-sm">
          {donts.map((d, i) => (
            <li key={i} className="flex gap-2">
              <X className="mt-1 h-3.5 w-3.5 shrink-0 text-rose-600" />
              <span>{d}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function RuleTable({
  rows,
}: {
  rows: Array<{ rule: string; value: string; note?: string }>
}) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={i % 2 ? "bg-muted/40" : "bg-card"}>
              <td className="w-64 px-4 py-2.5 font-medium align-top">{r.rule}</td>
              <td className="px-4 py-2.5 font-semibold text-teal-700 dark:text-teal-400 align-top whitespace-nowrap">
                {r.value}
              </td>
              <td className="px-4 py-2.5 text-muted-foreground align-top">{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function AppLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 font-mono text-[12px] font-medium text-foreground/80 shadow-sm transition-colors hover:border-teal-400 hover:text-teal-600"
    >
      {children}
    </Link>
  )
}

export function Pill({ children, tone = "slate" }: { children: React.ReactNode; tone?: FlowNodeProps["tone"] }) {
  const t = TONE[tone]
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", t.box)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", t.dot)} />
      {children}
    </span>
  )
}

export function StepList({ children }: { children: React.ReactNode }) {
  return <ol className="space-y-3">{children}</ol>
}

export function Step({
  n,
  title,
  children,
}: {
  n: number | string
  title: string
  children?: React.ReactNode
}) {
  return (
    <li className="relative rounded-xl border bg-card p-4 pl-14">
      <span className="absolute left-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-teal-500 text-sm font-bold text-white">
        {n}
      </span>
      <div className="font-semibold">{title}</div>
      {children && <div className="mt-1.5 text-sm leading-6 text-foreground/80">{children}</div>}
    </li>
  )
}
