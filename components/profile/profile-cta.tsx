"use client"

import { FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProfileQuoteButton } from "./profile-quote-button"
import type { ClientProfileWithRelations } from "@/lib/supabase/types"

interface ProfileCTAProps {
  profile: ClientProfileWithRelations
}

export function ProfileCTA({ profile }: ProfileCTAProps) {
  const showRequestQuote = profile.enable_request_quote !== false
  const showDownloadPdf = profile.enable_download_pdf && profile.pdf_capability_url

  if (!showRequestQuote && !showDownloadPdf) return null

  return (
    <>
      <section className="py-16 sm:py-20 bg-gradient-to-br from-accent/5 via-background to-primary/5">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 text-balance">
              Sẵn sàng bắt đầu đơn hàng của bạn?
            </h2>
            <p className="text-muted-foreground mb-8">
              Liên hệ với chúng tôi để nhận giá, mẫu sản phẩm hoặc bất kỳ câu hỏi nào về sản phẩm.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {showRequestQuote && (
                <ProfileQuoteButton profile={profile} size="lg" className="w-full sm:w-auto px-8" />
              )}

              {showDownloadPdf && (
                <Button variant="outline" size="lg" className="w-full sm:w-auto px-8" asChild>
                  <a
                    href={profile.pdf_capability_url!}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FileText className="w-5 h-5 mr-2" />
                    Tải hồ sơ năng lực (PDF)
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Sticky Mobile CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t border-border sm:hidden z-50">
        <div className="flex gap-3">
          {showRequestQuote && (
            <ProfileQuoteButton
              profile={profile}
              size="lg"
              className="flex-1"
              label="Yêu cầu báo giá"
            />
          )}

          {showDownloadPdf && (
            <Button variant="outline" size="lg" className="shrink-0" asChild>
              <a
                href={profile.pdf_capability_url!}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileText className="w-5 h-5" />
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Add bottom padding on mobile to account for sticky CTA */}
      <div className="h-20 sm:hidden" aria-hidden="true" />
    </>
  )
}
