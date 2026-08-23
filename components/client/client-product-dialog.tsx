'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MarkdownTextarea } from '@/components/admin/markdown-textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { addClientProductAction, updateClientProductAction } from '@/app/admin/clients/products-actions';
import { toast } from 'sonner';
import type { ClientProduct } from '@/app/admin/clients/products-actions';
import { INCOTERMS, PAYMENT_TERMS_OPTIONS, COMPLIANCE_BADGES } from '@/lib/constants/product-options';

interface ClientProductDialogProps {
  clientId: string;
  product?: ClientProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

const CATEGORIES = [
  { value: 'coffee', label: 'Coffee' },
  { value: 'cocoa', label: 'Cocoa' },
  { value: 'cashew', label: 'Cashew' },
  { value: 'pepper', label: 'Pepper' },
  { value: 'spices', label: 'Spices' },
  { value: 'fruits', label: 'Fruits' },
  { value: 'vegetables', label: 'Vegetables' },
  { value: 'grains', label: 'Grains' },
  { value: 'other', label: 'Other' },
];

const SUBCATEGORIES: Record<string, Array<{ value: string; label: string }>> = {
  coffee: [
    { value: 'arabica', label: 'Arabica' },
    { value: 'robusta', label: 'Robusta' },
    { value: 'instant', label: 'Instant' },
    { value: 'ground', label: 'Ground' },
    { value: 'beans', label: 'Beans' },
  ],
  cocoa: [
    { value: 'beans', label: 'Beans' },
    { value: 'fermented', label: 'Fermented' },
    { value: 'powder', label: 'Powder' },
    { value: 'butter', label: 'Butter' },
  ],
  cashew: [
    { value: 'raw', label: 'Raw' },
    { value: 'roasted', label: 'Roasted' },
    { value: 'kernel', label: 'Kernel' },
  ],
  pepper: [
    { value: 'black', label: 'Black' },
    { value: 'white', label: 'White' },
    { value: 'red', label: 'Red' },
  ],
};

export function ClientProductDialog({
  clientId,
  product,
  open,
  onOpenChange,
  onSaved,
}: ClientProductDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    product_name: product?.product_name || '',
    product_code: product?.product_code || '',
    category: product?.category || '',
    subcategory: product?.subcategory || '',
    description: product?.description || '',
    hs_code: product?.hs_code || '',
    unit_of_measure: product?.unit_of_measure || 'kg',
    min_unit_price: product?.min_unit_price?.toString() || '',
    max_unit_price: product?.max_unit_price?.toString() || '',
    currency: product?.currency || 'USD',
    monthly_capacity_units: product?.monthly_capacity_units?.toString() || '',
    status: product?.status || 'active',
    // Fields the AE<->Buyer matching engine (lib/matching/client-scorer.ts)
    // actually scores on — previously missing from this client-facing form,
    // so self-service products always fell back to neutral/zero scores for
    // spec, MOQ, compliance, and logistics factors.
    country_of_origin: product?.country_of_origin || '',
    key_specifications: product?.key_specifications || '',
    moq_value: product?.moq_value?.toString() || '',
    moq_unit: product?.moq_unit || '',
    lead_time: product?.lead_time || '',
    incoterm: product?.incoterm || '',
    payment_terms: product?.payment_terms || '',
  });
  const [complianceBadges, setComplianceBadges] = useState<string[]>(
    product?.compliance_badges || []
  );

  const handleComplianceToggle = (value: string, checked: boolean) => {
    setComplianceBadges((prev) =>
      checked ? [...prev, value] : prev.filter((v) => v !== value)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = {
        ...formData,
        min_unit_price: formData.min_unit_price ? parseFloat(formData.min_unit_price) : undefined,
        max_unit_price: formData.max_unit_price ? parseFloat(formData.max_unit_price) : undefined,
        monthly_capacity_units: formData.monthly_capacity_units
          ? parseInt(formData.monthly_capacity_units)
          : undefined,
        moq_value: formData.moq_value ? parseFloat(formData.moq_value) : undefined,
        compliance_badges: complianceBadges,
      };

      let result;

      if (product?.id) {
        result = await updateClientProductAction(product.id, data);
      } else {
        result = await addClientProductAction(clientId, data);
      }

      if (result.success) {
        toast.success(product?.id ? 'Product updated successfully' : 'Product added successfully');
        onOpenChange(false);
        onSaved?.();
      } else {
        toast.error(result.error || 'Something went wrong');
      }
    } catch (error) {
      console.error('[v0] Error:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectedSubcategories = formData.category ? SUBCATEGORIES[formData.category] || [] : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product?.id ? 'Edit Product' : 'Add New Product'}</DialogTitle>
          <DialogDescription>
            {product?.id ? 'Update your product information' : 'Add a new product to your catalog'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-medium">Basic Information</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="product_name">Product Name *</Label>
                <Input
                  id="product_name"
                  required
                  value={formData.product_name}
                  onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                  placeholder="e.g., Arabica Grade A"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="product_code">Product Code (SKU)</Label>
                <Input
                  id="product_code"
                  value={formData.product_code}
                  onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
                  placeholder="e.g., ARB-A-001"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <MarkdownTextarea
                id="description"
                value={formData.description}
                onChange={(value) => setFormData({ ...formData, description: value })}
                placeholder="Describe your product..."
                rows={3}
              />
            </div>
          </div>

          {/* Categorization */}
          <div className="space-y-4">
            <h3 className="font-medium">Categorization</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select value={formData.category} onValueChange={(value) =>
                  setFormData({ ...formData, category: value, subcategory: '' })
                }>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subcategory">Subcategory</Label>
                <Select value={formData.subcategory} onValueChange={(value) =>
                  setFormData({ ...formData, subcategory: value })
                }>
                  <SelectTrigger id="subcategory" disabled={!selectedSubcategories.length}>
                    <SelectValue placeholder="Select subcategory" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedSubcategories.map((sub) => (
                      <SelectItem key={sub.value} value={sub.value}>
                        {sub.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hs_code">HS Code</Label>
                <Input
                  id="hs_code"
                  value={formData.hs_code}
                  onChange={(e) => setFormData({ ...formData, hs_code: e.target.value })}
                  placeholder="e.g., 0901"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit_of_measure">Unit of Measure</Label>
                <Select value={formData.unit_of_measure} onValueChange={(value) =>
                  setFormData({ ...formData, unit_of_measure: value })
                }>
                  <SelectTrigger id="unit_of_measure">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">Kilograms (kg)</SelectItem>
                    <SelectItem value="lbs">Pounds (lbs)</SelectItem>
                    <SelectItem value="ton">Metric Ton (ton)</SelectItem>
                    <SelectItem value="piece">Piece</SelectItem>
                    <SelectItem value="box">Box</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="country_of_origin">Country of Origin</Label>
                <Input
                  id="country_of_origin"
                  value={formData.country_of_origin}
                  onChange={(e) => setFormData({ ...formData, country_of_origin: e.target.value })}
                  placeholder="e.g., Vietnam"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="key_specifications">Key Specifications</Label>
              <Textarea
                id="key_specifications"
                value={formData.key_specifications}
                onChange={(e) => setFormData({ ...formData, key_specifications: e.target.value })}
                placeholder="e.g., Moisture 12% max, Screen 16, Defect count <5%"
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Buyers are matched against these specs — be as specific as possible.
              </p>
            </div>
          </div>

          {/* Pricing & Capacity */}
          <div className="space-y-4">
            <h3 className="font-medium">Pricing & Capacity</h3>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min_price">Min Unit Price</Label>
                <div className="flex items-center gap-2">
                  <Select value={formData.currency} onValueChange={(value) =>
                    setFormData({ ...formData, currency: value })
                  }>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="VND">VND</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    id="min_price"
                    type="number"
                    step="0.01"
                    value={formData.min_unit_price}
                    onChange={(e) => setFormData({ ...formData, min_unit_price: e.target.value })}
                    placeholder="0.00"
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_price">Max Unit Price</Label>
                <Input
                  id="max_price"
                  type="number"
                  step="0.01"
                  value={formData.max_unit_price}
                  onChange={(e) => setFormData({ ...formData, max_unit_price: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="capacity">Monthly Capacity</Label>
                <Input
                  id="capacity"
                  type="number"
                  value={formData.monthly_capacity_units}
                  onChange={(e) => setFormData({ ...formData, monthly_capacity_units: e.target.value })}
                  placeholder="e.g., 1000"
                />
              </div>
            </div>
          </div>

          {/* Order & Trade Terms */}
          <div className="space-y-4">
            <h3 className="font-medium">Order & Trade Terms</h3>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="moq_value">Minimum Order Quantity</Label>
                <Input
                  id="moq_value"
                  type="number"
                  step="0.01"
                  value={formData.moq_value}
                  onChange={(e) => setFormData({ ...formData, moq_value: e.target.value })}
                  placeholder="e.g., 1000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="moq_unit">MOQ Unit</Label>
                <Input
                  id="moq_unit"
                  value={formData.moq_unit}
                  onChange={(e) => setFormData({ ...formData, moq_unit: e.target.value })}
                  placeholder="e.g., kg, 20ft container"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead_time">Lead Time</Label>
                <Input
                  id="lead_time"
                  value={formData.lead_time}
                  onChange={(e) => setFormData({ ...formData, lead_time: e.target.value })}
                  placeholder="e.g., 15-20 days after deposit"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="incoterm">Incoterm</Label>
                <Select
                  value={formData.incoterm}
                  onValueChange={(value) => setFormData({ ...formData, incoterm: value })}
                >
                  <SelectTrigger id="incoterm">
                    <SelectValue placeholder="Select incoterm" />
                  </SelectTrigger>
                  <SelectContent>
                    {INCOTERMS.map((term) => (
                      <SelectItem key={term} value={term}>
                        {term}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_terms">Payment Terms</Label>
                <Select
                  value={formData.payment_terms}
                  onValueChange={(value) => setFormData({ ...formData, payment_terms: value })}
                >
                  <SelectTrigger id="payment_terms">
                    <SelectValue placeholder="Select payment terms" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERMS_OPTIONS.map((term) => (
                      <SelectItem key={term.value} value={term.value}>
                        {term.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Compliance */}
          <div className="space-y-4">
            <h3 className="font-medium">Certifications & Compliance</h3>
            <div className="grid grid-cols-2 gap-3">
              {COMPLIANCE_BADGES.map((badge) => (
                <div key={badge.value} className="flex items-start space-x-3">
                  <Checkbox
                    id={`badge-${badge.value}`}
                    checked={complianceBadges.includes(badge.value)}
                    onCheckedChange={(checked) => handleComplianceToggle(badge.value, checked === true)}
                  />
                  <label
                    htmlFor={`badge-${badge.value}`}
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    {badge.label}
                    <p className="text-xs text-muted-foreground mt-1">{badge.description}</p>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="space-y-4">
            <h3 className="font-medium">Status</h3>

            <div className="space-y-2">
              <Label htmlFor="status">Product Status</Label>
              <Select value={formData.status} onValueChange={(value) =>
                setFormData({ ...formData, status: value as any })
              }>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-6 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Spinner className="w-4 h-4 mr-2" />}
              {product?.id ? 'Update Product' : 'Add Product'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
