'use client';

/**
 * Admin Client Products Manager
 * 
 * Location: Integrated into Admin Client Detail Page (/admin/clients/[id])
 * Purpose: Allow admin to manage all products for a specific client
 * 
 * Workflow:
 * 1. Admin clicks on a client in /admin/clients
 * 2. Scrolls to "Products" section
 * 3. Clicks "+ Add Product"
 * 4. Fills form with product info and uploads files
 * 5. Product appears on client's /client/products page (read-only)
 * 
 * Admin can also:
 * - Edit existing products
 * - Delete products
 * - Change product status (active/inactive/suspended)
 */

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Loader2, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Empty } from '@/components/ui/empty';
import { listClientProductsAction } from '@/app/admin/clients/products-actions';
import { AdminProductDialog } from './admin-product-dialog';
import type { ClientProduct } from '@/app/admin/clients/products-actions';

interface AdminClientProductsManagerProps {
  clientId: string;
  clientName: string;
}

export function AdminClientProductsManager({
  clientId,
  clientName,
}: AdminClientProductsManagerProps) {
  const [products, setProducts] = useState<ClientProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ClientProduct | null>(null);

  useEffect(() => {
    loadProducts();
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
          Add Product
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
          title="No products yet"
          description={`Start by adding the first product for ${clientName}`}
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
                      {product.status}
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
                        Monthly Capacity
                      </span>
                      <p className="font-semibold">
                        {product.monthly_capacity_units} {product.unit_of_measure}
                      </p>
                    </div>
                  )}

                  {(product.min_unit_price || product.max_unit_price) && (
                    <div>
                      <span className="font-medium block text-xs uppercase text-muted-foreground mb-1">
                        Price Range
                      </span>
                      <p className="font-semibold">
                        {product.currency} {product.min_unit_price || '—'} - {product.max_unit_price || '—'}
                      </p>
                    </div>
                  )}

                  {product.hs_code && (
                    <div>
                      <span className="font-medium block text-xs uppercase text-muted-foreground mb-1">
                        HS Code
                      </span>
                      <p className="font-semibold">{product.hs_code}</p>
                    </div>
                  )}

                  <div>
                    <span className="font-medium block text-xs uppercase text-muted-foreground mb-1">
                      Updated
                    </span>
                    <p className="font-semibold">{new Date(product.updated_at).toLocaleDateString()}</p>
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
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    disabled
                    title="Use Edit button to delete"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
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
    </div>
  );
}
