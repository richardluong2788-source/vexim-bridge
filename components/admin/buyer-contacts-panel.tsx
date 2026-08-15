"use client"

import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import {
  Users,
  Plus,
  Star,
  ShieldCheck,
  Pencil,
  Trash2,
  Mail,
  Phone,
  Building2,
  Globe2,
  MoreVertical,
  ArrowRightLeft,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { maskEmail, maskPhone } from "@/lib/buyers/mask"
import type { BuyerContact } from "@/lib/supabase/types"
import {
  createContact,
  updateContact,
  deleteContact,
  setPrimaryContact,
  referToNewContact,
  type ContactInput,
} from "@/lib/buyers/contacts-actions"

interface Props {
  leadId: string
  initialContacts: BuyerContact[]
  locale: "vi" | "en"
  canWrite: boolean
  canViewPII: boolean
  /** Called whenever contacts change so parents (e.g. email pickers) can refresh. */
  onContactsChange?: (contacts: BuyerContact[]) => void
}

const emptyForm: ContactInput = {
  full_name: "",
  title: "",
  email: "",
  phone: "",
  department: "",
  market_region: "",
  is_decision_maker: false,
  notes: "",
}

export function BuyerContactsPanel({
  leadId,
  initialContacts,
  locale,
  canWrite,
  canViewPII,
  onContactsChange,
}: Props) {
  const [contacts, setContacts] = useState<BuyerContact[]>(initialContacts)
  const [pending, startTransition] = useTransition()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "refer">("create")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [referFromId, setReferFromId] = useState<string | null>(null)
  const [form, setForm] = useState<ContactInput>(emptyForm)

  const [deleteTarget, setDeleteTarget] = useState<BuyerContact | null>(null)

  const sorted = useMemo(
    () =>
      [...contacts].sort((a, b) => {
        if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      }),
    [contacts],
  )

  const L =
    locale === "vi"
      ? {
          title: "Danh bạ liên hệ",
          add: "Thêm liên hệ",
          empty: "Chưa có liên hệ nào",
          emptyDesc: "Thêm liên hệ đầu tiên cho buyer này.",
          primary: "Chính",
          decisionMaker: "Người quyết định",
          moved: "Đã chuyển việc",
          inactive: "Không hoạt động",
          setPrimary: "Đặt làm liên hệ chính",
          edit: "Chỉnh sửa",
          delete: "Xóa",
          refer: "Giới thiệu người khác",
          referredFrom: "Được giới thiệu bởi liên hệ cũ",
          createTitle: "Thêm liên hệ mới",
          editTitle: "Chỉnh sửa liên hệ",
          referTitle: "Giới thiệu sang liên hệ mới",
          referDesc: "Liên hệ hiện tại sẽ được đánh dấu 'đã chuyển việc' và liên hệ mới sẽ trở thành liên hệ chính.",
          fullName: "Họ tên",
          jobTitle: "Chức danh",
          email: "Email",
          phone: "Điện thoại",
          department: "Phòng ban",
          marketRegion: "Thị trường / Khu vực",
          decisionMakerLabel: "Là người quyết định",
          notes: "Ghi chú",
          cancel: "Hủy",
          save: "Lưu",
          create: "Tạo",
          deleteConfirmTitle: "Xóa liên hệ này?",
          deleteConfirmDesc: "Hành động này không thể hoàn tác.",
          saved: "Đã lưu liên hệ",
          created: "Đã tạo liên hệ mới",
          deleted: "Đã xóa liên hệ",
          primarySet: "Đã đặt liên hệ chính",
          referred: "Đã giới thiệu sang liên hệ mới",
          error: "Có lỗi xảy ra, vui lòng thử lại",
          nameRequired: "Vui lòng nhập họ tên",
        }
      : {
          title: "Contact Directory",
          add: "Add contact",
          empty: "No contacts yet",
          emptyDesc: "Add the first contact for this buyer.",
          primary: "Primary",
          decisionMaker: "Decision maker",
          moved: "Moved on",
          inactive: "Inactive",
          setPrimary: "Set as primary",
          edit: "Edit",
          delete: "Delete",
          refer: "Refer to new contact",
          referredFrom: "Referred from a previous contact",
          createTitle: "Add new contact",
          editTitle: "Edit contact",
          referTitle: "Refer to a new contact",
          referDesc: "The current contact will be marked 'moved on' and the new contact will become primary.",
          fullName: "Full name",
          jobTitle: "Title",
          email: "Email",
          phone: "Phone",
          department: "Department",
          marketRegion: "Market / Region",
          decisionMakerLabel: "Is decision maker",
          notes: "Notes",
          cancel: "Cancel",
          save: "Save",
          create: "Create",
          deleteConfirmTitle: "Delete this contact?",
          deleteConfirmDesc: "This action cannot be undone.",
          saved: "Contact saved",
          created: "Contact created",
          deleted: "Contact deleted",
          primarySet: "Primary contact updated",
          referred: "Referred to new contact",
          error: "Something went wrong, please try again",
          nameRequired: "Please enter a full name",
        }

  function emitChange(next: BuyerContact[]) {
    setContacts(next)
    onContactsChange?.(next)
  }

  function openCreate() {
    setDialogMode("create")
    setEditingId(null)
    setReferFromId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(c: BuyerContact) {
    setDialogMode("edit")
    setEditingId(c.id)
    setReferFromId(null)
    setForm({
      full_name: c.full_name,
      title: c.title ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      department: c.department ?? "",
      market_region: c.market_region ?? "",
      is_decision_maker: c.is_decision_maker,
      notes: c.notes ?? "",
    })
    setDialogOpen(true)
  }

  function openRefer(c: BuyerContact) {
    setDialogMode("refer")
    setEditingId(null)
    setReferFromId(c.id)
    setForm({ ...emptyForm, is_decision_maker: true })
    setDialogOpen(true)
  }

  function handleSubmit() {
    if (!form.full_name.trim()) {
      toast.error(L.nameRequired)
      return
    }

    startTransition(async () => {
      if (dialogMode === "create") {
        const res = await createContact(leadId, form)
        if (!res.success || !res.data) {
          toast.error(res.error ?? L.error)
          return
        }
        emitChange([...contacts, res.data])
        toast.success(L.created)
      } else if (dialogMode === "edit" && editingId) {
        const res = await updateContact(editingId, leadId, form)
        if (!res.success || !res.data) {
          toast.error(res.error ?? L.error)
          return
        }
        emitChange(contacts.map((c) => (c.id === editingId ? (res.data as BuyerContact) : c)))
        toast.success(L.saved)
      } else if (dialogMode === "refer" && referFromId) {
        const res = await referToNewContact(referFromId, leadId, form)
        if (!res.success || !res.data) {
          toast.error(res.error ?? L.error)
          return
        }
        emitChange([
          ...contacts.map((c) => (c.id === referFromId ? { ...c, status: "moved", is_primary: false } : c)),
          res.data,
        ])
        toast.success(L.referred)
      }
      setDialogOpen(false)
    })
  }

  function handleSetPrimary(c: BuyerContact) {
    startTransition(async () => {
      const res = await setPrimaryContact(c.id, leadId)
      if (!res.success) {
        toast.error(res.error ?? L.error)
        return
      }
      emitChange(contacts.map((x) => ({ ...x, is_primary: x.id === c.id })))
      toast.success(L.primarySet)
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    const target = deleteTarget
    startTransition(async () => {
      const res = await deleteContact(target.id, leadId)
      if (!res.success) {
        toast.error(res.error ?? L.error)
        return
      }
      emitChange(contacts.filter((c) => c.id !== target.id))
      toast.success(L.deleted)
      setDeleteTarget(null)
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Users className="h-4 w-4 text-primary" />
          {L.title}
        </div>
        {canWrite && (
          <Button type="button" size="sm" variant="outline" onClick={openCreate} disabled={pending}>
            <Plus className="h-4 w-4" />
            {L.add}
          </Button>
        )}
      </div>

      {sorted.length === 0 ? (
        <Card className="border-border">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{L.empty}</EmptyTitle>
              <EmptyDescription>{L.emptyDesc}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((c) => (
            <Card key={c.id} className={`border-border ${c.status !== "active" ? "opacity-60" : ""}`}>
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-foreground">{c.full_name}</span>
                    {c.is_primary && (
                      <Badge variant="secondary" className="h-5 gap-1 px-1.5 text-[11px] font-normal">
                        <Star className="h-3 w-3" />
                        {L.primary}
                      </Badge>
                    )}
                    {c.is_decision_maker && (
                      <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[11px] font-normal">
                        <ShieldCheck className="h-3 w-3" />
                        {L.decisionMaker}
                      </Badge>
                    )}
                    {c.status === "moved" && (
                      <Badge variant="outline" className="h-5 px-1.5 text-[11px] font-normal text-muted-foreground">
                        {L.moved}
                      </Badge>
                    )}
                    {c.status === "inactive" && (
                      <Badge variant="outline" className="h-5 px-1.5 text-[11px] font-normal text-muted-foreground">
                        {L.inactive}
                      </Badge>
                    )}
                  </div>

                  {(c.title || c.department) && (
                    <p className="truncate text-xs text-muted-foreground">
                      {[c.title, c.department].filter(Boolean).join(" · ")}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {c.email && (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {canViewPII ? c.email : maskEmail(c.email)}
                      </span>
                    )}
                    {c.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {canViewPII ? c.phone : maskPhone(c.phone)}
                      </span>
                    )}
                    {c.market_region && (
                      <span className="inline-flex items-center gap-1">
                        <Globe2 className="h-3 w-3" />
                        {c.market_region}
                      </span>
                    )}
                  </div>

                  {c.referred_by_contact_id && (
                    <p className="text-[11px] text-muted-foreground italic">{L.referredFrom}</p>
                  )}
                </div>

                {canWrite && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={pending}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {!c.is_primary && c.status === "active" && (
                        <DropdownMenuItem onClick={() => handleSetPrimary(c)}>
                          <Star className="h-4 w-4" />
                          {L.setPrimary}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                        {L.edit}
                      </DropdownMenuItem>
                      {c.status === "active" && (
                        <DropdownMenuItem onClick={() => openRefer(c)}>
                          <ArrowRightLeft className="h-4 w-4" />
                          {L.refer}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeleteTarget(c)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                        {L.delete}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit / Refer dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "create" ? L.createTitle : dialogMode === "edit" ? L.editTitle : L.referTitle}
            </DialogTitle>
            {dialogMode === "refer" && <DialogDescription>{L.referDesc}</DialogDescription>}
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="cf-name">{L.fullName}</Label>
              <Input
                id="cf-name"
                value={form.full_name}
                onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-title">{L.jobTitle}</Label>
              <Input
                id="cf-title"
                value={form.title ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-department">{L.department}</Label>
              <Input
                id="cf-department"
                value={form.department ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))}
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-email">{L.email}</Label>
              <Input
                id="cf-email"
                type="email"
                value={form.email ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-phone">{L.phone}</Label>
              <Input
                id="cf-phone"
                value={form.phone ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                disabled={pending}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="cf-region">{L.marketRegion}</Label>
              <Input
                id="cf-region"
                value={form.market_region ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, market_region: e.target.value }))}
                disabled={pending}
              />
            </div>
            <div className="col-span-2 flex items-center justify-between rounded-md border border-border px-3 py-2">
              <Label htmlFor="cf-decision" className="text-sm font-normal">
                {L.decisionMakerLabel}
              </Label>
              <Switch
                id="cf-decision"
                checked={!!form.is_decision_maker}
                onCheckedChange={(v) => setForm((p) => ({ ...p, is_decision_maker: v }))}
                disabled={pending}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="cf-notes">{L.notes}</Label>
              <Textarea
                id="cf-notes"
                rows={3}
                value={form.notes ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                disabled={pending}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={pending}>
              {L.cancel}
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {dialogMode === "create" || dialogMode === "refer" ? L.create : L.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{L.deleteConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{L.deleteConfirmDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{L.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={pending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {L.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
