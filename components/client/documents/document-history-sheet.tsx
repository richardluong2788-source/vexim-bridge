"use client"

import { useState, useEffect } from "react"
import { History, User, FileText, Clock, Edit2, Trash2, Plus, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

interface HistoryEntry {
  id: string
  doc_id: string
  action: "created" | "updated" | "deleted" | "expired" | "renewed"
  changed_by: string | null
  changes: Record<string, boolean> | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  notes: string | null
  created_at: string
  changer_name?: string | null
}

interface Props {
  docId: string
  docTitle: string
  open: boolean
  onClose: () => void
}

const ACTION_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string }
> = {
  created: { label: "Tạo mới", icon: Plus, color: "text-green-600 bg-green-100" },
  updated: { label: "Cập nhật", icon: Edit2, color: "text-blue-600 bg-blue-100" },
  deleted: { label: "Xóa", icon: Trash2, color: "text-red-600 bg-red-100" },
  expired: { label: "Hết hạn", icon: Clock, color: "text-amber-600 bg-amber-100" },
  renewed: { label: "Gia hạn", icon: RefreshCw, color: "text-green-600 bg-green-100" },
}

export function DocumentHistorySheet({ docId, docTitle, open, onClose }: Props) {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && docId) {
      loadHistory()
    }
  }, [open, docId])

  async function loadHistory() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/documents/history?docId=${docId}`)
      if (!res.ok) throw new Error("Failed to load history")
      const data = await res.json()
      setHistory(data.history ?? [])
    } catch (err) {
      console.error("[v0] History load error:", err)
      setError("Không thể tải lịch sử")
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatChanges = (entry: HistoryEntry): string[] => {
    const items: string[] = []
    
    if (entry.changes) {
      if (entry.changes.title_changed) items.push("Tên hồ sơ")
      if (entry.changes.expires_at_changed) items.push("Ngày hết hạn")
      if (entry.changes.issued_at_changed) items.push("Ngày cấp")
      if (entry.changes.notes_changed) items.push("Ghi chú")
      if (entry.changes.file_changed) items.push("File")
    }
    
    return items
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Lịch sử thay đổi
          </SheetTitle>
          <SheetDescription className="truncate">
            {docTitle}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Spinner className="h-5 w-5" />
              <span className="ml-2 text-sm text-muted-foreground">
                Đang tải...
              </span>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5">
              <p className="text-sm text-destructive">{error}</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={loadHistory}>
                Thử lại
              </Button>
            </div>
          )}

          {!loading && !error && history.length === 0 && (
            <div className="text-center py-12">
              <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Chưa có lịch sử thay đổi
              </p>
            </div>
          )}

          {!loading && !error && history.length > 0 && (
            <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-200px)]">
              {history.map((entry) => {
                const config = ACTION_CONFIG[entry.action] || ACTION_CONFIG.updated
                const Icon = config.icon
                const changedFields = formatChanges(entry)

                return (
                  <div
                    key={entry.id}
                    className="relative pl-8 pb-4 border-l-2 border-border last:border-l-transparent"
                  >
                    {/* Timeline dot */}
                    <div
                      className={cn(
                        "absolute left-0 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center",
                        config.color
                      )}
                    >
                      <Icon className="h-3 w-3" />
                    </div>

                    {/* Content */}
                    <div className="ml-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {config.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(entry.created_at)}
                        </span>
                      </div>

                      {entry.changer_name && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          {entry.changer_name}
                        </div>
                      )}

                      {changedFields.length > 0 && (
                        <p className="text-sm text-foreground mt-2">
                          Thay đổi: {changedFields.join(", ")}
                        </p>
                      )}

                      {entry.action === "created" && entry.new_values && (
                        <div className="text-xs text-muted-foreground mt-2 space-y-1">
                          {entry.new_values.kind && (
                            <p>Loại: {String(entry.new_values.kind)}</p>
                          )}
                          {entry.new_values.title && (
                            <p>Tên: {String(entry.new_values.title)}</p>
                          )}
                          {entry.new_values.expires_at && (
                            <p>
                              Hết hạn:{" "}
                              {new Date(
                                String(entry.new_values.expires_at)
                              ).toLocaleDateString("vi-VN")}
                            </p>
                          )}
                        </div>
                      )}

                      {entry.action === "updated" &&
                        entry.old_values &&
                        entry.new_values && (
                          <div className="text-xs mt-2 space-y-1">
                            {entry.changes?.expires_at_changed && (
                              <p className="text-muted-foreground">
                                Hết hạn:{" "}
                                <span className="line-through text-red-500">
                                  {entry.old_values.expires_at
                                    ? new Date(
                                        String(entry.old_values.expires_at)
                                      ).toLocaleDateString("vi-VN")
                                    : "—"}
                                </span>{" "}
                                &rarr;{" "}
                                <span className="text-green-600">
                                  {entry.new_values.expires_at
                                    ? new Date(
                                        String(entry.new_values.expires_at)
                                      ).toLocaleDateString("vi-VN")
                                    : "—"}
                                </span>
                              </p>
                            )}
                            {entry.changes?.title_changed && (
                              <p className="text-muted-foreground">
                                Tên:{" "}
                                <span className="line-through text-red-500">
                                  {String(entry.old_values.title || "—")}
                                </span>{" "}
                                &rarr;{" "}
                                <span className="text-green-600">
                                  {String(entry.new_values.title || "—")}
                                </span>
                              </p>
                            )}
                          </div>
                        )}

                      {entry.notes && (
                        <p className="text-xs text-muted-foreground mt-2 italic">
                          {entry.notes}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
