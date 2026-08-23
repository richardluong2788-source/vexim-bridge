'use client';

/**
 * Admin Product Dialog
 *
 * Purpose: Admin uses this dialog to add/edit products for clients
 * Workflow: Admin goes to client detail page → Products section → Add/Edit product
 * The product is then visible to client in /client/products (read-only)
 */

import { useEffect, useState } from 'react';
import { upload } from '@vercel/blob/client';
import { Loader2, Plus, Upload, X, ImageIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MarkdownTextarea } from '@/components/admin/markdown-textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { addClientProductAction, updateClientProductAction } from '@/app/admin/clients/products-actions';
import type { ClientProduct } from '@/app/admin/clients/products-actions';
import {
  listProductCategoriesAction,
  type ProductCategory,
} from '@/app/admin/clients/categories-actions';
import { AddProductCategoryDialog } from '@/components/admin/add-product-category-dialog';
import { toast } from 'sonner';
import {
  PRODUCT_UNITS as UNITS,
  PRODUCT_CURRENCIES as CURRENCIES,
  INCOTERMS,
  PAYMENT_TERMS_OPTIONS,
  COMPLIANCE_BADGES,
} from '@/lib/constants/product-options';

interface AdminProductDialogProps {
  clientId: string;
  clientName: string;
  product: ClientProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function AdminProductDialog({
  clientId,
  clientName,
  product,
  open,
  onOpenChange,
  onSaved,
}: AdminProductDialogProps) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>(product?.image_urls || []);
  const [complianceBadges, setComplianceBadges] = useState<string[]>(product?.compliance_badges || []);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [canAddCategory, setCanAddCategory] = useState(false);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [formData, setFormData] = useState({
    product_name: product?.product_name || '',
    product_code: product?.product_code || '',
    category: product?.category || '',
    subcategory: product?.subcategory || '',
    description: product?.description || '',
    monthly_capacity_units: product?.monthly_capacity_units?.toString() || '',
    unit_of_measure: product?.unit_of_measure || 'kg',
    min_unit_price: product?.min_unit_price?.toString() || '',
    max_unit_price: product?.max_unit_price?.toString() || '',
    currency: product?.currency || 'USD',
    price_unit: product?.price_unit || '',
    incoterm: product?.incoterm || '',
    incoterm_place: product?.incoterm_place || '',
    payment_terms: product?.payment_terms || '',
    hs_code: product?.hs_code || '',
    status: product?.status || 'active',
    country_of_origin: product?.country_of_origin || '',
    key_specifications: product?.key_specifications || '',
    usp: product?.usp || '',
    moq_value: product?.moq_value?.toString() || '',
    moq_unit: product?.moq_unit || '',
    lead_time: product?.lead_time || '',
    sample_notes: product?.sample_notes || '',
    packing: product?.packing || '',
    package_size: product?.package_size || '',
    shelf_life: product?.shelf_life || '',
    storage_conditions: product?.storage_conditions || '',
    private_label_notes: product?.private_label_notes || '',
  });
  const [sampleAvailable, setSampleAvailable] = useState(product?.sample_available ?? false);
  const [privateLabelAvailable, setPrivateLabelAvailable] = useState(
    product?.private_label_available ?? false,
  );

  const isEditing = !!product;

  // Re-sync form whenever the dialog opens with a new product (or switches
  // from "Add" to "Edit"). Without this, useState's initial value sticks
  // and the edit form shows stale/empty data the second time it opens.
  useEffect(() => {
    if (!open) return;
    setFormData({
      product_name: product?.product_name || '',
      product_code: product?.product_code || '',
      category: product?.category || '',
      subcategory: product?.subcategory || '',
      description: product?.description || '',
      monthly_capacity_units: product?.monthly_capacity_units?.toString() || '',
      unit_of_measure: product?.unit_of_measure || 'kg',
      min_unit_price: product?.min_unit_price?.toString() || '',
      max_unit_price: product?.max_unit_price?.toString() || '',
      currency: product?.currency || 'USD',
      price_unit: product?.price_unit || '',
      incoterm: product?.incoterm || '',
      incoterm_place: product?.incoterm_place || '',
      payment_terms: product?.payment_terms || '',
      hs_code: product?.hs_code || '',
      status: product?.status || 'active',
      country_of_origin: product?.country_of_origin || '',
      key_specifications: product?.key_specifications || '',
      usp: product?.usp || '',
      moq_value: product?.moq_value?.toString() || '',
      moq_unit: product?.moq_unit || '',
      lead_time: product?.lead_time || '',
      sample_notes: product?.sample_notes || '',
      packing: product?.packing || '',
      package_size: product?.package_size || '',
      shelf_life: product?.shelf_life || '',
      storage_conditions: product?.storage_conditions || '',
      private_label_notes: product?.private_label_notes || '',
    });
    setSampleAvailable(product?.sample_available ?? false);
    setPrivateLabelAvailable(product?.private_label_available ?? false);
    setFiles([]);
    setImageUrls(product?.image_urls || []);
    setComplianceBadges(product?.compliance_badges || []);
  }, [product, open]);

  // Load product categories from DB whenever the dialog opens.
  // Categories used to be hard-coded; now super_admin/admin/staff can extend
  // them via the "+" button next to the dropdown.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const res = await listProductCategoriesAction();
      if (cancelled) return;
      if (res.success) {
        setCategories(res.data);
        setCanAddCategory(res.canAdd);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // When a new category is added in the sub-dialog, prepend it to the local
  // list and auto-select it on the form so the user doesn't have to re-pick.
  const handleCategoryAdded = (cat: ProductCategory) => {
    setCategories((prev) => {
      // Avoid duplicates if the same category somehow round-trips twice.
      if (prev.some((c) => c.id === cat.id)) return prev;
      return [...prev, cat].sort(
        (a, b) => a.display_order - b.display_order || a.label_vi.localeCompare(b.label_vi),
      );
    });
    setFormData((prev) => ({ ...prev, category: cat.value }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...selectedFiles].slice(0, 5)); // Max 5 files
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeImageUrl = (index: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleComplianceToggle = (badge: string, checked: boolean) => {
    if (checked) {
      setComplianceBadges((prev) => [...prev, badge]);
    } else {
      setComplianceBadges((prev) => prev.filter((b) => b !== badge));
    }
  };

  const uploadImages = async (): Promise<string[]> => {
    if (files.length === 0) return [];

    // Upload directly from the browser to Vercel Blob so large product
    // photos never pass through this app's server functions.
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
    setLoading(true);

    try {
      // Upload images first if there are new files
      let newImageUrls: string[] = [];
      if (files.length > 0) {
        setUploading(true);
        newImageUrls = await uploadImages();
        setUploading(false);
      }

      // Merge existing URLs with newly uploaded URLs
      const finalImageUrls = [...imageUrls, ...newImageUrls];

      const payload = {
        ...formData,
        monthly_capacity_units: formData.monthly_capacity_units
          ? Number.parseInt(formData.monthly_capacity_units)
          : null,
        min_unit_price: formData.min_unit_price ? Number.parseFloat(formData.min_unit_price) : null,
        max_unit_price: formData.max_unit_price ? Number.parseFloat(formData.max_unit_price) : null,
        moq_value: formData.moq_value ? Number.parseFloat(formData.moq_value) : null,
        image_urls: finalImageUrls,
        compliance_badges: complianceBadges,
        sample_available: sampleAvailable,
        private_label_available: privateLabelAvailable,
      };

      let result;
      if (isEditing && product) {
        result = await updateClientProductAction(product.id, payload);
      } else {
        result = await addClientProductAction(clientId, payload);
      }

      if (result.success) {
        setFormData({
          product_name: '',
          product_code: '',
          category: '',
          subcategory: '',
          description: '',
          monthly_capacity_units: '',
          unit_of_measure: 'kg',
          min_unit_price: '',
          max_unit_price: '',
          currency: 'USD',
          price_unit: '',
          incoterm: '',
          incoterm_place: '',
          payment_terms: '',
          hs_code: '',
          status: 'active',
          country_of_origin: '',
          key_specifications: '',
          usp: '',
          moq_value: '',
          moq_unit: '',
          lead_time: '',
          sample_notes: '',
          packing: '',
          package_size: '',
          shelf_life: '',
          storage_conditions: '',
          private_label_notes: '',
        });
        setSampleAvailable(false);
        setPrivateLabelAvailable(false);
        setFiles([]);
        setImageUrls([]);
        setComplianceBadges([]);
        onOpenChange(false);
        onSaved();
        toast.success(isEditing ? 'Đã cập nhật sản phẩm' : 'Đã thêm sản phẩm mới');
      } else {
        toast.error(result.error || 'Không thể lưu sản phẩm. Vui lòng thử lại.');
      }
    } catch (error) {
      console.error('[v0] Error saving product:', error);
      toast.error('Đã xảy ra lỗi khi lưu sản phẩm');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Cập nhật sản phẩm cho ${clientName}`
              : `Thêm sản phẩm mới cho ${clientName}`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-semibold">Thông tin cơ bản</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="product_name">
                  Tên sản phẩm <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="product_name"
                  name="product_name"
                  value={formData.product_name}
                  onChange={handleInputChange}
                  placeholder="VD: Cà phê Arabica"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product_code">Mã sản phẩm</Label>
                <Input
                  id="product_code"
                  name="product_code"
                  value={formData.product_code}
                  onChange={handleInputChange}
                  placeholder="VD: COFFEE-001"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">
                  Danh mục <span className="text-destructive">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Select
                    value={formData.category}
                    onValueChange={(v) => handleSelectChange('category', v)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Chọn danh mục" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.value}>
                          {cat.label_vi}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {canAddCategory && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setAddCategoryOpen(true)}
                      aria-label="Thêm danh mục mới"
                      title="Thêm danh mục mới"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subcategory">Danh mục phụ</Label>
                <Input
                  id="subcategory"
                  name="subcategory"
                  value={formData.subcategory}
                  onChange={handleInputChange}
                  placeholder="VD: Chế biến ướt, Single Origin"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Mô tả</Label>
              <MarkdownTextarea
                id="description"
                name="description"
                value={formData.description}
                onChange={(value) => setFormData((prev) => ({ ...prev, description: value }))}
                placeholder="Mô tả chi tiết về sản phẩm"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="country_of_origin">
                  Xuất xứ <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="country_of_origin"
                  name="country_of_origin"
                  value={formData.country_of_origin}
                  onChange={handleInputChange}
                  placeholder="VD: Việt Nam"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="key_specifications">Thông số kỹ thuật chính</Label>
                <Input
                  id="key_specifications"
                  name="key_specifications"
                  value={formData.key_specifications}
                  onChange={handleInputChange}
                  placeholder="VD: Độ ẩm 12%, Screen 16+, Grade A"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="usp">Điểm bán hàng nổi bật (USP)</Label>
              <MarkdownTextarea
                id="usp"
                name="usp"
                value={formData.usp}
                onChange={(value) => setFormData((prev) => ({ ...prev, usp: value }))}
                placeholder="VD: Canh tác bền vững, truy xuất nguồn gốc trực tiếp từ nông trại, giá cạnh tranh so với thị trường"
                rows={2}
              />
            </div>
          </div>

          {/* Capacity & Pricing */}
          <div className="space-y-4">
            <h3 className="font-semibold">Năng lực & Giá</h3>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="monthly_capacity">Năng lực/tháng</Label>
                <Input
                  id="monthly_capacity"
                  name="monthly_capacity_units"
                  type="number"
                  value={formData.monthly_capacity_units}
                  onChange={handleInputChange}
                  placeholder="500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Đơn vị</Label>
                <Select value={formData.unit_of_measure} onValueChange={(v) => handleSelectChange('unit_of_measure', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((unit) => (
                      <SelectItem key={unit.value} value={unit.value}>
                        {unit.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Tiền tệ</Label>
                <Select value={formData.currency} onValueChange={(v) => handleSelectChange('currency', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((curr) => (
                      <SelectItem key={curr} value={curr}>
                        {curr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min_price">Giá tối thiểu</Label>
                <Input
                  id="min_price"
                  name="min_unit_price"
                  type="number"
                  step="0.01"
                  value={formData.min_unit_price}
                  onChange={handleInputChange}
                  placeholder="4.50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_price">Giá tối đa</Label>
                <Input
                  id="max_price"
                  name="max_unit_price"
                  type="number"
                  step="0.01"
                  value={formData.max_unit_price}
                  onChange={handleInputChange}
                  placeholder="5.50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price_unit">Giá tính theo</Label>
                <Input
                  id="price_unit"
                  name="price_unit"
                  value={formData.price_unit}
                  onChange={handleInputChange}
                  placeholder="VD: per kg, per 20ft container"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="incoterm">
                  Điều kiện giao hàng (Incoterm) <span className="text-destructive">*</span>
                </Label>
                <Select value={formData.incoterm} onValueChange={(v) => handleSelectChange('incoterm', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn Incoterm" />
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
                <Label htmlFor="incoterm_place">Cảng/Địa điểm giao hàng</Label>
                <Input
                  id="incoterm_place"
                  name="incoterm_place"
                  value={formData.incoterm_place}
                  onChange={handleInputChange}
                  placeholder="VD: Cảng Cát Lái, TP.HCM"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_terms">Điều khoản thanh toán</Label>
                <Select
                  value={formData.payment_terms}
                  onValueChange={(v) => handleSelectChange('payment_terms', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn điều khoản" />
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

          {/* Order Terms */}
          <div className="space-y-4">
            <h3 className="font-semibold">Điều kiện đặt hàng</h3>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="moq_value">
                  Số lượng đặt hàng tối thiểu <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="moq_value"
                  name="moq_value"
                  type="number"
                  step="0.01"
                  value={formData.moq_value}
                  onChange={handleInputChange}
                  placeholder="VD: 1000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="moq_unit">Đơn vị đơn hàng MOQ</Label>
                <Input
                  id="moq_unit"
                  name="moq_unit"
                  value={formData.moq_unit}
                  onChange={handleInputChange}
                  placeholder="VD: kg, container 20ft"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead_time">
                  Thời gian giao hàng <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="lead_time"
                  name="lead_time"
                  value={formData.lead_time}
                  onChange={handleInputChange}
                  placeholder="VD: 15-20 ngày sau đặt cọc"
                />
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="sample_available"
                checked={sampleAvailable}
                onCheckedChange={(checked) => setSampleAvailable(checked === true)}
              />
              <label htmlFor="sample_available" className="text-sm font-medium leading-none cursor-pointer">
                Có sẵn hàng mẫu
                <p className="text-xs text-muted-foreground mt-1">
                  Cho biết người mua có thể yêu cầu mẫu trước khi đặt hàng
                </p>
              </label>
            </div>

            {sampleAvailable && (
              <div className="space-y-2">
                <Label htmlFor="sample_notes">Chi tiết hàng mẫu</Label>
                <Input
                  id="sample_notes"
                  name="sample_notes"
                  value={formData.sample_notes}
                  onChange={handleInputChange}
                  placeholder="VD: Mẫu miễn phí, người mua trả phí vận chuyển"
                />
              </div>
            )}
          </div>

          {/* Packing & Storage */}
          <div className="space-y-4">
            <h3 className="font-semibold">Đóng gói & Bảo quản</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="packing">Quy cách đóng gói</Label>
                <Input
                  id="packing"
                  name="packing"
                  value={formData.packing}
                  onChange={handleInputChange}
                  placeholder="VD: Bao PP 25kg, đóng trong container"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="package_size">Kích thước đóng gói</Label>
                <Input
                  id="package_size"
                  name="package_size"
                  value={formData.package_size}
                  onChange={handleInputChange}
                  placeholder="VD: 60x40x20 cm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shelf_life">Hạn sử dụng</Label>
                <Input
                  id="shelf_life"
                  name="shelf_life"
                  value={formData.shelf_life}
                  onChange={handleInputChange}
                  placeholder="VD: 12 tháng kể từ ngày sản xuất"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="storage_conditions">Điều kiện bảo quản</Label>
                <Input
                  id="storage_conditions"
                  name="storage_conditions"
                  value={formData.storage_conditions}
                  onChange={handleInputChange}
                  placeholder="VD: Nơi khô, mát, tránh ánh nắng trực tiếp"
                />
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="private_label_available"
                checked={privateLabelAvailable}
                onCheckedChange={(checked) => setPrivateLabelAvailable(checked === true)}
              />
              <label htmlFor="private_label_available" className="text-sm font-medium leading-none cursor-pointer">
                Hỗ trợ gia công nhãn riêng (Private Label/OEM)
                <p className="text-xs text-muted-foreground mt-1">
                  Cho biết nhà cung cấp có thể đóng gói theo thương hiệu của người mua
                </p>
              </label>
            </div>

            {privateLabelAvailable && (
              <div className="space-y-2">
                <Label htmlFor="private_label_notes">Chi tiết Private Label</Label>
                <Input
                  id="private_label_notes"
                  name="private_label_notes"
                  value={formData.private_label_notes}
                  onChange={handleInputChange}
                  placeholder="VD: MOQ riêng cho Private Label là 5000 đơn vị"
                />
              </div>
            )}
          </div>

          {/* Compliance & Status */}
          <div className="space-y-4">
            <h3 className="font-semibold">Tuân thủ & Trạng thái</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hs_code">Mã HS</Label>
                <Input
                  id="hs_code"
                  name="hs_code"
                  value={formData.hs_code}
                  onChange={handleInputChange}
                  placeholder="0901110000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">
                  Trạng thái <span className="text-destructive">*</span>
                </Label>
                <Select value={formData.status} onValueChange={(v) => handleSelectChange('status', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Đang hoạt động</SelectItem>
                    <SelectItem value="inactive">Ngừng hoạt động</SelectItem>
                    <SelectItem value="suspended">Tạm ngưng</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Compliance Badges */}
            <div className="space-y-2">
              <Label>Chứng nhận & Tuân thủ</Label>
              <div className="grid grid-cols-2 gap-3">
                {COMPLIANCE_BADGES.map((badge) => (
                  <div key={badge.value} className="flex items-start space-x-3">
                    <Checkbox
                      id={`badge-${badge.value}`}
                      checked={complianceBadges.includes(badge.value)}
                      onCheckedChange={(checked) =>
                        handleComplianceToggle(badge.value, checked === true)
                      }
                    />
                    <label
                      htmlFor={`badge-${badge.value}`}
                      className="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {badge.label}
                      <p className="text-xs text-muted-foreground mt-1">{badge.description}</p>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Image Upload */}
          <div className="space-y-4">
            <h3 className="font-semibold">Ảnh sản phẩm</h3>
            <p className="text-sm text-muted-foreground">
              Tải lên hình ảnh sản phẩm (tối đa 10 ảnh, mỗi ảnh 10MB)
            </p>

            {/* Existing Images */}
            {imageUrls.length > 0 && (
              <div className="grid grid-cols-4 gap-3">
                {imageUrls.map((url, idx) => (
                  <div
                    key={`existing-${idx}`}
                    className="relative aspect-square bg-muted rounded-lg overflow-hidden group"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Product image ${idx + 1}`}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeImageUrl(idx)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* New Files Preview */}
            {files.length > 0 && (
              <div className="grid grid-cols-4 gap-3">
                {files.map((file, idx) => (
                  <div
                    key={`new-${idx}`}
                    className="relative aspect-square bg-muted rounded-lg overflow-hidden group border-2 border-dashed border-primary"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`New image ${idx + 1}`}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-primary text-primary-foreground text-xs py-0.5 text-center">
                      Chưa upload
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeFile(idx)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Zone */}
            {(imageUrls.length + files.length) < 10 && (
              <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/50 transition-colors">
                <input
                  type="file"
                  id="product-images"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleFileChange}
                  disabled={(imageUrls.length + files.length) >= 10}
                  className="hidden"
                />
                <Label htmlFor="product-images" className="cursor-pointer">
                  <ImageIcon className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="font-medium">Kéo thả ảnh vào đây hoặc bấm để chọn</p>
                  <p className="text-sm text-muted-foreground">JPG, PNG, WebP, GIF - Tối đa 10MB/ảnh</p>
                </Label>
              </div>
            )}
          </div>

          {/* File Upload */}
          <div className="space-y-4">
            <h3 className="font-semibold">Tệp đính kèm (Hình ảnh, Video, Chứng nhận)</h3>
            <p className="text-sm text-muted-foreground">
              Tải lên hình ảnh, video, chứng nhận sản phẩm (tối đa 5 tệp, mỗi tệp 50MB)
            </p>

            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/50 transition-colors">
              <input
                type="file"
                id="files"
                multiple
                onChange={handleFileChange}
                disabled={files.length >= 5}
                className="hidden"
              />
              <Label htmlFor="files" className="cursor-pointer">
                <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="font-medium">Kéo thả tệp vào đây hoặc bấm để chọn</p>
                <p className="text-sm text-muted-foreground">Hỗ trợ hình ảnh, video và PDF</p>
              </Label>
            </div>

            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
                    className="flex items-center justify-between bg-muted p-3 rounded-lg"
                  >
                    <span className="text-sm truncate flex-1">{file.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(idx)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Hủy
            </Button>
            <Button type="submit" disabled={loading || uploading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {uploading ? 'Đang tải ảnh...' : isEditing ? 'Cập nhật sản phẩm' : 'Thêm sản phẩm'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    {/* Sub-dialog for adding a new product category. Rendered as a sibling
        so it overlays the parent dialog without z-index conflicts. */}
    <AddProductCategoryDialog
      open={addCategoryOpen}
      onOpenChange={setAddCategoryOpen}
      onAdded={handleCategoryAdded}
    />
    </>
  );
}
