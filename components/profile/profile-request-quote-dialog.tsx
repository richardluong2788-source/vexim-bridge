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
import type { ClientProfileWithRelations, ClientProduct } from "@/lib/supabase/types"

interface ProfileRequestQuoteDialogProps {
  profile: ClientProfileWithRelations
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProfileRequestQuoteDialog({
  profile,
  open,
  onOpenChange,
}: ProfileRequestQuoteDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [isSuccess, setIsSuccess] = useState(false)
  const [reference, setReference] = useState<string>("")

  // Form state
  const [companyName, setCompanyName] = useState("")
  const [contactName, setContactName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [country, setCountry] = useState("")
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [quantity, setQuantity] = useState("")
  const [notes, setNotes] = useState("")

  const products = profile.products || []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!companyName || !contactName || !email) {
      toast.error("Please fill in all required fields")
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
        toast.error(result.error || "Failed to submit request")
      }
    })
  }

  const handleClose = () => {
    // Reset form on close
    if (isSuccess) {
      setIsSuccess(false)
      setReference("")
      setCompanyName("")
      setContactName("")
      setEmail("")
      setPhone("")
      setSelectedProducts([])
      setQuantity("")
      setNotes("")
    }
    onOpenChange(false)
  }

  const toggleProduct = (productName: string) => {
    setSelectedProducts((prev) =>
      prev.includes(productName)
        ? prev.filter((p) => p !== productName)
        : [...prev, productName]
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
            <DialogTitle className="text-xl mb-2">
              Quote Request Submitted
            </DialogTitle>
            <DialogDescription className="mb-4">
              Thank you for your interest! Our team will review your request and
              get back to you within 24-48 hours.
            </DialogDescription>
            {reference && (
              <p className="text-sm text-muted-foreground mb-6">
                Reference: <span className="font-mono font-medium">{reference}</span>
              </p>
            )}
            <Button onClick={handleClose}>Close</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Request a Quote</DialogTitle>
              <DialogDescription>
                Fill out the form below and we&apos;ll get back to you with pricing
                information.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              {/* Company Name */}
              <div className="space-y-2">
                <Label htmlFor="companyName">
                  Company Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Your company name"
                  required
                />
              </div>

              {/* Contact Name */}
              <div className="space-y-2">
                <Label htmlFor="contactName">
                  Contact Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="contactName"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Your name"
                  required
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                />
              </div>

              {/* Country */}
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="e.g., United States"
                />
              </div>

              {/* Products Interested */}
              {products.length > 0 && (
                <div className="space-y-2">
                  <Label>Products Interested</Label>
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

              {/* Quantity/Volume */}
              <div className="space-y-2">
                <Label htmlFor="quantity">Estimated Quantity/Volume</Label>
                <Input
                  id="quantity"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="e.g., 1 container, 5000 kg"
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any specific requirements or questions..."
                  rows={3}
                />
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Submit Request
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
