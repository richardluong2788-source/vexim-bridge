'use client';

/**
 * Sub-dialog used inside AdminProductDialog for super_admin / admin to add
 * a new product category on the fly. On success, calls onAdded() with the
 * newly-created category so the parent can refresh its list and auto-select
 * the new value.
 */

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  addProductCategoryAction,
  type ProductCategory,
} from '@/app/admin/clients/categories-actions';

interface AddProductCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: (category: ProductCategory) => void;
}

export function AddProductCategoryDialog({
  open,
  onOpenChange,
  onAdded,
}: AddProductCategoryDialogProps) {
  const [labelVi, setLabelVi] = useState('');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setLabelVi('');
    setValue('');
    setError(null);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!labelVi.trim()) {
      setError('Vui lòng nhập tên danh mục');
      return;
    }

    setLoading(true);
    try {
      const res = await addProductCategoryAction({
        label_vi: labelVi.trim(),
        // If admin leaves "value" blank we let the server default it from label_vi.
        value: value.trim() || undefined,
      });

      if (!res.success || !res.data) {
        setError(res.error || 'Không thể thêm danh mục');
        return;
      }

      onAdded(res.data);
      reset();
      onOpenChange(false);
    } catch (err) {
      console.error('[v0] addProductCategoryAction failed:', err);
      setError('Đã xảy ra lỗi không mong muốn');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Thêm danh mục mới</DialogTitle>
          <DialogDescription>
            Danh mục mới sẽ hiển thị trong dropdown cho tất cả sản phẩm sau này.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cat_label_vi">
              Tên danh mục (Tiếng Việt) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cat_label_vi"
              value={labelVi}
              onChange={(e) => setLabelVi(e.target.value)}
              placeholder="VD: Trà thảo mộc"
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cat_value">Mã danh mục (Tiếng Anh, tùy chọn)</Label>
            <Input
              id="cat_value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="VD: Herbal Tea"
            />
            <p className="text-xs text-muted-foreground">
              Mã được dùng để lưu trong database. Nếu để trống, hệ thống sẽ dùng tên tiếng
              Việt.
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={loading}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={loading || !labelVi.trim()}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Thêm danh mục
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
