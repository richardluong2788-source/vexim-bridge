"use client"

import { useState, useTransition } from "react"
import { Loader2, CheckCircle, Send } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { submitQuoteRequest } from "@/lib/profile/actions"
import type { Locale } from "@/lib/i18n/config"
import { getProfileCopy } from "@/lib/profile/translations"
import type { ClientProfileWithRelations, ClientProduct } from "@/lib/supabase/types"

interface ProfileRequestQuoteDialogProps {
  profile: ClientProfileWithRelations
  open: boolean
  onOpenChange: (open: boolean) => void
  locale: Locale
}

export function ProfileRequestQuoteDialog({
  profile,
  open,
  onOpenChange,
  locale,
}: ProfileRequestQuoteDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [isSuccess, setIsSuccess] = useState(false)
  const [reference, setReference] = useState("")

  const [companyName, setCompanyName] = useState("")
  const [contactName, setContactName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [country, setCountry] = useState("")
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [quantity, setQuantity] = useState("")
  const [notes, setNotes] = useState("")

  const copy = getProfileCopy(locale)
  const text = copy.quote
  const products = profile.products || []

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    if (!companyName || !contactName || !email) {
      toast.error(text.requiredFields)
      return
    }

    startTransition(async () => {
      const result = await submitQuoteRequest({
        profile_id: profile.id,
        company_name: companyName,
        contact_name: contactName,
        email,
        phone: phone || undefined,
        country: country || undefined,
        products_interested: selectedProducts,
        quantity_volume: quantity || undefined,
        notes: notes || undefined,
      })

      if (result.success) {
        setIsSuccess(true)
        setReference(result.reference || "")
      } else {
        toast.error(locale === "vi" ? text.submitFailed : result.error || text.submitFailed)
      }
    })
  }

  const handleClose = () => {
    if (isSuccess) {
      setIsSuccess(false)
      setReference("")
      setCompanyName("")
      setContactName("")
      setEmail("")
      setPhone("")
      setCountry("")
      setSelectedProducts([])
      setQuantity("")
      setNotes("")
    }
    onOpenChange(false)
  }

  const toggleProduct = (productName: string) => {
    setSelectedProducts((previous) =>
      previous.includes(productName)
        ? previous.filter((product) => product !== productName)
        : [...previous, productName],
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        {isSuccess ? (
          <div className="py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-accent" />
            </div>
            <DialogTitle className="text-xl mb-2">{text.successTitle}</DialogTitle>
            <DialogDescription className="mb-4">{text.successDescription}</DialogDescription>
            {reference && (
              <p className="text-sm text-muted-foreground mb-6">
                {text.reference} <span className="font-mono font-medium">{reference}</span>
              </p>
            )}
            <Button onClick={handleClose}>{text.close}</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{text.title}</DialogTitle>
              <DialogDescription>{text.description}</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">
                  {text.companyName} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  placeholder={text.companyNamePlaceholder}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactName">
                  {text.contactName} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="contactName"
                  value={contactName}
                  onChange={(event) => setContactName(event.target.value)}
                  placeholder={text.contactNamePlaceholder}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">
                  {text.email} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={text.emailPlaceholder}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">{text.phone}</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder={text.phonePlaceholder}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">{text.country}</Label>
                <Input
                  id="country"
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                  placeholder={text.countryPlaceholder}
                />
              </div>

              {products.length > 0 && (
                <div className="space-y-2">
                  <Label>{text.productsInterested}</Label>
                  <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto p-2 border rounded-md bg-muted/30">
                    {products.map((product: ClientProduct) => (
                      <div key={product.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`product-${product.id}`}
                          checked={selectedProducts.includes(product.product_name)}
                          onCheckedChange={() => toggleProduct(product.product_name)}
                        />
                        <Label
                          htmlFor={`product-${product.id}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {product.product_name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="quantity">{text.quantity}</Label>
                <Input
                  id="quantity"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  placeholder={text.quantityPlaceholder}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">{text.notes}</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder={text.notesPlaceholder}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isPending}
                >
                  {text.cancel}
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {text.submitting}
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      {text.submit}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
