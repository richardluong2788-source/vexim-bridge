"use client"

import { useState } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight, FileCheck, Copy, Check, ShieldCheck } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { privateFileHref } from "@/lib/blob/file-url"
import type { ClientProfileWithRelations } from "@/lib/supabase/types"

interface ProfileCertificationsProps {
  profile: ClientProfileWithRelations
}

const kindLabels: Record<string, string> = {
  fda_certificate: "FDA",
  coa: "COA",
  other: "Certificate",
}

function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        navigator.clipboard.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="text-muted-foreground hover:text-foreground transition-colors"
      aria-label="Copy code"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    </button>
  )
}

export function ProfileCertifications({ profile }: ProfileCertificationsProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const certifications = profile.certifications || []

  if (certifications.length === 0) return null

  const showPrevious = () =>
    setActiveIndex((index) => (index === null ? null : (index - 1 + certifications.length) % certifications.length))
  const showNext = () =>
    setActiveIndex((index) => (index === null ? null : (index + 1) % certifications.length))

  const selectedDoc = activeIndex !== null ? certifications[activeIndex] : null

  return (
    <section className="py-12 sm:py-16 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-8 text-center">
          Certifications & Compliance
        </h2>

        <div className="flex flex-wrap justify-center gap-5 max-w-5xl mx-auto">
          {certifications.map((doc, index) => {
            const fileUrl = privateFileHref(doc.url)
            const isImage = doc.mime_type?.startsWith("image/")
            const code = doc.notes?.trim()

            return (
              <button
                key={doc.id}
                onClick={() => setActiveIndex(index)}
                className="group w-40 sm:w-44 text-left cursor-zoom-in"
              >
                {/* Document preview */}
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-white border border-border group-hover:border-accent/50 group-hover:shadow-md transition-all">
                  {isImage && fileUrl ? (
                    <Image
                      src={fileUrl}
                      alt={doc.title || "Certificate"}
                      fill
                      className="object-contain p-1.5 group-hover:scale-[1.03] transition-transform"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-3 gap-2 bg-muted/40">
                      <FileCheck className="w-10 h-10 text-accent" />
                      <span className="text-[11px] text-muted-foreground text-center line-clamp-2">
                        {doc.title || "Document"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Caption row */}
                <div className="mt-2.5 flex items-start gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground leading-tight line-clamp-1">
                      {doc.title || kindLabels[doc.kind] || doc.kind}
                    </p>
                    {code && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-xs text-muted-foreground truncate">{code}</span>
                        <CopyCode code={code} />
                      </div>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Lightbox Dialog */}
        <Dialog open={activeIndex !== null} onOpenChange={(open) => !open && setActiveIndex(null)}>
          <DialogContent className="max-w-6xl border-border bg-background p-3 sm:p-5">
            <DialogTitle className="sr-only">{selectedDoc?.title || "Certificate"}</DialogTitle>
            <div className="relative flex min-h-[50vh] items-center justify-center rounded-lg bg-muted/30">
              {selectedDoc && (
                <>
                  {selectedDoc.mime_type?.startsWith("image/") && privateFileHref(selectedDoc.url) ? (
                    <Image
                      src={privateFileHref(selectedDoc.url)!}
                      alt={selectedDoc.title || "Certificate"}
                      width={1600}
                      height={1200}
                      className="max-h-[75vh] w-auto max-w-full object-contain"
                    />
                  ) : selectedDoc.mime_type === "application/pdf" && privateFileHref(selectedDoc.url) ? (
                    <iframe
                      src={privateFileHref(selectedDoc.url)!}
                      className="w-full h-[75vh]"
                      title={selectedDoc.title || "Document"}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16">
                      <FileCheck className="w-16 h-16 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">Document preview not available</p>
                    </div>
                  )}

                  {certifications.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={showPrevious}
                        aria-label="Previous certificate"
                        className="absolute left-2 rounded-full bg-background/90 p-2 shadow-md hover:bg-background"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={showNext}
                        aria-label="Next certificate"
                        className="absolute right-2 rounded-full bg-background/90 p-2 shadow-md hover:bg-background"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  )
}
