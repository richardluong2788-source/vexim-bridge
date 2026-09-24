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
import { ImageLinkInput } from '@/components/ui/image-link-input';
import { upload } from '@vercel/blob/client';
import { Loader2, X, ImageIcon } from 'lucide-react';
import { validateAndCompressImage, MAX_INPUT_SIZE } from '@/lib/images/compress';

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
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>(product?.image_urls || []);
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
  const [priceConfirmed, setPriceConfirmed] = useState((product as any)?.price_confirmed ?? false);

  const handleComplianceToggle = (value: string, checked: boolean) => {
    setComplianceBadges((prev) =>
      checked ? [...prev, value] : prev.filter((v) => v !== value)
    );
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;
    for (const f of selected) {
      if (f.size > MAX_INPUT_SIZE) {
        toast.error(`Ảnh "${f.name}" vượt quá 5MB. Vui lòng chọn ảnh nhỏ hơn 5MB.`);
        return;
      }
    }
    setCompressing(true);
    try {
      const compressed: File[] = [];
      for (const f of selected) {
        try {
          const result = await validateAndCompressImage(f);
          compressed.push(result.file);
        } catch (err: any) {
          toast.error(err.message || `Không thể xử lý ảnh ${f.name}`);
          return;
        }
      }
      setFiles((prev) => [...prev, ...compressed].slice(0, 10));
    } finally {
      setCompressing(false);
      e.target.value = '';
    }
  };

  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));
  const removeImageUrl = (index: number) => setImageUrls((prev) => prev.filter((_, i) => i !== index));
  const addImageLinks = (urls: string[]) => setImageUrls((prev) => [...prev, ...urls]);
  const hasAnyImage = imageUrls.length > 0 || files.length > 0;

  const uploadImages = async (): Promise<string[]> => {
    if (files.length === 0) return [];
    const urls: string[] = [];
    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const blob = await upload(`product-images/${Date.now()}_${safeName}`, file, {
        access: 'public',
        handleUploadUrl: '/api/products/upload-images',
      });
      urls.push(blob.url);
    }
    return urls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!priceConfirmed) {
      toast.error('Vui lòng xác nhận cam kết giá trước khi lưu sản phẩm.');
      return;
    }
    setLoading(true);

    try {
      let newImageUrls: string[] = [];
      if (files.length > 0) {
        setUploading(true);
        newImageUrls = await uploadImages();
        setUploading(false);
      }
      const finalImageUrls = [...imageUrls, ...newImageUrls];

      const data = {
        ...formData,
        min_unit_price: formData.min_unit_price ? parseFloat(formData.min_unit_price) : undefined,
        max_unit_price: formData.max_unit_price ? parseFloat(formData.max_unit_price) : undefined,
        monthly_capacity_units: formData.monthly_capacity_units
          ? parseInt(formData.monthly_capacity_units)
          : undefined,
        moq_value: formData.moq_value ? parseFloat(formData.moq_value) : undefined,
        compliance_badges: complianceBadges,
        image_urls: finalImageUrls,
        price_confirmed: priceConfirmed,
        price_attested_at: priceConfirmed ? new Date().toISOString() : undefined,
        price_attestation_text:
          'Tôi xác nhận giá kê khai không được nâng riêng do đơn hàng đến từ Vexim và phản ánh mức giá thương mại thực tế của nhà cung cấp tại thời điểm kê khai.',
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
      setUploading(false);
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

          {/* Image Upload - Spec B */}
          <div className="space-y-4">
            <h3 className="font-medium">Product Images</h3>
            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <p>• Upload or paste image links. Max 5MB each, max 10 images.</p>
              <p>• <span className="font-medium">Bạn có thể bổ sung sau</span> – save product first, add images later.</p>
            </div>

            <ImageLinkInput
              existing={imageUrls}
              max={10 - files.length}
              onAdd={addImageLinks}
              disabled={uploading || compressing}
              placeholder="Paste image link (https://...)"
            />

            {imageUrls.length > 0 && (
              <div className="grid grid-cols-4 gap-3">
                {imageUrls.map((url, idx) => (
                  <div key={`existing-${idx}`} className="relative aspect-square bg-muted rounded-lg overflow-hidden group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Product ${idx + 1}`} className="absolute inset-0 w-full h-full object-cover" />
                    <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => removeImageUrl(idx)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {files.length > 0 && (
              <div className="grid grid-cols-4 gap-3">
                {files.map((file, idx) => (
                  <div key={`new-${idx}`} className="relative aspect-square bg-muted rounded-lg overflow-hidden group border-2 border-dashed border-primary">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={URL.createObjectURL(file)} alt={`New ${idx + 1}`} className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-primary text-primary-foreground text-[10px] py-0.5 text-center">
                      {(file.size / 1024).toFixed(0)}KB
                    </div>
                    <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => removeFile(idx)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {!hasAnyImage && (
              <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/50 transition-colors">
                <input type="file" id="client-product-images" multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileChange} disabled={uploading || compressing} className="hidden" />
                <Label htmlFor="client-product-images" className="cursor-pointer">
                  <ImageIcon className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="font-medium">Drag & drop or click to select</p>
                  <p className="text-sm text-muted-foreground">JPG, PNG, WebP, GIF – Under 5MB</p>
                  <p className="text-xs text-muted-foreground mt-2 italic">Bạn có thể bổ sung sau – not required now</p>
                </Label>
                {compressing && (
                  <div className="mt-3 flex items-center justify-center gap-2 text-xs text-primary">
                    <Loader2 className="h-4 w-4 animate-spin" /> Đang xử lý ảnh...
                  </div>
                )}
              </div>
            )}

            {hasAnyImage && (
              <div className="flex gap-2 text-xs">
                <span className="text-muted-foreground italic">Bạn có thể bổ sung sau</span>
                <label className="ml-auto text-primary cursor-pointer underline">
                  + Thêm ảnh
                  <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileChange} disabled={uploading || compressing} className="hidden" />
                </label>
              </div>
            )}
          </div>

          {/* Price attestation */}
          <div className="space-y-4">
            <h3 className="font-medium">Cam kết giá / Price Attestation</h3>
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="price_confirmed_client"
                  checked={priceConfirmed}
                  onCheckedChange={(checked) => setPriceConfirmed(checked === true)}
                  className="mt-0.5"
                />
                <label htmlFor="price_confirmed_client" className="text-sm font-medium leading-snug cursor-pointer">
                  Tôi xác nhận giá kê khai không được nâng riêng do đơn hàng đến từ Vexim và phản ánh mức giá thương mại thực tế của nhà cung cấp tại thời điểm kê khai.
                  <span className="text-destructive"> *</span>
                  <p className="text-xs font-normal text-muted-foreground mt-1">
                    Vexim kiểm tra chéo với giá công khai (website/Alibaba). Giá lưu kèm thời gian xác nhận để phục vụ audit.
                  </p>
                </label>
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
            <Button type="submit" disabled={loading || uploading || compressing}>
              {loading && <Spinner className="w-4 h-4 mr-2" />}
              {compressing ? 'Đang xử lý...' : uploading ? 'Đang tải ảnh...' : product?.id ? 'Update Product' : 'Add Product'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
