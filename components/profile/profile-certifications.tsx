"use client"

import { useState } from "react"
import Image from "next/image"
import { X, FileCheck, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { privateFileHref } from "@/lib/blob/file-url"
import type { ClientProfileWithRelations, ComplianceDoc } from "@/lib/supabase/types"

interface ProfileCertificationsProps {
  profile: ClientProfileWithRelations
}

const kindLabels: Record<string, string> = {
  fda_certificate: "FDA",
  coa: "COA",
  other: "Certificate",
}

export function ProfileCertifications({ profile }: ProfileCertificationsProps) {
  const [selectedDoc, setSelectedDoc] = useState<ComplianceDoc | null>(null)

  const certifications = profile.certifications || []

  if (certifications.length === 0) return null

  return (
    <section className="py-12 sm:py-16 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-8 text-center">
          Certifications & Compliance
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {certifications.map((doc) => {
            const fileUrl = privateFileHref(doc.url)
            const isImage = doc.mime_type?.startsWith("image/")

            return (
              <button
                key={doc.id}
                onClick={() => setSelectedDoc(doc)}
                className="group relative aspect-[4/3] rounded-lg overflow-hidden bg-card border border-border hover:border-accent/50 hover:shadow-md transition-all cursor-pointer"
              >
                {isImage && fileUrl ? (
                  <Image
                    src={fileUrl}
                    alt={doc.title || "Certificate"}
                    fill
                    className="object-contain p-2 group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                    <FileCheck className="w-10 h-10 text-accent mb-2" />
                    <span className="text-xs text-muted-foreground text-center line-clamp-2">
                      {doc.title || "Document"}
                    </span>
                  </div>
                )}

                {/* Badge */}
                <div className="absolute top-2 right-2">
                  <Badge variant="secondary" className="text-xs">
                    {kindLabels[doc.kind] || doc.kind}
                  </Badge>
                </div>
              </button>
            )
          })}
        </div>

        {/* Lightbox Dialog */}
        <Dialog open={!!selectedDoc} onOpenChange={() => setSelectedDoc(null)}>
          <DialogContent className="max-w-3xl p-0 overflow-hidden">
            <DialogTitle className="sr-only">
              {selectedDoc?.title || "Certificate"}
            </DialogTitle>
            {selectedDoc && (
              <div className="relative">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                  <div>
                    <h3 className="font-semibold">{selectedDoc.title || "Certificate"}</h3>
                    <Badge variant="outline" className="mt-1">
                      {kindLabels[selectedDoc.kind] || selectedDoc.kind}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {privateFileHref(selectedDoc.url) && (
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={privateFileHref(selectedDoc.url)!}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Open
                        </a>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedDoc(null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Content */}
                <div className="relative aspect-[4/3] bg-muted">
                  {selectedDoc.mime_type?.startsWith("image/") &&
                  privateFileHref(selectedDoc.url) ? (
                    <Image
                      src={privateFileHref(selectedDoc.url)!}
                      alt={selectedDoc.title || "Certificate"}
                      fill
                      className="object-contain"
                    />
                  ) : selectedDoc.mime_type === "application/pdf" ? (
                    <iframe
                      src={privateFileHref(selectedDoc.url)!}
                      className="w-full h-full min-h-[500px]"
                      title={selectedDoc.title || "Document"}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full">
                      <FileCheck className="w-16 h-16 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">Document preview not available</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </section>
  )
}
