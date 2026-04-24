import type { ReactNode } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeSanitize from "rehype-sanitize"
import { cn } from "@/lib/utils"
import { headingSlug } from "@/lib/insights/toc"

interface InsightsMarkdownProps {
  children: string
  className?: string
}

/**
 * Flatten react-markdown children (string | ReactElement | array) down
 * to plain text so we can derive a stable heading id that matches the
 * ids produced by `extractToc()` on the server.
 */
function nodeText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join("")
  if (typeof node === "object" && "props" in node) {
    return nodeText((node as { props: { children?: ReactNode } }).props.children)
  }
  return ""
}

/**
 * Safe markdown renderer for blog content. Uses rehype-sanitize so any
 * HTML embedded in the markdown can't inject scripts. GFM enables tables,
 * strikethrough, task lists and autolinks.
 *
 * Styling: we hand-roll tag-level classes instead of pulling in the
 * typography plugin so the design stays on-brand (navy + teal, no
 * purple defaults).
 */
export function InsightsMarkdown({ children, className }: InsightsMarkdownProps) {
  return (
    <div
      className={cn(
        "max-w-none text-[15px] leading-relaxed text-foreground",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-10 mb-4 text-3xl font-semibold tracking-tight text-balance">
              {children}
            </h1>
          ),
          h2: ({ children }) => {
            const id = headingSlug(nodeText(children))
            return (
              <h2
                id={id}
                className="scroll-mt-24 mt-10 mb-4 text-2xl font-semibold tracking-tight text-balance"
              >
                {children}
              </h2>
            )
          },
          h3: ({ children }) => {
            const id = headingSlug(nodeText(children))
            return (
              <h3
                id={id}
                className="scroll-mt-24 mt-8 mb-3 text-xl font-semibold tracking-tight text-balance"
              >
                {children}
              </h3>
            )
          },
          h4: ({ children }) => (
            <h4 className="mt-6 mb-2 text-lg font-semibold tracking-tight">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="my-5 leading-relaxed text-foreground/90">{children}</p>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="font-medium text-accent underline decoration-accent/40 underline-offset-4 transition-colors hover:decoration-accent"
              rel={
                href?.startsWith("http") ? "noopener noreferrer" : undefined
              }
              target={href?.startsWith("http") ? "_blank" : undefined}
            >
              {children}
            </a>
          ),
          ul: ({ children }) => (
            <ul className="my-5 flex list-disc flex-col gap-2 pl-6 marker:text-muted-foreground">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-5 flex list-decimal flex-col gap-2 pl-6 marker:text-muted-foreground">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-1 leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-6 border-l-4 border-accent/60 bg-accent/5 px-5 py-3 text-foreground/90 italic">
              {children}
            </blockquote>
          ),
          code: ({ className: cls, children }) => {
            const isBlock = /language-/.test(cls ?? "")
            if (isBlock) {
              return (
                <code className={cn("font-mono text-sm", cls)}>{children}</code>
              )
            }
            return (
              <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
                {children}
              </code>
            )
          },
          pre: ({ children }) => (
            <pre className="my-6 overflow-x-auto rounded-md border border-border bg-muted/60 p-4 text-sm leading-relaxed">
              {children}
            </pre>
          ),
          hr: () => <hr className="my-10 border-border" />,
          table: ({ children }) => (
            <div className="my-6 overflow-x-auto rounded-md border border-border">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/60 text-left">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="border-b border-border px-4 py-2 font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-border px-4 py-2 align-top">
              {children}
            </td>
          ),
          img: ({ src, alt }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={typeof src === "string" ? src : ""}
              alt={alt ?? ""}
              className="my-6 w-full rounded-md border border-border"
              loading="lazy"
            />
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
