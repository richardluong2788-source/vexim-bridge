import Link from "next/link"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getDictionary } from "@/lib/i18n/server"

export default async function AuthErrorPage() {
  const { t } = await getDictionary()

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 text-center max-w-sm px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-foreground">{t.auth.error.title}</h1>
          <p className="text-sm text-muted-foreground text-pretty">{t.auth.error.description}</p>
        </div>
        <Button asChild>
          <Link href="/auth/login">{t.auth.error.backToLogin}</Link>
        </Button>
      </div>
    </div>
  )
}
