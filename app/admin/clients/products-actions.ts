'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export interface ClientProduct {
  id: string;
  client_id: string;
  product_name: string;
  product_code: string | null;
  category: string | null;
  subcategory: string | null;
  description: string | null;
  hs_code: string | null;
  unit_of_measure: string;
  min_unit_price: number | null;
  max_unit_price: number | null;
  currency: string;
  monthly_capacity_units: number | null;
  status: 'active' | 'inactive' | 'suspended';
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Add a new client product
export async function addClientProductAction(
  clientId: string,
  data: {
    product_name: string;
    product_code?: string;
    category?: string;
    subcategory?: string;
    description?: string;
    hs_code?: string;
    unit_of_measure?: string;
    min_unit_price?: number;
    max_unit_price?: number;
    currency?: string;
    monthly_capacity_units?: number;
    status?: 'active' | 'inactive' | 'suspended';
  }
) {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Verify user has permission (is admin/staff or the client themselves)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const isAdmin = profile?.role === 'admin' || profile?.role === 'staff' || profile?.role === 'super_admin';
  const isOwnClient = user.id === clientId;

  if (!isAdmin && !isOwnClient) {
    return { success: false, error: 'Unauthorized' };
  }

  // Insert product
  const { data: product, error } = await supabase
    .from('client_products')
    .insert([
      {
        client_id: clientId,
        product_name: data.product_name,
        product_code: data.product_code || null,
        category: data.category || null,
        subcategory: data.subcategory || null,
        description: data.description || null,
        hs_code: data.hs_code || null,
        unit_of_measure: data.unit_of_measure || 'kg',
        min_unit_price: data.min_unit_price || null,
        max_unit_price: data.max_unit_price || null,
        currency: data.currency || 'USD',
        monthly_capacity_units: data.monthly_capacity_units || null,
        status: data.status || 'active',
        created_by: user.id,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('[v0] addClientProductAction error:', error);
    return { success: false, error: error.message };
  }

  // Log activity
  await supabase.from('activities').insert([
    {
      action_type: 'client_product_added',
      description: `Product "${data.product_name}" added to client ${clientId}`,
      performed_by: user.id,
    },
  ]);

  return { success: true, data: product };
}

// Update a client product
export async function updateClientProductAction(
  productId: string,
  data: Partial<{
    product_name: string;
    product_code: string;
    category: string;
    subcategory: string;
    description: string;
    hs_code: string;
    unit_of_measure: string;
    min_unit_price: number;
    max_unit_price: number;
    currency: string;
    monthly_capacity_units: number;
    status: 'active' | 'inactive' | 'suspended';
  }>
) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Get product to check permissions
  const { data: product } = await supabase
    .from('client_products')
    .select('client_id')
    .eq('id', productId)
    .single();

  if (!product) {
    return { success: false, error: 'Product not found' };
  }

  // Check permissions
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const isAdmin = profile?.role === 'admin' || profile?.role === 'staff' || profile?.role === 'super_admin';
  const isOwnProduct = user.id === product.client_id;

  if (!isAdmin && !isOwnProduct) {
    return { success: false, error: 'Unauthorized' };
  }

  // Update product
  const { data: updated, error } = await supabase
    .from('client_products')
    .update(data)
    .eq('id', productId)
    .select()
    .single();

  if (error) {
    console.error('[v0] updateClientProductAction error:', error);
    return { success: false, error: error.message };
  }

  // Log activity
  await supabase.from('activities').insert([
    {
      action_type: 'client_product_updated',
      description: `Product "${data.product_name || 'Unknown'}" updated`,
      performed_by: user.id,
    },
  ]);

  return { success: true, data: updated };
}

// Delete a client product
export async function deleteClientProductAction(productId: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Get product to check permissions
  const { data: product } = await supabase
    .from('client_products')
    .select('client_id, product_name')
    .eq('id', productId)
    .single();

  if (!product) {
    return { success: false, error: 'Product not found' };
  }

  // Check permissions
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const isAdmin = profile?.role === 'admin' || profile?.role === 'staff' || profile?.role === 'super_admin';
  const isOwnProduct = user.id === product.client_id;

  if (!isAdmin && !isOwnProduct) {
    return { success: false, error: 'Unauthorized' };
  }

  // Delete product
  const { error } = await supabase.from('client_products').delete().eq('id', productId);

  if (error) {
    console.error('[v0] deleteClientProductAction error:', error);
    return { success: false, error: error.message };
  }

  // Log activity
  await supabase.from('activities').insert([
    {
      action_type: 'client_product_deleted',
      description: `Product "${product.product_name}" deleted`,
      performed_by: user.id,
    },
  ]);

  return { success: true };
}

// List client products (with filtering)
export async function listClientProductsAction(
  clientId: string,
  filters?: {
    category?: string;
    subcategory?: string;
    status?: string;
    min_capacity?: number;
    search?: string;
  }
) {
  const supabase = await createClient();

  let query = supabase
    .from('client_products')
    .select('*')
    .eq('client_id', clientId);

  if (filters?.category) {
    query = query.eq('category', filters.category);
  }

  if (filters?.subcategory) {
    query = query.eq('subcategory', filters.subcategory);
  }

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.min_capacity) {
    query = query.gte('monthly_capacity_units', filters.min_capacity);
  }

  if (filters?.search) {
    query = query.or(
      `product_name.ilike.%${filters.search}%,product_code.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
    );
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('[v0] listClientProductsAction error:', error);
    return { success: false, error: error.message, data: [] };
  }

  return { success: true, data: data || [] };
}

// Search products across all clients (for admin)
export async function searchClientProductsAction(filters: {
  category?: string;
  subcategory?: string;
  status?: string;
  min_capacity?: number;
  min_price?: number;
  max_price?: number;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { success: false, error: 'Not authenticated', data: [] };
  }

  // Verify user is admin or staff
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const isAdmin = profile?.role === 'admin' || profile?.role === 'staff' || profile?.role === 'super_admin';

  if (!isAdmin) {
    return { success: false, error: 'Unauthorized', data: [] };
  }

  let query = supabase.from('client_products').select(
    `
      *,
      profiles:client_id (
        id,
        company_name,
        email,
        fda_registration_number,
        industry,
        industries
      )
    `,
    { count: 'exact' }
  );

  if (filters.category) {
    query = query.eq('category', filters.category);
  }

  if (filters.subcategory) {
    query = query.eq('subcategory', filters.subcategory);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  } else {
    // Default: show active only
    query = query.eq('status', 'active');
  }

  if (filters.min_capacity) {
    query = query.gte('monthly_capacity_units', filters.min_capacity);
  }

  if (filters.min_price) {
    query = query.gte('max_unit_price', filters.min_price);
  }

  if (filters.max_price) {
    query = query.lte('min_unit_price', filters.max_price);
  }

  if (filters.search) {
    query = query.or(
      `product_name.ilike.%${filters.search}%,product_code.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
    );
  }

  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('[v0] searchClientProductsAction error:', error);
    return { success: false, error: error.message, data: [], count: 0 };
  }

  return { success: true, data: data || [], count: count || 0 };
}
