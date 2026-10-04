import Link from "next/link"
import { Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getLocale } from "@/lib/i18n/server"
import { localizePath } from "@/lib/i18n/routing"
import { getProfileCopy } from "@/lib/profile/translations"

export default async function ProfileNotFound() {
  const locale = await getLocale()
  const copy = getProfileCopy(locale)

  return (
    <main lang={locale} className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
          <Building2 className="w-10 h-10 text-muted-foreground" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">
          {copy.metadata.notFound}
        </h1>
        <p className="text-muted-foreground mb-6">{copy.metadata.notFoundDescription}</p>

        <Button asChild>
          <Link href={localizePath("/", locale)}>{copy.metadata.homePage}</Link>
        </Button>
      </div>
    </main>
  )
}
