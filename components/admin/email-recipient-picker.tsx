"use client"

import { useMemo, useState } from "react"
import { Check, ChevronsUpDown, X, User, Star } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { BuyerContact } from "@/lib/supabase/types"

export interface RecipientOption {
  id: string
  name: string
  email: string
  role?: string | null
  isPrimary?: boolean
}

export function contactsToRecipientOptions(contacts: BuyerContact[]): RecipientOption[] {
  return contacts
    .filter((c) => !!c.email)
    .map((c) => ({
      id: c.id,
      name: c.full_name || c.email!,
      email: c.email as string,
      role: c.title,
      isPrimary: c.is_primary,
    }))
}

interface EmailRecipientPickerProps {
  label: string
  placeholder?: string
  options: RecipientOption[]
  selectedEmails: string[]
  onChange: (emails: string[]) => void
  locale: "vi" | "en"
  disabled?: boolean
  emptyLabel?: string
  allowFreeform?: boolean
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function EmailRecipientPicker({
  label,
  placeholder,
  options,
  selectedEmails,
  onChange,
  locale,
  disabled,
  emptyLabel,
  allowFreeform = true,
}: EmailRecipientPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const selectedSet = useMemo(() => new Set(selectedEmails.map((e) => e.toLowerCase())), [selectedEmails])

  const knownByEmail = useMemo(() => {
    const map = new Map<string, RecipientOption>()
    for (const opt of options) map.set(opt.email.toLowerCase(), opt)
    return map
  }, [options])

  function toggleEmail(email: string) {
    const key = email.toLowerCase()
    if (selectedSet.has(key)) {
      onChange(selectedEmails.filter((e) => e.toLowerCase() !== key))
    } else {
      onChange([...selectedEmails, email])
    }
  }

  function removeEmail(email: string) {
    const key = email.toLowerCase()
    onChange(selectedEmails.filter((e) => e.toLowerCase() !== key))
  }

  const trimmedSearch = search.trim()
  const canAddFreeform = allowFreeform && EMAIL_RE.test(trimmedSearch) && !selectedSet.has(trimmedSearch.toLowerCase())

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "h-auto min-h-9 w-full justify-between px-3 py-1.5 font-normal",
              selectedEmails.length === 0 && "text-muted-foreground",
            )}
          >
            <div className="flex flex-1 flex-wrap items-center gap-1 text-left">
              {selectedEmails.length === 0 ? (
                <span>{placeholder ?? (locale === "vi" ? "Chọn người nhận..." : "Select recipients...")}</span>
              ) : (
                selectedEmails.map((email) => {
                  const known = knownByEmail.get(email.toLowerCase())
                  return (
                    <Badge
                      key={email}
                      variant="secondary"
                      className="gap-1 pr-1 font-normal"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {known?.isPrimary && <Star className="h-3 w-3 fill-current" />}
                      <span className="max-w-[180px] truncate">{known ? known.name : email}</span>
                      <button
                        type="button"
                        className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeEmail(email)
                        }}
                        aria-label={locale === "vi" ? `Xoá ${email}` : `Remove ${email}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )
                })
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={locale === "vi" ? "Tìm liên hệ hoặc nhập email..." : "Search contacts or type an email..."}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty className="px-3 py-4 text-sm text-muted-foreground">
                {canAddFreeform
                  ? locale === "vi"
                    ? "Nhấn để thêm email này"
                    : "Press to add this email"
                  : emptyLabel ?? (locale === "vi" ? "Không tìm thấy liên hệ" : "No contacts found")}
              </CommandEmpty>
              <CommandGroup>
                {options
                  .filter((opt) => {
                    if (!trimmedSearch) return true
                    const q = trimmedSearch.toLowerCase()
                    return opt.name.toLowerCase().includes(q) || opt.email.toLowerCase().includes(q)
                  })
                  .map((opt) => {
                    const isSelected = selectedSet.has(opt.email.toLowerCase())
                    return (
                      <CommandItem
                        key={opt.id}
                        value={opt.email}
                        onSelect={() => toggleEmail(opt.email)}
                        className="gap-2"
                      >
                        <div
                          className={cn(
                            "flex h-4 w-4 items-center justify-center rounded-sm border",
                            isSelected ? "bg-primary border-primary text-primary-foreground" : "border-input",
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm">{opt.name}</span>
                          <span className="truncate text-xs text-muted-foreground">{opt.email}</span>
                        </div>
                        {opt.isPrimary && <Star className="h-3.5 w-3.5 shrink-0 fill-current text-amber-500" />}
                        {opt.role && (
                          <Badge variant="outline" className="shrink-0 text-[10px] font-normal">
                            {opt.role}
                          </Badge>
                        )}
                      </CommandItem>
                    )
                  })}
              </CommandGroup>
              {canAddFreeform && (
                <CommandGroup>
                  <CommandItem
                    value={trimmedSearch}
                    onSelect={() => {
                      toggleEmail(trimmedSearch)
                      setSearch("")
                    }}
                    className="gap-2"
                  >
                    <div className="flex h-4 w-4 items-center justify-center rounded-sm border border-input" />
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate text-sm">{trimmedSearch}</span>
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
