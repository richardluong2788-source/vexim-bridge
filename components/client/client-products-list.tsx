'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Empty } from '@/components/ui/empty';
import { listClientProductsAction } from '@/app/admin/clients/products-actions';
import type { ClientProduct } from '@/app/admin/clients/products-actions';

interface ClientProductsListProps {
  clientId: string;
}

export function ClientProductsList({ clientId }: ClientProductsListProps) {
  const [products, setProducts] = useState<ClientProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // Load products
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
        <div className="mb-2">
          <h1 className="text-3xl font-bold">My Products</h1>
          <p className="text-muted-foreground mt-2">Your product catalog is managed by Admin. Contact Admin to add or modify products.</p>
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
          description="Start by adding your first product to your catalog"
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
                    <Badge variant={statusBadgeVariant(product.status)}>
                      {product.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {product.description && <p className="text-sm text-muted-foreground">{product.description}</p>}

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
                        {product.unit_of_measure && `/${product.unit_of_measure}`}
                      </p>
                    </div>
                  )}

                  {product.hs_code && (
                    <div>
                      <span className="font-medium">HS Code</span>
                      <p className="text-muted-foreground">{product.hs_code}</p>
                    </div>
                  )}

                  <div>
                    <span className="font-medium">Last Updated</span>
                    <p className="text-muted-foreground">{new Date(product.updated_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
