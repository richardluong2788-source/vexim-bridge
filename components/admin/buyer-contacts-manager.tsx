"use client"

import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import {
  UserRound,
  Mail,
  Phone,
  Briefcase,
  Globe2,
  Star,
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  ArrowRightCircle,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
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
}

const EMPTY_FORM: ContactInput = {
  full_name: "",
  title: "",
  email: "",
  phone: "",
  department: "",
  market_region: "",
  is_decision_maker: false,
  notes: "",
}

export function BuyerContactsManager({ leadId, initialContacts, locale, canWrite }: Props) {
  const [contacts, setContacts] = useState<BuyerContact[]>(initialContacts)
  const [pending, startTransition] = useTransition()

  // Dialog state: "create" | "edit" | "refer" | null
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "refer" | null>(null)
  const [activeContact, setActiveContact] = useState<BuyerContact | null>(null)
  const [form, setForm] = useState<ContactInput>(EMPTY_FORM)

  const activeContacts = useMemo(
    () => contacts.filter((c) => c.status === "active"),
    [contacts],
  )
  const movedContacts = useMemo(
    () => contacts.filter((c) => c.status !== "active"),
    [contacts],
  )

  const L = {
    title: locale === "vi" ? "Danh bạ liên hệ" : "Contacts",
    subtitle:
      locale === "vi"
        ? "Nhiều người liên hệ / phòng ban / đại diện thị trường cho công ty này."
        : "Multiple contacts / departments / market reps for this company.",
    add: locale === "vi" ? "Thêm liên hệ" : "Add contact",
    empty: locale === "vi" ? "Chưa có liên hệ nào" : "No contacts yet",
    emptyDesc:
      locale === "vi"
        ? "Thêm người liên hệ đầu tiên cho công ty này."
        : "Add the first contact for this company.",
    primary: locale === "vi" ? "Chính" : "Primary",
    decisionMaker: locale === "vi" ? "Người quyết định" : "Decision maker",
    setPrimary: locale === "vi" ? "Đặt làm liên hệ chính" : "Set as primary",
    refer: locale === "vi" ? "Giới thiệu sang người khác" : "Refer to someone else",
    edit: locale === "vi" ? "Sửa" : "Edit",
    delete: locale === "vi" ? "Xóa" : "Delete",
    movedSection: locale === "vi" ? "Đã chuyển / không còn phụ trách" : "Moved / no longer handling",
    referredFrom: locale === "vi" ? "Được giới thiệu từ" : "Referred from",
    fullName: locale === "vi" ? "Họ tên" : "Full name",
    titleField: locale === "vi" ? "Chức vụ" : "Title",
    email: locale === "vi" ? "Email" : "Email",
    phone: locale === "vi" ? "Điện thoại" : "Phone",
    department: locale === "vi" ? "Phòng ban" : "Department",
    marketRegion: locale === "vi" ? "Thị trường / khu vực phụ trách" : "Market / region",
    notes: locale === "vi" ? "Ghi chú" : "Notes",
    save: locale === "vi" ? "Lưu" : "Save",
    cancel: locale === "vi" ? "Hủy" : "Cancel",
    createTitle: locale === "vi" ? "Thêm liên hệ mới" : "Add new contact",
    editTitle: locale === "vi" ? "Sửa liên hệ" : "Edit contact",
    referTitle: locale === "vi" ? "Giới thiệu sang người khác" : "Refer to a new contact",
    referDesc:
      locale === "vi"
        ? "Liên hệ hiện tại sẽ được đánh dấu 'đã chuyển' và người mới sẽ trở thành liên hệ chính."
        : "The current contact will be marked as 'moved' and the new person becomes primary.",
    confirmDelete:
      locale === "vi" ? "Xóa liên hệ này?" : "Delete this contact?",
  }

  function openCreate() {
    setForm(EMPTY_FORM)
    setActiveContact(null)
    setDialogMode("create")
  }

  function openEdit(contact: BuyerContact) {
    setForm({
      full_name: contact.full_name,
      title: contact.title ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      department: contact.department ?? "",
      market_region: contact.market_region ?? "",
      is_decision_maker: contact.is_decision_maker,
      notes: contact.notes ?? "",
    })
    setActiveContact(contact)
    setDialogMode("edit")
  }

  function openRefer(contact: BuyerContact) {
    setForm(EMPTY_FORM)
    setActiveContact(contact)
    setDialogMode("refer")
  }

  function closeDialog() {
    setDialogMode(null)
    setActiveContact(null)
    setForm(EMPTY_FORM)
  }

  function handleSubmit() {
    if (!form.full_name.trim()) {
      toast.error(locale === "vi" ? "Vui lòng nhập họ tên" : "Please enter a full name")
      return
    }

    startTransition(async () => {
      if (dialogMode === "create") {
        const res = await createContact(leadId, form)
        if (res.success && res.data) {
          setContacts((prev) => {
            const next = res.data!.is_primary
              ? prev.map((c) => ({ ...c, is_primary: false }))
              : prev
            return [...next, res.data!]
          })
          toast.success(locale === "vi" ? "Đã thêm liên hệ" : "Contact added")
          closeDialog()
        } else {
          toast.error(res.error ?? "Error")
        }
      } else if (dialogMode === "edit" && activeContact) {
        const res = await updateContact(activeContact.id, leadId, form)
        if (res.success && res.data) {
          setContacts((prev) => prev.map((c) => (c.id === res.data!.id ? res.data! : c)))
          toast.success(locale === "vi" ? "Đã lưu" : "Saved")
          closeDialog()
        } else {
          toast.error(res.error ?? "Error")
        }
      } else if (dialogMode === "refer" && activeContact) {
        const res = await referToNewContact(activeContact.id, leadId, form)
        if (res.success && res.data) {
          setContacts((prev) => [
            ...prev.map((c) =>
              c.id === activeContact.id ? { ...c, status: "moved", is_primary: false } : { ...c, is_primary: false },
            ),
            res.data!,
          ])
          toast.success(
            locale === "vi" ? "Đã ghi nhận giới thiệu sang liên hệ mới" : "Referral recorded to new contact",
          )
          closeDialog()
        } else {
          toast.error(res.error ?? "Error")
        }
      }
    })
  }

  function handleSetPrimary(contact: BuyerContact) {
    startTransition(async () => {
      const res = await setPrimaryContact(contact.id, leadId)
      if (res.success) {
        setContacts((prev) =>
          prev.map((c) => ({ ...c, is_primary: c.id === contact.id })),
        )
        toast.success(locale === "vi" ? "Đã đặt liên hệ chính" : "Primary contact updated")
      } else {
        toast.error(res.error ?? "Error")
      }
    })
  }

  function handleDelete(contact: BuyerContact) {
    if (!confirm(L.confirmDelete)) return
    startTransition(async () => {
      const res = await deleteContact(contact.id, leadId)
      if (res.success) {
        setContacts((prev) => prev.filter((c) => c.id !== contact.id))
        toast.success(locale === "vi" ? "Đã xóa" : "Deleted")
      } else {
        toast.error(res.error ?? "Error")
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{L.title}</h3>
          <p className="text-xs text-muted-foreground">{L.subtitle}</p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            {L.add}
          </Button>
        )}
      </div>

      {activeContacts.length === 0 ? (
        <Card className="border-border">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{L.empty}</EmptyTitle>
              <EmptyDescription>{L.emptyDesc}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {activeContacts.map((contact) => (
            <Card key={contact.id} className="border-border">
              <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between">
                <div className="flex flex-col gap-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <UserRound className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">{contact.full_name}</span>
                    {contact.is_primary && (
                      <Badge variant="outline" className="gap-1 border-chart-1/40 bg-chart-1/10 text-chart-1">
                        <Star className="h-3 w-3" />
                        {L.primary}
                      </Badge>
                    )}
                    {contact.is_decision_maker && (
                      <Badge variant="outline" className="gap-1 border-chart-4/40 bg-chart-4/10 text-chart-4">
                        <ShieldCheck className="h-3 w-3" />
                        {L.decisionMaker}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {contact.title && (
                      <span className="inline-flex items-center gap-1">
                        <Briefcase className="h-3 w-3" />
                        {contact.title}
                      </span>
                    )}
                    {contact.department && (
                      <span className="inline-flex items-center gap-1">{contact.department}</span>
                    )}
                    {contact.market_region && (
                      <span className="inline-flex items-center gap-1">
                        <Globe2 className="h-3 w-3" />
                        {contact.market_region}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground">
                    {contact.email && (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        {contact.email}
                      </span>
                    )}
                    {contact.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        {contact.phone}
                      </span>
                    )}
                  </div>
                  {contact.notes && <p className="text-xs text-muted-foreground">{contact.notes}</p>}
                </div>

                {canWrite && (
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    {!contact.is_primary && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => handleSetPrimary(contact)}
                      >
                        <Star className="mr-1 h-3.5 w-3.5" />
                        {L.setPrimary}
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => openRefer(contact)}>
                      <ArrowRightCircle className="mr-1 h-3.5 w-3.5" />
                      {L.refer}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(contact)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(contact)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {movedContacts.length > 0 && (
        <div className="flex flex-col gap-2 pt-2">
          <h4 className="text-xs font-medium text-muted-foreground">{L.movedSection}</h4>
          {movedContacts.map((contact) => (
            <Card key={contact.id} className="border-dashed border-border bg-muted/30">
              <CardContent className="flex items-center justify-between gap-3 p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <UserRound className="h-3.5 w-3.5" />
                  <span className="line-through">{contact.full_name}</span>
                  {contact.title && <span>· {contact.title}</span>}
                  {contact.email && <span>· {contact.email}</span>}
                </div>
                <Badge variant="outline" className="text-[11px]">
                  {contact.status === "moved"
                    ? locale === "vi"
                      ? "Đã chuyển"
                      : "Moved"
                    : locale === "vi"
                      ? "Không hoạt động"
                      : "Inactive"}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit / Refer dialog */}
      <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "create" && L.createTitle}
              {dialogMode === "edit" && L.editTitle}
              {dialogMode === "refer" && L.referTitle}
            </DialogTitle>
            {dialogMode === "refer" && <DialogDescription>{L.referDesc}</DialogDescription>}
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{L.fullName} *</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>{L.titleField}</Label>
                <Input
                  value={form.title ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{L.department}</Label>
                <Input
                  value={form.department ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>{L.email}</Label>
                <Input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{L.phone}</Label>
                <Input
                  value={form.phone ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{L.marketRegion}</Label>
              <Input
                placeholder={locale === "vi" ? "VD: Bắc Mỹ, EU, chi nhánh Mexico..." : "e.g. North America, EU, Mexico branch..."}
                value={form.market_region ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, market_region: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <Label className="text-sm">{L.decisionMaker}</Label>
              <Switch
                checked={!!form.is_decision_maker}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_decision_maker: v }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{L.notes}</Label>
              <Textarea
                rows={2}
                value={form.notes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={pending}>
              {L.cancel}
            </Button>
            <Button onClick={handleSubmit} disabled={pending}>
              {pending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {L.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
