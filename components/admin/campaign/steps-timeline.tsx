"use client"

// Timeline sequence steps — chỉ hiển thị (template sửa qua migration/seed).

import { Badge } from "@/components/ui/badge"

interface StepView {
  id: string
  step_number: number
  step_type: string
  delay_days: number
  objective: string | null
  ai_prompt_guidance: string | null
}

const TYPE_LABEL: Record<string, string> = {
  initial_outreach: "Email 1 — Introduction",
  follow_up: "Follow-up",
  close_loop: "Close-loop",
  nurture: "Nurture",
}

export function StepsTimeline({ steps }: { steps: StepView[] }) {
  if (steps.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        Campaign chưa có step nào. Chạy seed 090 hoặc thêm bằng migration mới.
      </div>
    )
  }

  return (
    <ol className="space-y-3">
      {steps.map((s, idx) => (
        <li key={s.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-semibold">
              {s.step_number}
            </div>
            {idx < steps.length - 1 && <div className="mt-1 w-px flex-1 bg-border" />}
          </div>
          <div className="min-w-0 pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{TYPE_LABEL[s.step_type] ?? s.step_type}</span>
              <Badge variant="outline" className="text-[11px]">
                {s.step_number === 1 ? "Ngày 0" : `+${s.delay_days} ngày`}
              </Badge>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{s.objective ?? "—"}</p>
          </div>
        </li>
      ))}
      <li className="flex gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-muted text-xs">∞</div>
        <div>
          <span className="text-sm font-medium text-muted-foreground">NURTURE</span>
          <p className="text-sm text-muted-foreground">Hết sequence không reply → chăm sóc dài hạn, dừng tự động.</p>
        </div>
      </li>
    </ol>
  )
}
