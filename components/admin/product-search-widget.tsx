'use client';

import { useState, useCallback } from 'react';
import { Search, Filter, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Empty } from '@/components/ui/empty';
import { searchClientProductsAction } from '@/app/admin/clients/products-actions';
import type { ClientProduct } from '@/app/admin/clients/products-actions';

interface SearchResult extends ClientProduct {
  profiles: {
    id: string;
    company_name: string | null;
    email: string | null;
    fda_registration_number: string | null;
    industry: string | null;
    industries: string[] | null;
  } | null;
}

const CATEGORIES = [
  { value: '', label: 'All Categories' },
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

export function ProductSearchWidget() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [count, setCount] = useState(0);

  // Filters
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    subcategory: '',
    min_capacity: '',
    min_price: '',
    max_price: '',
  });

  const handleSearch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await searchClientProductsAction({
        search: filters.search || undefined,
        category: filters.category || undefined,
        subcategory: filters.subcategory || undefined,
        min_capacity: filters.min_capacity ? parseInt(filters.min_capacity) : undefined,
        min_price: filters.min_price ? parseFloat(filters.min_price) : undefined,
        max_price: filters.max_price ? parseFloat(filters.max_price) : undefined,
        status: 'active',
        limit: 100,
      });

      if (result.success) {
        setResults(result.data as SearchResult[]);
        setCount(result.count || 0);
      }
    } catch (error) {
      console.error('[v0] Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const handleReset = () => {
    setFilters({
      search: '',
      category: '',
      subcategory: '',
      min_capacity: '',
      min_price: '',
      max_price: '',
    });
    setResults([]);
  };

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <Card>
        <CardHeader>
          <CardTitle>Product Discovery</CardTitle>
          <CardDescription>
            Search for products across all clients to match buyer requirements
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Quick Search */}
          <div className="flex gap-2">
            <Input
              placeholder="Search by product name, code, or description..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={loading} size="lg" gap-2>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              gap-2
            >
              <Filter className="w-4 h-4" />
              Filters
            </Button>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="pt-4 border-t space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <Select value={filters.category} onValueChange={(value) =>
                    setFilters({ ...filters, category: value, subcategory: '' })
                  }>
                    <SelectTrigger>
                      <SelectValue />
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
                  <label className="text-sm font-medium">Min Capacity (units)</label>
                  <Input
                    type="number"
                    placeholder="e.g., 500"
                    value={filters.min_capacity}
                    onChange={(e) => setFilters({ ...filters, min_capacity: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Min Price (USD)</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="e.g., 3.50"
                    value={filters.min_price}
                    onChange={(e) => setFilters({ ...filters, min_price: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Max Price (USD)</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="e.g., 5.00"
                    value={filters.max_price}
                    onChange={(e) => setFilters({ ...filters, max_price: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={handleReset}
                >
                  Reset Filters
                </Button>
                <Button onClick={handleSearch} disabled={loading}>
                  Apply Filters
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {results.length === 0 && count === 0 ? (
        <Empty
          title="No products found"
          description="Try adjusting your search criteria or add products to get started"
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
            <CardDescription>
              Found {count} product{count !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="space-y-4">
              {results.map((product) => (
                <div
                  key={product.id}
                  className="flex flex-col gap-3 p-4 border rounded-lg hover:bg-muted/50 transition"
                >
                  {/* Product Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{product.product_name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {product.product_code && <span>{product.product_code} • </span>}
                        <span>
                          {product.category}
                          {product.subcategory && ` - ${product.subcategory}`}
                        </span>
                      </p>
                    </div>
                    <Badge variant="secondary">{product.status}</Badge>
                  </div>

                  {/* Product Details */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {product.monthly_capacity_units && (
                      <div>
                        <span className="text-muted-foreground">Capacity</span>
                        <p className="font-medium">
                          {product.monthly_capacity_units} {product.unit_of_measure}
                        </p>
                      </div>
                    )}

                    {(product.min_unit_price || product.max_unit_price) && (
                      <div>
                        <span className="text-muted-foreground">Price Range</span>
                        <p className="font-medium">
                          {product.currency} {product.min_unit_price || '—'} -{' '}
                          {product.max_unit_price || '—'}
                        </p>
                      </div>
                    )}

                    {product.hs_code && (
                      <div>
                        <span className="text-muted-foreground">HS Code</span>
                        <p className="font-medium">{product.hs_code}</p>
                      </div>
                    )}
                  </div>

                  {/* Client Info */}
                  {product.profiles && (
                    <div className="pt-3 border-t">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Supplier</span>
                          <p className="font-medium">{product.profiles.company_name || 'Unknown'}</p>
                        </div>

                        <div>
                          <span className="text-muted-foreground">Contact</span>
                          <p className="font-medium break-all text-xs">{product.profiles.email}</p>
                        </div>

                        {product.profiles.fda_registration_number && (
                          <div>
                            <span className="text-muted-foreground">FDA Reg</span>
                            <p className="font-medium text-xs truncate">
                              {product.profiles.fda_registration_number}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
