'use client';

/**
 * Admin Client Products Manager
 *
 * Location: Integrated into Admin Client Detail Page (/admin/clients/[id])
 * Purpose: Allow admin to manage all products for a specific client
 */

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Empty } from '@/components/ui/empty';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  listClientProductsAction,
  deleteClientProductAction,
} from '@/app/admin/clients/products-actions';
import { AdminProductDialog } from './admin-product-dialog';
import type { ClientProduct } from '@/app/admin/clients/products-actions';
import { toast } from 'sonner';

interface AdminClientProductsManagerProps {
  clientId: string;
  clientName: string;
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Đang hoạt động',
  inactive: 'Ngừng hoạt động',
  suspended: 'Tạm ngưng',
};

export function AdminClientProductsManager({
  clientId,
  clientName,
}: AdminClientProductsManagerProps) {
  const [products, setProducts] = useState<ClientProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ClientProduct | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<ClientProduct | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const result = await listClientProductsAction(clientId, { status: undefined });
      if (result.success) {
        setProducts(result.data || []);
      }
    } catch (error) {
      console.error('[v0] Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (product?: ClientProduct) => {
    setEditingProduct(product || null);
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingProduct(null);
  };

  const handleProductSaved = () => {
    loadProducts();
    handleCloseDialog();
  };

  const handleConfirmDelete = async () => {
    if (!deletingProduct) return;
    setIsDeleting(true);
    try {
      const result = await deleteClientProductAction(deletingProduct.id);
      if (result.success) {
        toast.success(`Đã xóa sản phẩm "${deletingProduct.product_name}"`);
        setDeletingProduct(null);
        await loadProducts();
      } else {
        toast.error(result.error || 'Không thể xóa sản phẩm');
      }
    } catch (error) {
      console.error('[v0] Error deleting product:', error);
      toast.error('Đã xảy ra lỗi khi xóa sản phẩm');
    } finally {
      setIsDeleting(false);
    }
  };

  const statusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'inactive':
        return 'secondary';
      case 'suspended':
        return 'destructive';
      default:
        return 'default';
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex justify-end">
        <Button onClick={() => handleOpenDialog()} size="lg">
          <Plus className="w-4 h-4 mr-2" />
          Thêm sản phẩm
        </Button>
      </div>

      {/* Product List */}
      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : products.length === 0 ? (
        <Empty
          title="Chưa có sản phẩm nào"
          description={`Bắt đầu bằng cách thêm sản phẩm đầu tiên cho ${clientName}`}
          action={
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Thêm sản phẩm
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4">
          {products.map((product) => (
            <Card key={product.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="truncate">{product.product_name}</CardTitle>
                    <CardDescription className="mt-1">
                      {product.product_code && <span>{product.product_code}</span>}
                      {product.category && (
                        <span className="ml-2">
                          {product.category}
                          {product.subcategory && ` - ${product.subcategory}`}
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={statusBadgeVariant(product.status)}>
                      {STATUS_LABELS[product.status] ?? product.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {product.description && (
                  <p className="text-sm text-muted-foreground">{product.description}</p>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                  {product.monthly_capacity_units && (
                    <div>
                      <span className="font-medium block text-xs uppercase text-muted-foreground mb-1">
                        Năng lực hàng tháng
                      </span>
                      <p className="font-semibold">
                        {product.monthly_capacity_units} {product.unit_of_measure}
                      </p>
                    </div>
                  )}

                  {(product.min_unit_price || product.max_unit_price) && (
                    <div>
                      <span className="font-medium block text-xs uppercase text-muted-foreground mb-1">
                        Khoảng giá
                      </span>
                      <p className="font-semibold">
                        {product.currency} {product.min_unit_price || '—'} - {product.max_unit_price || '—'}
                      </p>
                    </div>
                  )}

                  {product.hs_code && (
                    <div>
                      <span className="font-medium block text-xs uppercase text-muted-foreground mb-1">
                        Mã HS
                      </span>
                      <p className="font-semibold">{product.hs_code}</p>
                    </div>
                  )}

                  <div>
                    <span className="font-medium block text-xs uppercase text-muted-foreground mb-1">
                      Cập nhật
                    </span>
                    <p className="font-semibold">
                      {new Date(product.updated_at).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenDialog(product)}
                    className="flex-1"
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Chỉnh sửa
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeletingProduct(product)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Xóa
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <AdminProductDialog
        clientId={clientId}
        clientName={clientName}
        product={editingProduct}
        open={showDialog}
        onOpenChange={setShowDialog}
        onSaved={handleProductSaved}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingProduct}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeletingProduct(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa sản phẩm?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa sản phẩm{' '}
              <span className="font-semibold text-foreground">
                {deletingProduct?.product_name}
              </span>
              ? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
