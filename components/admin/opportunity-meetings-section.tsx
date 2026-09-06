"use client"

/**
 * Opportunity Meetings Section — "Cuộc gặp & Tham quan" trong sheet chi tiết deal.
 *
 * Sự kiện có lịch gắn với deal (migration 070):
 *   - Video call với nhà máy (qualification từ xa)
 *   - Tham quan nhà máy (dẫn buyer đi thực địa)
 *   - Buyer trip (buyer sang VN)
 *   - Họp thường / Hội chợ
 *
 * chia 2 nhóm: Sắp tới (sửa/xóa được) và Đã diễn ra (ghi kết quả).
 * Tự refresh khi mở sheet (props.open đổi) — pattern giống email/replies section.
 */

import { useCallback, useEffect, useState, useTransition } from "react"
import { CalendarClock, Clock, MapPin, Plus, Trash2, Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { Spinner } from "@/components/ui/spinner"
import { useTranslation } from "@/components/i18n/language-provider"
import {
  addOpportunityMeeting,
  deleteOpportunityMeeting,
  listOpportunityMeetings,
  updateMeetingOutcome,
} from "@/app/admin/opportunities/meeting-actions"
import type { MeetingKind, OpportunityMeeting } from "@/lib/supabase/types"

interface Props {
  opportunityId: string
  open: boolean
}

const M = {
  sectionHint: {
    vi: "Các cuộc gặp video call, tham quan nhà máy, chuyến buyer sang VN — gắn với deal này. Hiển thị 📅 trên thẻ Kanban.",
    en: "Video calls, factory tours, buyer trips attached to this deal. Shown as 📅 on the Kanban card.",
  },
  addTitle: { vi: "Thêm cuộc gặp", en: "Add meeting" },
  kind: { vi: "Loại", en: "Type" },
  kindVideo: { vi: "Video call", en: "Video call" },
  kindTour: { vi: "Tham quan nhà máy", en: "Factory tour" },
  kindTrip: { vi: "Buyer sang VN", en: "Buyer trip" },
  kindMeeting: { vi: "Họp", en: "Meeting" },
  kindFair: { vi: "Hội chợ", en: "Trade fair" },
  titleLabel: { vi: "Tên cuộc gặp", en: "Title" },
  titlePh: { vi: "VD: Tour nhà máy Hải Dương cho buyer FreshCo", en: "e.g. Factory tour for FreshCo" },
  when: { vi: "Thời điểm", en: "When" },
  where: { vi: "Địa điểm (tùy chọn)", en: "Location (optional)" },
  wherePh: { vi: "VD: Nhà máy ABC, Hải Dương", en: "e.g. ABC Factory, Hai Duong" },
  notes: { vi: "Ghi chú (tùy chọn)", en: "Notes (optional)" },
  add: { vi: "Thêm", en: "Add" },
  adding: { vi: "Đang thêm…", en: "Adding…" },
  upcoming: { vi: "Sắp tới", en: "Upcoming" },
  past: { vi: "Đã diễn ra", en: "Past" },
  empty: {
    vi: "Chưa có cuộc gặp nào. Deal nào có buyer trip thường là tín hiệu nghiêm túc nhất — đáng ghi lại.",
    en: "No meetings yet. A deal with a buyer trip is the strongest buying signal — worth recording.",
  },
  outcome: { vi: "Kết quả", en: "Outcome" },
  outcomePh: { vi: "Ghi kết quả sau khi diễn ra…", en: "Record what happened…" },
  save: { vi: "Lưu", en: "Save" },
  saved: { vi: "Đã lưu", en: "Saved" },
  delete: { vi: "Xóa", en: "Delete" },
} as const

function label(locale: string, key: keyof typeof M): string {
  const entry = M[key] as { vi: string; en: string }
  return locale === "vi" ? entry.vi : entry.en
}

const KIND_OPTIONS: Array<{ value: MeetingKind; mKey: "kindVideo" | "kindTour" | "kindTrip" | "kindMeeting" | "kindFair"; icon: React.ElementType }> = [
  { value: "video_call", mKey: "kindVideo", icon: Video },
  { value: "factory_tour", mKey: "kindTour", icon: MapPin },
  { value: "buyer_trip", mKey: "kindTrip", icon: CalendarClock },
  { value: "meeting", mKey: "kindMeeting", icon: Clock },
  { value: "trade_fair", mKey: "kindFair", icon: CalendarClock },
]

function formatWhen(locale: string, iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(locale === "vi" ? "vi-VN" : "en-US", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  })
}

export function OpportunityMeetingsSection({ opportunityId, open }: Props) {
  const { locale } = useTranslation()
  const [meetings, setMeetings] = useState<OpportunityMeeting[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [kind, setKind] = useState<MeetingKind>("video_call")
  const [title, setTitle] = useState("")
  const [scheduledAt, setScheduledAt] = useState("")
  const [location, setLocation] = useState("")
  const [notes, setNotes] = useState("")
  const [pending, startTransition] = useTransition()

  const [outcomeDrafts, setOutcomeDrafts] = useState<Record<string, string>>({})

  const reload = useCallback(async () => {
    const res = await listOpportunityMeetings(opportunityId)
    if (res.ok) {
      setMeetings(res.data)
      setOutcomeDrafts(Object.fromEntries(res.data.map((m) => [m.id, m.outcome ?? ""])))
      setError(null)
    } else {
      setError(res.error)
    }
    setLoaded(true)
  }, [opportunityId])

  useEffect(() => {
    if (open) void reload()
  }, [open, reload])

  const now = new Date()
  const upcoming = meetings
    .filter((m) => new Date(m.scheduled_at) >= now)
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
  const past = meetings
    .filter((m) => new Date(m.scheduled_at) < now)
    .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at))

  function handleAdd() {
    if (!title.trim() || !scheduledAt) return
    startTransition(async () => {
      const res = await addOpportunityMeeting({
        opportunityId,
        kind,
        title,
        scheduledAt: new Date(scheduledAt).toISOString(),
        location,
        notes,
      })
      if (res.ok) {
        setTitle(""); setScheduledAt(""); setLocation(""); setNotes("")
        await reload()
      } else {
        setError(res.error)
      }
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await deleteOpportunityMeeting(id)
      if (res.ok) await reload()
      else setError(res.error)
    })
  }

  function handleOutcome(id: string) {
    const draft = outcomeDrafts[id] ?? ""
    startTransition(async () => {
      const res = await updateMeetingOutcome({ meetingId: id, outcome: draft })
      if (res.ok) await reload()
      else setError(res.error)
    })
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <p className="text-sm text-muted-foreground">{label(locale, "sectionHint")}</p>

      {/* FORM */}
      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="text-sm font-medium">{label(locale, "addTitle")}</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{label(locale, "kind")}</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as MeetingKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {label(locale, o.mKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{label(locale, "when")}</Label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{label(locale, "titleLabel")}</Label>
            <Input
              value={title}
              placeholder={label(locale, "titlePh")}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{label(locale, "where")}</Label>
            <Input
              value={location}
              placeholder={label(locale, "wherePh")}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{label(locale, "notes")}</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleAdd} disabled={pending || !title.trim() || !scheduledAt}>
              {pending ? <Spinner className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
              {pending ? label(locale, "adding") : label(locale, "add")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-destructive">Error: {error}</p>
      )}

      {!loaded ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="h-4 w-4" /> …
        </div>
      ) : meetings.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">{label(locale, "empty")}</p>
      ) : (
        <>
          {/* UPCOMING */}
          {upcoming.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-primary">
                📅 {label(locale, "upcoming")} ({upcoming.length})
              </div>
              {upcoming.map((m) => (
                <Card key={m.id} className="border-primary/30">
                  <CardContent className="pt-4 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium">{m.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatWhen(locale, m.scheduled_at)}
                          {m.location ? ` · ${m.location}` : ""}
                        </div>
                      </div>
                      <Button
                        variant="ghost" size="sm" aria-label={label(locale, "delete")}
                        onClick={() => handleDelete(m.id)} disabled={pending}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                    {m.notes && <p className="text-xs text-muted-foreground">{m.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* PAST */}
          {past.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">
                {label(locale, "past")} ({past.length})
              </div>
              {past.map((m) => (
                <Card key={m.id}>
                  <CardContent className="pt-4 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium">{m.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatWhen(locale, m.scheduled_at)}
                          {m.location ? ` · ${m.location}` : ""}
                        </div>
                      </div>
                      <Button
                        variant="ghost" size="sm" aria-label={label(locale, "delete")}
                        onClick={() => handleDelete(m.id)} disabled={pending}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                    {m.notes && <p className="text-xs text-muted-foreground">{m.notes}</p>}
                    <div className="space-y-1.5 pt-1">
                      <Label className="text-xs">{label(locale, "outcome")}</Label>
                      <Textarea
                        rows={2}
                        placeholder={label(locale, "outcomePh")}
                        value={outcomeDrafts[m.id] ?? ""}
                        onChange={(e) =>
                          setOutcomeDrafts((prev) => ({ ...prev, [m.id]: e.target.value }))
                        }
                      />
                      <div className="flex justify-end">
                        <Button
                          size="sm" variant="outline"
                          onClick={() => handleOutcome(m.id)}
                          disabled={pending || (outcomeDrafts[m.id] ?? "") === (m.outcome ?? "")}
                        >
                          {label(locale, "save")}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
