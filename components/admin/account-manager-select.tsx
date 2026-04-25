"use client"

/**
 * Inline dropdown for assigning a staff member as account manager to a
 * client row. Used in /admin/clients table.
 *
 * Behaviour
 * ---------
 *   - When `canEdit` is false, renders a static label (read-only).
 *   - When `canEdit` is true, renders a Radix Select. Saving fires the
 *     server action and shows a toast on success/failure.
 *   - "Unassigned" uses a sentinel value because Radix Select does not
 *     accept empty strings as item values.
 *   - Optimistic state — we keep `current` in local state so the UI stays
 *     responsive while revalidatePath round-trips.
 */
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { UserCog, User } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { setAccountManager } from "@/app/admin/clients/account-manager-actions"

const NONE = "__none__"

export interface ManagerOption {
  id: string
  label: string
  /** Short role tag shown in the dropdown ("AE", "Researcher", "Admin"…). */
  roleLabel: string
}

interface Props {
  clientId: string
  currentManagerId: string | null
  managers: ManagerOption[]
  canEdit: boolean
  /** Display the chosen manager's name when not editing. */
  currentManagerLabel: string | null
}

export function AccountManagerSelect({
  clientId,
  currentManagerId,
  managers,
  canEdit,
  currentManagerLabel,
}: Props) {
  const [value, setValue] = useState<string>(currentManagerId ?? NONE)
  const [isPending, startTransition] = useTransition()

  if (!canEdit) {
    return currentManagerLabel ? (
      <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
        <User className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        {currentManagerLabel}
      </span>
    ) : (
      <Badge variant="outline" className="font-normal text-muted-foreground">
        Chưa gán
      </Badge>
    )
  }

  function handleChange(next: string) {
    const previous = value
    setValue(next)
    startTransition(async () => {
      const result = await setAccountManager(
        clientId,
        next === NONE ? null : next,
      )
      if (!result.ok) {
        setValue(previous)
        toast.error(`Không thể gán account manager: ${result.error ?? "lỗi"}`)
        return
      }
      const newLabel =
        next === NONE
          ? "Đã bỏ gán"
          : (managers.find((m) => m.id === next)?.label ?? "Đã gán")
      toast.success(newLabel)
    })
  }

  return (
    <Select value={value} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger
        size="sm"
        className="h-8 w-[180px] text-xs data-[placeholder]:text-muted-foreground"
        aria-label="Account manager"
      >
        <UserCog
          className="h-3.5 w-3.5 text-muted-foreground"
          aria-hidden="true"
        />
        <SelectValue placeholder="Chưa gán" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>
          <span className="text-muted-foreground">Chưa gán</span>
        </SelectItem>
        {managers.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            <span className="flex items-center gap-2">
              <span>{m.label}</span>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {m.roleLabel}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
