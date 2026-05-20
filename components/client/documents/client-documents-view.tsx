"use client"

import { useState, useRef } from "react"
import {
  FileText,
  Upload,
  Trash2,
  Edit2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Plus,
  X,
  Save,
  ExternalLink,
  History,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { COMPLIANCE_DOC_KINDS, type ComplianceDocKind } from "@/lib/blob/client-docs"
import {
  uploadClientComplianceDocAction,
  deleteClientComplianceDocAction,
  updateClientComplianceDocAction,
} from "@/app/client/documents/actions"
import { DocumentHistorySheet } from "./document-history-sheet"

interface ComplianceDoc {
  id: string
  owner_id: string
  kind: ComplianceDocKind
  title: string | null
  url: string
  mime_type: string | null
  size_bytes: number | null
  issued_at: string | null
  expires_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

interface Props {
  initialDocuments: ComplianceDoc[]
}

const DOC_KIND_LABELS: Record<ComplianceDocKind, { vi: string; en: string }> = {
  fda_certificate: { vi: "Giấy đăng ký FDA", en: "FDA Certificate" },
  coa: { vi: "Giấy phân tích (COA)", en: "Certificate of Analysis" },
  price_floor: { vi: "Bảng giá sàn", en: "Price Floor" },
  factory_video: { vi: "Video nhà máy", en: "Factory Video" },
  factory_photo: { vi: "Ảnh nhà máy", en: "Factory Photo" },
  other: { vi: "Hồ sơ khác", en: "Other" },
}

function getDocStatus(expiresAt: string | null): {
  status: "valid" | "expiring" | "expired" | "no_expiry"
  daysLeft: number | null
} {
  if (!expiresAt) return { status: "no_expiry", daysLeft: null }
  
  const now = new Date()
  const expiry = new Date(expiresAt)
  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  
  if (daysLeft < 0) return { status: "expired", daysLeft }
  if (daysLeft <= 30) return { status: "expiring", daysLeft }
  return { status: "valid", daysLeft }
}

export function ClientDocumentsView({ initialDocuments }: Props) {
  const [documents, setDocuments] = useState<ComplianceDoc[]>(initialDocuments)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [editingDoc, setEditingDoc] = useState<ComplianceDoc | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [historyDoc, setHistoryDoc] = useState<ComplianceDoc | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [formKind, setFormKind] = useState<ComplianceDocKind>("other")
  const [formTitle, setFormTitle] = useState("")
  const [formExpiresAt, setFormExpiresAt] = useState("")
  const [formIssuedAt, setFormIssuedAt] = useState("")
  const [formNotes, setFormNotes] = useState("")
  const [formFile, setFormFile] = useState<File | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const resetForm = () => {
    setFormKind("other")
    setFormTitle("")
    setFormExpiresAt("")
    setFormIssuedAt("")
    setFormNotes("")
    setFormFile(null)
    setUploadError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleUpload = async () => {
    if (!formFile) {
      setUploadError("Vui lòng chọn file để upload")
      return
    }

    setUploading(true)
    setUploadError(null)

    const fd = new FormData()
    fd.append("kind", formKind)
    fd.append("title", formTitle)
    fd.append("expiresAt", formExpiresAt)
    fd.append("issuedAt", formIssuedAt)
    fd.append("notes", formNotes)
    fd.append("file", formFile)

    const result = await uploadClientComplianceDocAction(fd)

    if (!result.ok) {
      const errorMessages: Record<string, string> = {
        fileTooLarge: "File quá lớn (tối đa 100MB)",
        invalidType: "Loại file không hợp lệ (PDF, hình ảnh, video)",
        uploadFailed: "Upload thất bại, vui lòng thử lại",
        dbError: "Lỗi lưu dữ liệu, vui lòng thử lại",
      }
      setUploadError(errorMessages[result.error ?? ""] || "Có lỗi xảy ra")
      setUploading(false)
      return
    }

    // Refresh by fetching new list (or optimistically add)
    window.location.reload()
  }

  const handleDelete = async (docId: string) => {
    setDeleting(docId)
    const result = await deleteClientComplianceDocAction(docId)
    if (result.ok) {
      setDocuments((prev) => prev.filter((d) => d.id !== docId))
    }
    setDeleting(null)
  }

  const handleUpdate = async () => {
    if (!editingDoc) return
    setSaving(true)

    const result = await updateClientComplianceDocAction(editingDoc.id, {
      title: formTitle || null,
      expiresAt: formExpiresAt || null,
      issuedAt: formIssuedAt || null,
      notes: formNotes || null,
    })

    if (result.ok) {
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === editingDoc.id
            ? {
                ...d,
                title: formTitle || null,
                expires_at: formExpiresAt || null,
                issued_at: formIssuedAt || null,
                notes: formNotes || null,
              }
            : d
        )
      )
      setEditingDoc(null)
    }
    setSaving(false)
  }

  const openEdit = (doc: ComplianceDoc) => {
    setEditingDoc(doc)
    setFormTitle(doc.title || "")
    setFormExpiresAt(doc.expires_at?.split("T")[0] || "")
    setFormIssuedAt(doc.issued_at?.split("T")[0] || "")
    setFormNotes(doc.notes || "")
  }

  // Stats
  const stats = {
    total: documents.length,
    valid: documents.filter((d) => getDocStatus(d.expires_at).status === "valid").length,
    expiring: documents.filter((d) => getDocStatus(d.expires_at).status === "expiring").length,
    expired: documents.filter((d) => getDocStatus(d.expires_at).status === "expired").length,
  }

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Tổng cộng</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">Còn hạn</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-green-600">{stats.valid}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" />
              <span className="text-sm text-muted-foreground">Sắp hết hạn</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-amber-600">{stats.expiring}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-muted-foreground">Hết hạn</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-red-600">{stats.expired}</p>
          </CardContent>
        </Card>
      </div>

      {/* Upload Button */}
      <div className="flex justify-end">
        <Dialog open={uploadOpen} onOpenChange={(o) => { setUploadOpen(o); if (!o) resetForm() }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Tải lên hồ sơ mới
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Tải lên hồ sơ</DialogTitle>
              <DialogDescription>
                Upload chứng chỉ, giấy phép xuất khẩu của bạn
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Loại hồ sơ *</Label>
                <Select value={formKind} onValueChange={(v) => setFormKind(v as ComplianceDocKind)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPLIANCE_DOC_KINDS.map((kind) => (
                      <SelectItem key={kind} value={kind}>
                        {DOC_KIND_LABELS[kind].vi}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tên hồ sơ</Label>
                <Input
                  placeholder="VD: FDA Registration 2024"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ngày cấp</Label>
                  <Input
                    type="date"
                    value={formIssuedAt}
                    onChange={(e) => setFormIssuedAt(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ngày hết hạn</Label>
                  <Input
                    type="date"
                    value={formExpiresAt}
                    onChange={(e) => setFormExpiresAt(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Ghi chú</Label>
                <Textarea
                  placeholder="Ghi chú thêm về hồ sơ..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>File *</Label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.mp4,.mov,.webm"
                  onChange={(e) => setFormFile(e.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground">
                  PDF, hình ảnh, video (tối đa 100MB)
                </p>
              </div>

              {uploadError && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30">
                  <p className="text-sm text-destructive">{uploadError}</p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadOpen(false)}>
                Hủy
              </Button>
              <Button onClick={handleUpload} disabled={uploading || !formFile}>
                {uploading ? (
                  <>
                    <Spinner className="h-4 w-4 mr-2" />
                    Đang tải...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Tải lên
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Documents List */}
      {documents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground">Chưa có hồ sơ nào</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Tải lên các chứng chỉ, giấy phép xuất khẩu của bạn để Vexim Trade hỗ trợ tốt hơn
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {documents.map((doc) => {
            const { status, daysLeft } = getDocStatus(doc.expires_at)
            
            return (
              <Card
                key={doc.id}
                className={cn(
                  "border",
                  status === "expired" && "border-red-200 bg-red-50/50",
                  status === "expiring" && "border-amber-200 bg-amber-50/50"
                )}
              >
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-foreground">
                          {doc.title || DOC_KIND_LABELS[doc.kind].vi}
                        </h4>
                        <Badge variant="outline" className="text-xs">
                          {DOC_KIND_LABELS[doc.kind].vi}
                        </Badge>
                        {status === "valid" && (
                          <Badge className="bg-green-100 text-green-800 text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Còn hạn ({daysLeft} ngày)
                          </Badge>
                        )}
                        {status === "expiring" && (
                          <Badge className="bg-amber-100 text-amber-800 text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Sắp hết hạn ({daysLeft} ngày)
                          </Badge>
                        )}
                        {status === "expired" && (
                          <Badge variant="destructive" className="text-xs">
                            <XCircle className="h-3 w-3 mr-1" />
                            Đã hết hạn ({Math.abs(daysLeft!)} ngày)
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        {doc.issued_at && (
                          <span>Ngày cấp: {new Date(doc.issued_at).toLocaleDateString("vi-VN")}</span>
                        )}
                        {doc.expires_at && (
                          <span>Hết hạn: {new Date(doc.expires_at).toLocaleDateString("vi-VN")}</span>
                        )}
                        <span>
                          Upload: {new Date(doc.created_at).toLocaleDateString("vi-VN")}
                        </span>
                      </div>

                      {doc.notes && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {doc.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={`/api/files?pathname=${encodeURIComponent(doc.url)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>

                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setHistoryDoc(doc)}
                        title="Xem lịch sử"
                      >
                        <History className="h-4 w-4" />
                      </Button>

                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEdit(doc)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Xóa hồ sơ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Bạn có chắc muốn xóa hồ sơ này? Hành động này không thể hoàn tác.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Hủy</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(doc.id)}
                              disabled={deleting === doc.id}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {deleting === doc.id ? (
                                <Spinner className="h-4 w-4" />
                              ) : (
                                "Xóa"
                              )}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingDoc} onOpenChange={(o) => !o && setEditingDoc(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa hồ sơ</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tên hồ sơ</Label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ngày cấp</Label>
                <Input
                  type="date"
                  value={formIssuedAt}
                  onChange={(e) => setFormIssuedAt(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Ngày hết hạn</Label>
                <Input
                  type="date"
                  value={formExpiresAt}
                  onChange={(e) => setFormExpiresAt(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Ghi chú</Label>
              <Textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDoc(null)}>
              Hủy
            </Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Lưu
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Sheet */}
      <DocumentHistorySheet
        docId={historyDoc?.id ?? ""}
        docTitle={historyDoc?.title || DOC_KIND_LABELS[historyDoc?.kind ?? "other"].vi}
        open={!!historyDoc}
        onClose={() => setHistoryDoc(null)}
      />
    </div>
  )
}
