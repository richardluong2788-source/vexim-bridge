import Link from "next/link"
import { Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function ProfileNotFound() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
          <Building2 className="w-10 h-10 text-muted-foreground" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">
          Profile Not Found
        </h1>
        <p className="text-muted-foreground mb-6">
          The supplier profile you&apos;re looking for doesn&apos;t exist or has been
          unpublished.
        </p>

        <Button asChild>
          <Link href="/">Go to Homepage</Link>
        </Button>
      </div>
    </main>
  )
}
