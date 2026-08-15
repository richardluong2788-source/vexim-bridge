"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Building2, Check, Mail, MapPin, Pencil, Phone, Plus, Star, UserRound, UserRoundPlus, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { BuyerContact } from "@/lib/supabase/types"
import { createBuyerContact, updateBuyerContact, deleteBuyerContact, setPrimaryBuyerContact, referBuyerContact } from "@/lib/buyers/contacts-actions"

type ContactForm = {
  full_name: string; title: string; email: string; phone: string; department: string
  market_region: string; is_primary: boolean; is_decision_maker: boolean; status: string; notes: string
}
const emptyForm: ContactForm = { full_name: "", title: "", email: "", phone: "", department: "", market_region: "", is_primary: false, is_decision_maker: false, status: "active", notes: "" }

export function BuyerContactsManager({ leadId, initialContacts, canWrite, locale }: { leadId: string; initialContacts: BuyerContact[]; canWrite: boolean; locale: string }) {
  const [contacts, setContacts] = useState(initialContacts)
  const [form, setForm] = useState<ContactForm>(emptyForm)
  const [editing, setEditing] = useState<BuyerContact | null>(null)
  const [open, setOpen] = useState(false)
  const [referrer, setReferrer] = useState<BuyerContact | null>(null)
  const [busy, startTransition] = useTransition()
  const vi = locale === "vi"

  const openCreate = () => { setEditing(null); setForm(emptyForm); setOpen(true) }
  const openEdit = (c: BuyerContact) => { setEditing(c); setForm({ full_name: c.full_name, title: c.title ?? "", email: c.email ?? "", phone: c.phone ?? "", department: c.department ?? "", market_region: c.market_region ?? "", is_primary: c.is_primary, is_decision_maker: c.is_decision_maker, status: c.status, notes: c.notes ?? "" }); setOpen(true) }
  const update = (key: keyof ContactForm, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }))

  const save = () => startTransition(async () => {
    const result = editing ? await updateBuyerContact(editing.id, form) : await createBuyerContact({ lead_id: leadId, ...form })
    if (!result.success) { toast.error(result.error); return }
    const next = result.data as BuyerContact
    setContacts((current) => editing ? current.map((c) => c.id === next.id ? next : c) : [...current, next])
    setOpen(false); toast.success(vi ? "Đã lưu liên hệ" : "Contact saved")
  })

  const makePrimary = (id: string) => startTransition(async () => {
    const result = await setPrimaryBuyerContact(id)
    if (!result.success) { toast.error(result.error); return }
    setContacts((current) => current.map((c) => ({ ...c, is_primary: c.id === id })))
    toast.success(vi ? "Đã đặt liên hệ chính" : "Primary contact updated")
  })
  const remove = (id: string) => startTransition(async () => {
    const result = await deleteBuyerContact(id)
    if (!result.success) { toast.error(result.error); return }
    setContacts((current) => current.filter((c) => c.id !== id)); toast.success(vi ? "Đã xóa liên hệ" : "Contact removed")
  })
  const createReferral = () => startTransition(async () => {
    const result = await referBuyerContact({ lead_id: leadId, referred_by_contact_id: referrer?.id ?? null, ...form })
    if (!result.success) { toast.error(result.error); return }
    setContacts((current) => [...current, result.data as BuyerContact]); setReferrer(null); setForm(emptyForm); toast.success(vi ? "Đã thêm liên hệ được giới thiệu" : "Referred contact added")
  })

  return <Card className="border-border">
    <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
      <div><CardTitle className="flex items-center gap-2 text-base"><UserRound className="h-4 w-4 text-primary" />{vi ? "Danh bạ liên hệ" : "Contact directory"}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{vi ? "Nhiều phòng ban, quốc gia và người ra quyết định của buyer" : "Departments, regions and decision makers at this buyer"}</p></div>
      {canWrite && <Button size="sm" onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" />{vi ? "Thêm liên hệ" : "Add contact"}</Button>}
    </CardHeader>
    <CardContent className="flex flex-col gap-3">
      {contacts.length === 0 ? <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{vi ? "Chưa có liên hệ. Thêm người liên hệ đầu tiên." : "No contacts yet. Add the first contact."}</div> : contacts.map((c) => <div key={c.id} className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 flex-col gap-2"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{c.full_name}</span>{c.is_primary && <Badge variant="secondary"><Star className="mr-1 h-3 w-3" />{vi ? "Chính" : "Primary"}</Badge>}{c.is_decision_maker && <Badge variant="outline">{vi ? "Quyết định" : "Decision maker"}</Badge>}{c.status !== "active" && <Badge variant="outline">{c.status}</Badge>}</div><div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">{c.title && <span className="inline-flex items-center gap-1"><UserRound className="h-3 w-3" />{c.title}</span>}{c.department && <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{c.department}</span>}{c.market_region && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{c.market_region}</span>}{c.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}{c.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}</div>{c.notes && <p className="text-xs text-muted-foreground">{c.notes}</p>}</div>
        {canWrite && <div className="flex shrink-0 flex-wrap gap-1"><Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Pencil className="mr-1 h-3.5 w-3.5" />{vi ? "Sửa" : "Edit"}</Button>{!c.is_primary && <Button variant="ghost" size="sm" onClick={() => makePrimary(c.id)} disabled={busy}><Check className="mr-1 h-3.5 w-3.5" />{vi ? "Đặt chính" : "Set primary"}</Button>}<Button variant="ghost" size="sm" onClick={() => { setReferrer(c); setForm(emptyForm) }}><UserRoundPlus className="mr-1 h-3.5 w-3.5" />{vi ? "Giới thiệu" : "Refer"}</Button><Button variant="ghost" size="icon" onClick={() => remove(c.id)} disabled={busy} aria-label={vi ? "Xóa liên hệ" : "Remove contact"}><X className="h-4 w-4" /></Button></div>}
      </div>)}
    </CardContent>

    <Dialog open={open || !!referrer} onOpenChange={(value) => { if (!value) { setOpen(false); setReferrer(null) } }}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>{referrer ? (vi ? `Thêm người được ${referrer.full_name} giới thiệu` : `Add contact referred by ${referrer.full_name}`) : editing ? (vi ? "Sửa liên hệ" : "Edit contact") : (vi ? "Thêm liên hệ mới" : "Add contact")}</DialogTitle><DialogDescription>{vi ? "Lưu phòng ban, thị trường phụ trách và vai trò ra quyết định để AE gửi đúng người." : "Capture department, market responsibility and decision-making role so AEs reach the right person."}</DialogDescription></DialogHeader><div className="grid gap-4 md:grid-cols-2"><div className="grid gap-2"><Label>{vi ? "Họ tên" : "Full name"} *</Label><Input value={form.full_name} onChange={(e) => update("full_name", e.target.value)} /></div><div className="grid gap-2"><Label>{vi ? "Chức vụ" : "Title"}</Label><Input value={form.title} onChange={(e) => update("title", e.target.value)} /></div><div className="grid gap-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} /></div><div className="grid gap-2"><Label>{vi ? "Số điện thoại" : "Phone"}</Label><Input value={form.phone} onChange={(e) => update("phone", e.target.value)} /></div><div className="grid gap-2"><Label>{vi ? "Phòng ban" : "Department"}</Label><Input placeholder={vi ? "Purchasing, QA, Import..." : "Purchasing, QA, Import..."} value={form.department} onChange={(e) => update("department", e.target.value)} /></div><div className="grid gap-2"><Label>{vi ? "Thị trường/khu vực phụ trách" : "Market / region"}</Label><Input placeholder="US East, EU, Japan..." value={form.market_region} onChange={(e) => update("market_region", e.target.value)} /></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_decision_maker} onChange={(e) => update("is_decision_maker", e.target.checked)} />{vi ? "Là người ra quyết định" : "Decision maker"}</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_primary} onChange={(e) => update("is_primary", e.target.checked)} />{vi ? "Đặt làm liên hệ chính" : "Set as primary"}</label><div className="md:col-span-2 grid gap-2"><Label>{vi ? "Ghi chú" : "Notes"}</Label><Textarea rows={3} value={form.notes} onChange={(e) => update("notes", e.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={() => { setOpen(false); setReferrer(null) }}>{vi ? "Hủy" : "Cancel"}</Button><Button onClick={referrer ? createReferral : save} disabled={busy || !form.full_name.trim()}>{busy ? "Saving..." : vi ? "Lưu" : "Save"}</Button></DialogFooter></DialogContent></Dialog>
  </Card>
}
