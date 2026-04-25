'use client';

/**
 * Admin Product Dialog
 *
 * Purpose: Admin uses this dialog to add/edit products for clients
 * Workflow: Admin goes to client detail page → Products section → Add/Edit product
 * The product is then visible to client in /client/products (read-only)
 */

import { useEffect, useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { addClientProductAction, updateClientProductAction } from '@/app/admin/clients/products-actions';
import type { ClientProduct } from '@/app/admin/clients/products-actions';

const CATEGORIES = [
  { value: 'Coffee', label: 'Cà phê' },
  { value: 'Cocoa', label: 'Ca cao' },
  { value: 'Pepper', label: 'Hồ tiêu' },
  { value: 'Cashew', label: 'Hạt điều' },
  { value: 'Spices', label: 'Gia vị' },
  { value: 'Nuts', label: 'Các loại hạt' },
  { value: 'Dried Fruits', label: 'Trái cây sấy' },
  { value: 'Grains', label: 'Ngũ cốc' },
  { value: 'Oils', label: 'Dầu' },
  { value: 'Other', label: 'Khác' },
];

const UNITS = [
  { value: 'kg', label: 'kg' },
  { value: 'ton', label: 'tấn' },
  { value: 'liter', label: 'lít' },
  { value: 'boxes', label: 'thùng' },
  { value: 'bags', label: 'bao' },
  { value: 'units', label: 'cái' },
];
const CURRENCIES = ['USD', 'EUR', 'VND', 'CNY', 'SGD', 'MYR'];

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
  const [files, setFiles] = useState<File[]>([]);
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
    hs_code: product?.hs_code || '',
    status: product?.status || 'active',
  });

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
      hs_code: product?.hs_code || '',
      status: product?.status || 'active',
    });
    setFiles([]);
  }, [product, open]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        monthly_capacity_units: formData.monthly_capacity_units
          ? Number.parseInt(formData.monthly_capacity_units)
          : null,
        min_unit_price: formData.min_unit_price ? Number.parseFloat(formData.min_unit_price) : null,
        max_unit_price: formData.max_unit_price ? Number.parseFloat(formData.max_unit_price) : null,
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
          hs_code: '',
          status: 'active',
        });
        setFiles([]);
        onOpenChange(false);
        onSaved();
      }
    } catch (error) {
      console.error('[v0] Error saving product:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
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
                <Select value={formData.category} onValueChange={(v) => handleSelectChange('category', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn danh mục" />
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
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Mô tả chi tiết về sản phẩm"
                rows={3}
              />
            </div>
          </div>

          {/* Capacity & Pricing */}
          <div className="space-y-4">
            <h3 className="font-semibold">Năng lực & Giá</h3>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="monthly_capacity">Năng lực hàng tháng</Label>
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

            <div className="grid grid-cols-2 gap-4">
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
            </div>
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
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? 'Cập nhật sản phẩm' : 'Thêm sản phẩm'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
