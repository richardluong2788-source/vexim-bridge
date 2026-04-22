"use client"

import { useState, type ReactNode } from "react"
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  INDUSTRIES,
  INDUSTRY_LABELS_VI,
  type Industry,
} from "@/lib/constants/industries"

interface ConsultationBookingDialogProps {
  trigger: ReactNode
}

const PREFERRED_TIMES = [
  { value: "morning", label: "Buổi sáng (9:00 – 12:00)" },
  { value: "afternoon", label: "Buổi chiều (13:30 – 17:30)" },
  { value: "evening", label: "Buổi tối (18:00 – 21:00)" },
  { value: "anytime", label: "Giờ nào cũng được" },
] as const

type FormState = {
  fullName: string
  email: string
  phone: string
  company: string
  industry: Industry | ""
  preferredTime: (typeof PREFERRED_TIMES)[number]["value"] | ""
  message: string
}

const INITIAL_STATE: FormState = {
  fullName: "",
  email: "",
  phone: "",
  company: "",
  industry: "",
  preferredTime: "",
  message: "",
}

export function ConsultationBookingDialog({ trigger }: ConsultationBookingDialogProps) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState<FormState>(INITIAL_STATE)
  // Honeypot — kept out of the visible form, bots still fill it.
  const [website, setWebsite] = useState("")

  function resetAll() {
    setForm(INITIAL_STATE)
    setWebsite("")
    setSubmitted(false)
  }

  function handleOpenChange(next: boolean) {
    // Don't lose their data mid-typing if they click outside accidentally
    // while submitting.
    if (submitting) return
    setOpen(next)
    if (!next) {
      // Reset a tick later so the exit animation doesn't flash the blank form.
      setTimeout(resetAll, 200)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting) return

    if (!form.industry) {
      toast.error("Vui lòng chọn ngành hàng")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/consultation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          company: form.company.trim(),
          industry: form.industry,
          preferredTime: form.preferredTime || undefined,
          message: form.message.trim() || undefined,
          website, // honeypot
        }),
      })

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
      }

      if (!res.ok || !data.ok) {
        toast.error(data.error ?? "Không gửi được yêu cầu. Vui lòng thử lại.")
        return
      }

      toast.success("Đã gửi yêu cầu tư vấn. Vexim Bridge sẽ liên hệ bạn sớm.")
      setSubmitted(true)
    } catch (err) {
      console.error("[v0] consultation submit failed:", err)
      toast.error("Có lỗi mạng. Vui lòng thử lại.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        {submitted ? (
          <SuccessView onClose={() => handleOpenChange(false)} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">Đặt lịch tư vấn 1:1</DialogTitle>
              <DialogDescription>
                Để lại thông tin, chuyên gia Vexim Bridge sẽ liên hệ trong 24 giờ làm việc để xác nhận khung giờ tư vấn miễn phí về xuất khẩu sang Mỹ.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-4" noValidate>
              {/* Honeypot (visually hidden, not aria-hidden so bots still see it) */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-[-9999px] top-auto h-px w-px overflow-hidden opacity-0"
              >
                <label htmlFor="cb-website">Website</label>
                <input
                  id="cb-website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cb-full-name">
                    Họ và tên <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="cb-full-name"
                    name="fullName"
                    required
                    autoComplete="name"
                    placeholder="Nguyễn Văn A"
                    value={form.fullName}
                    onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))}
                    disabled={submitting}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cb-phone">
                    Số điện thoại <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="cb-phone"
                    name="phone"
                    type="tel"
                    required
                    autoComplete="tel"
                    placeholder="0909 123 456"
                    value={form.phone}
                    onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cb-email">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cb-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="ban@congty.com"
                  value={form.email}
                  onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                  disabled={submitting}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cb-company">
                  Công ty / Nhà máy <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cb-company"
                  name="company"
                  required
                  autoComplete="organization"
                  placeholder="Công ty TNHH ABC"
                  value={form.company}
                  onChange={(e) => setForm((s) => ({ ...s, company: e.target.value }))}
                  disabled={submitting}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cb-industry">
                    Ngành hàng <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={form.industry}
                    onValueChange={(value) =>
                      setForm((s) => ({ ...s, industry: value as Industry }))
                    }
                    disabled={submitting}
                  >
                    <SelectTrigger id="cb-industry" className="w-full">
                      <SelectValue placeholder="Chọn ngành hàng" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRIES.map((industry) => (
                        <SelectItem key={industry} value={industry}>
                          {INDUSTRY_LABELS_VI[industry]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cb-time">Thời gian mong muốn</Label>
                  <Select
                    value={form.preferredTime}
                    onValueChange={(value) =>
                      setForm((s) => ({
                        ...s,
                        preferredTime: value as FormState["preferredTime"],
                      }))
                    }
                    disabled={submitting}
                  >
                    <SelectTrigger id="cb-time" className="w-full">
                      <SelectValue placeholder="Chọn khung giờ" />
                    </SelectTrigger>
                    <SelectContent>
                      {PREFERRED_TIMES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cb-message">Nội dung cần tư vấn</Label>
                <Textarea
                  id="cb-message"
                  name="message"
                  rows={4}
                  placeholder="Bạn đang bán gì, đã xuất khẩu chưa, đang vướng ở đâu (FDA, tìm buyer, thanh toán...)"
                  value={form.message}
                  onChange={(e) => setForm((s) => ({ ...s, message: e.target.value }))}
                  disabled={submitting}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Thông tin bạn gửi được bảo mật và chỉ dùng cho mục đích tư vấn. Vexim Bridge sẽ không chia sẻ với bên thứ ba.
              </p>

              <DialogFooter className="mt-2 gap-2 sm:gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleOpenChange(false)}
                  disabled={submitting}
                >
                  Huỷ
                </Button>
                <Button type="submit" disabled={submitting} className="gap-2">
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Đang gửi...
                    </>
                  ) : (
                    <>
                      Gửi yêu cầu
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SuccessView({ onClose }: { onClose: () => void }) {
  return (
    <>
      <DialogHeader className="items-center text-center">
        <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent">
          <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
        </div>
        <DialogTitle className="text-xl">Đã gửi yêu cầu tư vấn</DialogTitle>
        <DialogDescription className="text-pretty">
          Cảm ơn bạn. Chuyên gia Vexim Bridge sẽ liên hệ lại trong vòng <strong>24 giờ làm việc</strong> để xác nhận khung giờ tư vấn. Bạn cũng sẽ nhận được email xác nhận trong vài phút tới.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter className="mt-2">
        <Button onClick={onClose} className="w-full sm:w-auto">
          Đóng
        </Button>
      </DialogFooter>
    </>
  )
}
