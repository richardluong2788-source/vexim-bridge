'use client';

/**
 * Admin Product Dialog
 * 
 * Purpose: Admin uses this dialog to add/edit products for clients
 * Workflow: Admin goes to client detail page → Products section → Add/Edit product
 * The product is then visible to client in /client/products (read-only)
 * 
 * Features:
 * - Upload images, certificates, videos
 * - Set capacity, pricing, specifications
 * - Activate/deactivate products
 * - Edit existing products
 */

import { useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { addClientProductAction, updateClientProductAction } from '@/app/admin/clients/products-actions';
import type { ClientProduct } from '@/app/admin/clients/products-actions';

const CATEGORIES = [
  'Coffee',
  'Cocoa',
  'Pepper',
  'Cashew',
  'Spices',
  'Nuts',
  'Dried Fruits',
  'Grains',
  'Oils',
  'Other',
];

const UNITS = ['kg', 'ton', 'liter', 'boxes', 'bags', 'units'];
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
          ? parseInt(formData.monthly_capacity_units)
          : null,
        min_unit_price: formData.min_unit_price ? parseFloat(formData.min_unit_price) : null,
        max_unit_price: formData.max_unit_price ? parseFloat(formData.max_unit_price) : null,
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
          <DialogTitle>{isEditing ? 'Edit Product' : 'Add New Product'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Update product for ${clientName}`
              : `Add a new product for ${clientName}`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-semibold">Basic Information</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="product_name">Product Name *</Label>
                <Input
                  id="product_name"
                  name="product_name"
                  value={formData.product_name}
                  onChange={handleInputChange}
                  placeholder="e.g., Arabica Coffee Beans"
                  required
                />
              </div>
              <div>
                <Label htmlFor="product_code">Product Code</Label>
                <Input
                  id="product_code"
                  name="product_code"
                  value={formData.product_code}
                  onChange={handleInputChange}
                  placeholder="e.g., COFFEE-001"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Category *</Label>
                <Select value={formData.category} onValueChange={(v) => handleSelectChange('category', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="subcategory">Sub-Category</Label>
                <Input
                  id="subcategory"
                  name="subcategory"
                  value={formData.subcategory}
                  onChange={handleInputChange}
                  placeholder="e.g., Washed, Single Origin"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Detailed product description"
                rows={3}
              />
            </div>
          </div>

          {/* Capacity & Pricing */}
          <div className="space-y-4">
            <h3 className="font-semibold">Capacity & Pricing</h3>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="monthly_capacity">Monthly Capacity</Label>
                <Input
                  id="monthly_capacity"
                  name="monthly_capacity_units"
                  type="number"
                  value={formData.monthly_capacity_units}
                  onChange={handleInputChange}
                  placeholder="500"
                />
              </div>
              <div>
                <Label htmlFor="unit">Unit</Label>
                <Select value={formData.unit_of_measure} onValueChange={(v) => handleSelectChange('unit_of_measure', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="currency">Currency</Label>
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
              <div>
                <Label htmlFor="min_price">Min Unit Price</Label>
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
              <div>
                <Label htmlFor="max_price">Max Unit Price</Label>
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
            <h3 className="font-semibold">Compliance & Status</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="hs_code">HS Code</Label>
                <Input
                  id="hs_code"
                  name="hs_code"
                  value={formData.hs_code}
                  onChange={handleInputChange}
                  placeholder="0901110000"
                />
              </div>
              <div>
                <Label htmlFor="status">Status *</Label>
                <Select value={formData.status} onValueChange={(v) => handleSelectChange('status', v)}>
                  <SelectTrigger>
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
          </div>

          {/* File Upload */}
          <div className="space-y-4">
            <h3 className="font-semibold">Attachments (Images, Videos, Certificates)</h3>
            <p className="text-sm text-muted-foreground">
              Upload product images, videos, certificates (max 5 files, 50MB each)
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
                <p className="font-medium">Drag files here or click to browse</p>
                <p className="text-sm text-muted-foreground">Supports images, videos, and PDFs</p>
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
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? 'Update Product' : 'Add Product'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
