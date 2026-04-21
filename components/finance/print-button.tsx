"use client"

import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"

export function PrintButton({ label = "In / Lưu PDF" }: { label?: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => window.print()}
      className="gap-2"
    >
      <Printer className="h-3.5 w-3.5" />
      {label}
    </Button>
  )
}
