'use client';

import { useState, useEffect } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { listClientProductsAction } from '@/app/admin/clients/products-actions';
import type { ClientProduct } from '@/app/admin/clients/products-actions';
import { markdownToPlainText } from '@/lib/markdown-preview';
import { ClientProductDialog } from '@/components/client/client-product-dialog';

interface ClientProductsListProps {
  clientId: string;
}

export function ClientProductsList({ clientId }: ClientProductsListProps) {
  const [products, setProducts] = useState<ClientProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ClientProduct | null>(null);

  useEffect(() => {
    loadProducts();
  }, [clientId]);

  const handleOpenDialog = (product?: ClientProduct) => {
    setEditingProduct(product || null);
    setDialogOpen(true);
  };

  const handleSaved = () => {
    loadProducts();
  };

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
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div className="mb-2">
            <h1 className="text-3xl font-bold">My Products</h1>
            <p className="text-muted-foreground mt-2">
              Quản lý catalog sản phẩm của bạn. Mỗi sản phẩm cần cam kết giá: không nâng riêng cho Vexim và phản ánh giá thương mại thực tế.
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Thêm sản phẩm
          </Button>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : products.length === 0 ? (
        <Empty
          title="No products yet"
          description="Start by adding your first product — you will be asked to confirm price attestation."
          action={
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4">
          {products.map((product) => (
            <Card key={product.id} className="overflow-hidden">
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
                    <Badge variant={statusBadgeVariant(product.status)}>{product.status}</Badge>
                    <Button variant="outline" size="sm" onClick={() => handleOpenDialog(product)}>
                      Sửa
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {product.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {markdownToPlainText(product.description)}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm">
                  {product.monthly_capacity_units && (
                    <div>
                      <span className="font-medium">Monthly Capacity</span>
                      <p className="text-muted-foreground">
                        {product.monthly_capacity_units} {product.unit_of_measure}
                      </p>
                    </div>
                  )}

                  {(product.min_unit_price || product.max_unit_price) && (
                    <div>
                      <span className="font-medium">Price Range</span>
                      <p className="text-muted-foreground">
                        {product.currency} {product.min_unit_price || '—'} - {product.max_unit_price || '—'}
                        {product.price_unit ? ` (${product.price_unit})` : product.unit_of_measure ? `/${product.unit_of_measure}` : ''}
                      </p>
                    </div>
                  )}

                  {product.hs_code && (
                    <div>
                      <span className="font-medium">HS Code</span>
                      <p className="text-muted-foreground">{product.hs_code}</p>
                    </div>
                  )}

                  {product.country_of_origin && (
                    <div>
                      <span className="font-medium">Country of Origin</span>
                      <p className="text-muted-foreground">{product.country_of_origin}</p>
                    </div>
                  )}

                  {(product.moq_value || product.moq_unit) && (
                    <div>
                      <span className="font-medium">MOQ</span>
                      <p className="text-muted-foreground">
                        {product.moq_value || '—'} {product.moq_unit || ''}
                      </p>
                    </div>
                  )}

                  {product.lead_time && (
                    <div>
                      <span className="font-medium">Lead Time</span>
                      <p className="text-muted-foreground">{product.lead_time}</p>
                    </div>
                  )}

                  {product.incoterm && (
                    <div>
                      <span className="font-medium">Incoterm</span>
                      <p className="text-muted-foreground">
                        {product.incoterm}
                        {product.incoterm_place ? ` — ${product.incoterm_place}` : ''}
                      </p>
                    </div>
                  )}

                  <div>
                    <span className="font-medium">Last Updated</span>
                    <p className="text-muted-foreground">{new Date(product.updated_at).toLocaleDateString()}</p>
                  </div>

                  {(product as any).price_confirmed && (
                    <div className="col-span-2">
                      <span className="font-medium text-emerald-700">✓ Đã cam kết giá</span>
                      <p className="text-muted-foreground text-xs">
                        {(product as any).price_attested_at
                          ? `Xác nhận lúc ${new Date((product as any).price_attested_at).toLocaleString('vi-VN')}`
                          : 'Đã xác nhận cam kết giá thương mại thực tế'}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ClientProductDialog
        clientId={clientId}
        product={editingProduct}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={handleSaved}
      />
    </div>
  );
}
