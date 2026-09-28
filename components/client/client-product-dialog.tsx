'use client';

import { useEffect, useState } from 'react';
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
import { INCOTERMS, PAYMENT_TERMS_OPTIONS, COMPLIANCE_BADGES, PRODUCT_UNITS, PRODUCT_CURRENCIES } from '@/lib/constants/product-options';
import { ImageLinkInput } from '@/components/ui/image-link-input';
import { upload } from '@vercel/blob/client';
import { Loader2, X, ImageIcon, Plus } from 'lucide-react';
import { validateAndCompressImage, MAX_INPUT_SIZE } from '@/lib/images/compress';
import { listProductCategoriesAction, type ProductCategory } from '@/app/admin/clients/categories-actions';

interface ClientProductDialogProps {
  clientId: string;
  product?: ClientProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

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
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
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
    price_unit: product?.price_unit || '',
    monthly_capacity_units: product?.monthly_capacity_units?.toString() || '',
    status: product?.status || 'active',
    country_of_origin: product?.country_of_origin || 'Vietnam',
    key_specifications: product?.key_specifications || '',
    usp: product?.usp || '',
    moq_value: product?.moq_value?.toString() || '',
    moq_unit: product?.moq_unit || '',
    lead_time: product?.lead_time || '',
    incoterm: product?.incoterm || '',
    incoterm_place: product?.incoterm_place || '',
    payment_terms: product?.payment_terms || '',
    packing: product?.packing || '',
    package_size: product?.package_size || '',
    shelf_life: product?.shelf_life || '',
    storage_conditions: product?.storage_conditions || '',
    private_label_notes: product?.private_label_notes || '',
    sample_notes: product?.sample_notes || '',
  });
  const [complianceBadges, setComplianceBadges] = useState<string[]>(
    product?.compliance_badges || []
  );
  const [priceConfirmed, setPriceConfirmed] = useState((product as any)?.price_confirmed ?? false);
  const [sampleAvailable, setSampleAvailable] = useState(product?.sample_available ?? false);
  const [privateLabelAvailable, setPrivateLabelAvailable] = useState(product?.private_label_available ?? false);

  useEffect(() => {
    if (!open) return;
    setFormData({
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
      price_unit: product?.price_unit || '',
      monthly_capacity_units: product?.monthly_capacity_units?.toString() || '',
      status: product?.status || 'active',
      country_of_origin: product?.country_of_origin || 'Vietnam',
      key_specifications: product?.key_specifications || '',
      usp: product?.usp || '',
      moq_value: product?.moq_value?.toString() || '',
      moq_unit: product?.moq_unit || '',
      lead_time: product?.lead_time || '',
      incoterm: product?.incoterm || '',
      incoterm_place: product?.incoterm_place || '',
      payment_terms: product?.payment_terms || '',
      packing: product?.packing || '',
      package_size: product?.package_size || '',
      shelf_life: product?.shelf_life || '',
      storage_conditions: product?.storage_conditions || '',
      private_label_notes: product?.private_label_notes || '',
      sample_notes: product?.sample_notes || '',
    });
    setSampleAvailable(product?.sample_available ?? false);
    setPrivateLabelAvailable(product?.private_label_available ?? false);
    setPriceConfirmed((product as any)?.price_confirmed ?? false);
    setFiles([]);
    setImageUrls(product?.image_urls || []);
    setComplianceBadges(product?.compliance_badges || []);
    setCustomCategory('');
    setShowCustomCategory(false);
  }, [product, open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const res = await listProductCategoriesAction();
      if (cancelled) return;
      if (res.success) setCategories(res.data);
    })();
    return () => { cancelled = true; };
  }, [open]);

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
    const finalCategory = showCustomCategory && customCategory.trim() ? customCategory.trim() : formData.category;
    if (!finalCategory) {
      toast.error('Vui lòng chọn hoặc nhập danh mục');
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
        category: finalCategory,
        min_unit_price: formData.min_unit_price ? parseFloat(formData.min_unit_price) : undefined,
        max_unit_price: formData.max_unit_price ? parseFloat(formData.max_unit_price) : undefined,
        monthly_capacity_units: formData.monthly_capacity_units
          ? parseInt(formData.monthly_capacity_units)
          : undefined,
        moq_value: formData.moq_value ? parseFloat(formData.moq_value) : undefined,
        compliance_badges: complianceBadges,
        image_urls: finalImageUrls,
        sample_available: sampleAvailable,
        private_label_available: privateLabelAvailable,
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
        toast.success(product?.id ? 'Cập nhật sản phẩm thành công' : 'Thêm sản phẩm thành công');
        onOpenChange(false);
        onSaved?.();
      } else {
        toast.error(result.error || 'Có lỗi xảy ra');
      }
    } catch (error) {
      console.error('[v0] Error:', error);
      toast.error('Đã xảy ra lỗi, vui lòng thử lại');
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product?.id ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}</DialogTitle>
          <DialogDescription>
            {product?.id ? 'Cập nhật thông tin sản phẩm trong catalog' : 'Thêm sản phẩm mới vào catalog của bạn'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* 1. Thông tin cơ bản */}
          <div className="space-y-4">
            <h3 className="font-semibold text-base border-b pb-2">1. Thông tin cơ bản</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="product_name">Tên sản phẩm *</Label>
                <Input
                  id="product_name"
                  required
                  value={formData.product_name}
                  onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                  placeholder="VD: Cà phê Arabica Cầu Đất"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product_code">Mã SKU</Label>
                <Input
                  id="product_code"
                  value={formData.product_code}
                  onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
                  placeholder="VD: COFFEE-001"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Danh mục *</Label>
                <div className="flex gap-2">
                  <Select
                    value={showCustomCategory ? '__custom__' : formData.category}
                    onValueChange={(v) => {
                      if (v === '__custom__') {
                        setShowCustomCategory(true);
                      } else {
                        setShowCustomCategory(false);
                        setFormData({ ...formData, category: v });
                      }
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Chọn danh mục" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.value}>
                          {cat.label_vi} ({cat.value})
                        </SelectItem>
                      ))}
                      <SelectItem value="__custom__">+ Tạo danh mục mới...</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {showCustomCategory && (
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="Nhập tên danh mục mới, VD: Hạt điều, Cà phê hòa tan..."
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowCustomCategory(false)}>
                      Hủy
                    </Button>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="subcategory">Danh mục phụ</Label>
                <Input
                  id="subcategory"
                  value={formData.subcategory}
                  onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                  placeholder="VD: Arabica, Rang xay, Hữu cơ..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Mô tả sản phẩm</Label>
              <MarkdownTextarea
                id="description"
                value={formData.description}
                onChange={(value) => setFormData({ ...formData, description: value })}
                placeholder="Mô tả chi tiết về sản phẩm, quy trình sản xuất, ưu điểm..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="country_of_origin">Xuất xứ *</Label>
                <Input
                  id="country_of_origin"
                  value={formData.country_of_origin}
                  onChange={(e) => setFormData({ ...formData, country_of_origin: e.target.value })}
                  placeholder="VD: Việt Nam"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hs_code">Mã HS</Label>
                <Input
                  id="hs_code"
                  value={formData.hs_code}
                  onChange={(e) => setFormData({ ...formData, hs_code: e.target.value })}
                  placeholder="VD: 090111"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="key_specifications">Thông số kỹ thuật</Label>
                <Input
                  id="key_specifications"
                  value={formData.key_specifications}
                  onChange={(e) => setFormData({ ...formData, key_specifications: e.target.value })}
                  placeholder="VD: Độ ẩm 12%, Screen 16, Defect <5%"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="usp">Điểm bán hàng nổi bật (USP)</Label>
                <Input
                  id="usp"
                  value={formData.usp}
                  onChange={(e) => setFormData({ ...formData, usp: e.target.value })}
                  placeholder="VD: Canh tác bền vững, truy xuất trực tiếp từ nông trại"
                />
              </div>
            </div>
          </div>

          {/* 2. Năng lực & Giá */}
          <div className="space-y-4">
            <h3 className="font-semibold text-base border-b pb-2">2. Năng lực & Giá</h3>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="monthly_capacity_units">Năng lực sản xuất / tháng</Label>
                <Input
                  id="monthly_capacity_units"
                  type="number"
                  value={formData.monthly_capacity_units}
                  onChange={(e) => setFormData({ ...formData, monthly_capacity_units: e.target.value })}
                  placeholder="VD: 500"
                />
              </div>
              <div className="space-y-2">
                <Label>Đơn vị</Label>
                <Select value={formData.unit_of_measure} onValueChange={(v) => setFormData({ ...formData, unit_of_measure: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRODUCT_UNITS.map((u) => (
                      <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tiền tệ</Label>
                <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRODUCT_CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min_unit_price">Giá tối thiểu</Label>
                <Input id="min_unit_price" type="number" step="0.01" value={formData.min_unit_price} onChange={(e) => setFormData({ ...formData, min_unit_price: e.target.value })} placeholder="4.5" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_unit_price">Giá tối đa</Label>
                <Input id="max_unit_price" type="number" step="0.01" value={formData.max_unit_price} onChange={(e) => setFormData({ ...formData, max_unit_price: e.target.value })} placeholder="5.5" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price_unit">Giá tính theo</Label>
                <Input id="price_unit" value={formData.price_unit} onChange={(e) => setFormData({ ...formData, price_unit: e.target.value })} placeholder="per kg, per container" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="moq_value">MOQ</Label>
                <Input id="moq_value" type="number" step="0.01" value={formData.moq_value} onChange={(e) => setFormData({ ...formData, moq_value: e.target.value })} placeholder="1000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="moq_unit">Đơn vị MOQ</Label>
                <Input id="moq_unit" value={formData.moq_unit} onChange={(e) => setFormData({ ...formData, moq_unit: e.target.value })} placeholder="kg, container 20ft" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead_time">Lead time</Label>
                <Input id="lead_time" value={formData.lead_time} onChange={(e) => setFormData({ ...formData, lead_time: e.target.value })} placeholder="15-20 ngày" />
              </div>
            </div>
          </div>

          {/* 3. Đóng gói & Bảo quản */}
          <div className="space-y-4">
            <h3 className="font-semibold text-base border-b pb-2">3. Đóng gói & Bảo quản</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="packing">Quy cách đóng gói</Label>
                <Input id="packing" value={formData.packing} onChange={(e) => setFormData({ ...formData, packing: e.target.value })} placeholder="VD: Bao PP 25kg, thùng carton" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="package_size">Kích thước đóng gói</Label>
                <Input id="package_size" value={formData.package_size} onChange={(e) => setFormData({ ...formData, package_size: e.target.value })} placeholder="VD: 60x40x20 cm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shelf_life">Hạn sử dụng</Label>
                <Input id="shelf_life" value={formData.shelf_life} onChange={(e) => setFormData({ ...formData, shelf_life: e.target.value })} placeholder="VD: 12 tháng" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="storage_conditions">Điều kiện bảo quản</Label>
                <Input id="storage_conditions" value={formData.storage_conditions} onChange={(e) => setFormData({ ...formData, storage_conditions: e.target.value })} placeholder="VD: Nơi khô mát, tránh ánh nắng" />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Checkbox id="private_label" checked={privateLabelAvailable} onCheckedChange={(c) => setPrivateLabelAvailable(c === true)} />
                <Label htmlFor="private_label" className="cursor-pointer">Hỗ trợ Private Label / OEM</Label>
              </div>
              {privateLabelAvailable && (
                <Input value={formData.private_label_notes} onChange={(e) => setFormData({ ...formData, private_label_notes: e.target.value })} placeholder="Chi tiết OEM: MOQ riêng, chi phí..." />
              )}
              <div className="flex items-center gap-2">
                <Checkbox id="sample_available" checked={sampleAvailable} onCheckedChange={(c) => setSampleAvailable(c === true)} />
                <Label htmlFor="sample_available" className="cursor-pointer">Có hàng mẫu</Label>
              </div>
              {sampleAvailable && (
                <Input value={formData.sample_notes} onChange={(e) => setFormData({ ...formData, sample_notes: e.target.value })} placeholder="VD: Mẫu miễn phí, buyer trả ship" />
              )}
            </div>
          </div>

          {/* 4. Giao hàng & Thanh toán */}
          <div className="space-y-4">
            <h3 className="font-semibold text-base border-b pb-2">4. Giao hàng & Thanh toán</h3>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Incoterm *</Label>
                <Select value={formData.incoterm} onValueChange={(v) => setFormData({ ...formData, incoterm: v })}>
                  <SelectTrigger><SelectValue placeholder="Chọn Incoterm" /></SelectTrigger>
                  <SelectContent>
                    {INCOTERMS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="incoterm_place">Cảng giao hàng / Địa điểm</Label>
                <Input id="incoterm_place" value={formData.incoterm_place} onChange={(e) => setFormData({ ...formData, incoterm_place: e.target.value })} placeholder="VD: Cảng Cát Lái, HCM" />
              </div>
              <div className="space-y-2">
                <Label>Điều khoản thanh toán</Label>
                <Select value={formData.payment_terms} onValueChange={(v) => setFormData({ ...formData, payment_terms: v })}>
                  <SelectTrigger><SelectValue placeholder="Chọn điều khoản" /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERMS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* 5. Ảnh sản phẩm */}
          <div className="space-y-4">
            <h3 className="font-semibold text-base border-b pb-2">5. Ảnh sản phẩm</h3>
            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              <p>• Dán link ảnh hoặc tải file (tối đa 10 ảnh, mỗi ảnh dưới 5MB).</p>
            </div>

            <ImageLinkInput
              existing={imageUrls}
              max={10 - files.length}
              onAdd={addImageLinks}
              disabled={uploading || compressing}
              placeholder="Dán link ảnh sản phẩm (https://...)"
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

            <div className="border-2 border-dashed rounded-lg p-4 text-center hover:bg-muted/50 transition-colors">
              <input type="file" id="client-product-images-2" multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileChange} disabled={uploading || compressing} className="hidden" />
              <Label htmlFor="client-product-images-2" className="cursor-pointer flex flex-col items-center gap-1">
                <ImageIcon className="w-6 h-6 text-muted-foreground" />
                <span className="text-sm font-medium">Kéo thả ảnh vào đây hoặc bấm để chọn</span>
                <span className="text-xs text-muted-foreground">JPG, PNG, WebP, GIF – Dưới 5MB/ảnh</span>
              </Label>
              {compressing && (
                <div className="mt-2 flex items-center justify-center gap-2 text-xs text-primary">
                  <Loader2 className="h-4 w-4 animate-spin" /> Đang xử lý ảnh...
                </div>
              )}
            </div>
          </div>

          {/* 6. Chứng nhận & Cam kết */}
          <div className="space-y-4">
            <h3 className="font-semibold text-base border-b pb-2">6. Chứng nhận & Cam kết giá</h3>

            <div className="grid grid-cols-2 gap-3">
              {COMPLIANCE_BADGES.map((badge) => (
                <div key={badge.value} className="flex items-start gap-2">
                  <Checkbox
                    id={`badge-client-${badge.value}`}
                    checked={complianceBadges.includes(badge.value)}
                    onCheckedChange={(checked) => handleComplianceToggle(badge.value, checked === true)}
                  />
                  <label htmlFor={`badge-client-${badge.value}`} className="text-sm font-medium cursor-pointer">
                    {badge.label}
                    <p className="text-xs text-muted-foreground font-normal">{badge.description}</p>
                  </label>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="price_confirmed_client"
                  checked={priceConfirmed}
                  onCheckedChange={(checked) => setPriceConfirmed(checked === true)}
                  className="mt-0.5"
                />
                <label htmlFor="price_confirmed_client" className="text-sm font-medium leading-snug cursor-pointer">
                  Tôi xác nhận giá kê khai không được nâng riêng do đơn hàng đến từ Vexim và phản ánh mức giá thương mại thực tế của nhà cung cấp tại thời điểm kê khai.
                  <span className="text-destructive"> *</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Trạng thái</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Đang hoạt động</SelectItem>
                  <SelectItem value="inactive">Ngừng</SelectItem>
                  <SelectItem value="suspended">Tạm ngưng</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Hủy
            </Button>
            <Button type="submit" disabled={loading || uploading || compressing}>
              {loading && <Spinner className="w-4 h-4 mr-2" />}
              {compressing ? 'Đang xử lý...' : uploading ? 'Đang tải ảnh...' : product?.id ? 'Cập nhật' : 'Thêm sản phẩm'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
