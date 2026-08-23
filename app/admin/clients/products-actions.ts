'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { can, CAPS, normaliseRole } from '@/lib/auth/permissions';
import { ownershipScopeFor, assertClientOwned } from '@/lib/auth/scope';
import { redirect } from 'next/navigation';

type AdminSB = ReturnType<typeof createAdminClient>;

/**
 * Resolve the current authenticated user + their normalised role, using the
 * service-role client for the profile lookup (avoids RLS recursion on
 * `profiles`, same pattern as lib/auth/guard.ts).
 */
async function resolveActor(): Promise<
  | { ok: true; userId: string; role: ReturnType<typeof normaliseRole>; admin: AdminSB }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, error: 'Not authenticated' };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = normaliseRole(profile?.role ?? null);

  return { ok: true, userId: user.id, role, admin };
}

/**
 * Verify the caller may write products for `clientId`.
 * - The client themselves (self-service portal) may always write their own products.
 * - Staff roles need CAPS.CLIENT_WRITE (super_admin, admin, account_executive) AND,
 *   unless they have OWNERSHIP_BYPASS, must own the client
 *   (profiles.account_manager_id === userId) — see lib/auth/scope.ts.
 */
async function assertProductWriteAccess(
  admin: AdminSB,
  userId: string,
  role: ReturnType<typeof normaliseRole>,
  clientId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (userId === clientId) {
    return { ok: true };
  }

  if (!role || !can(role, CAPS.CLIENT_WRITE)) {
    return { ok: false, error: 'Unauthorized' };
  }

  const scope = ownershipScopeFor(role, userId);
  const owned = await assertClientOwned(scope, admin, clientId);
  if (!owned.ok) {
    return { ok: false, error: 'Unauthorized' };
  }

  return { ok: true };
}

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
  image_urls: string[];
  compliance_badges: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
  country_of_origin: string | null;
  key_specifications: string | null;
  usp: string | null;
  moq_value: number | null;
  moq_unit: string | null;
  lead_time: string | null;
  sample_available: boolean;
  sample_notes: string | null;
  price_unit: string | null;
  incoterm: string | null;
  incoterm_place: string | null;
  payment_terms: string | null;
  packing: string | null;
  package_size: string | null;
  shelf_life: string | null;
  storage_conditions: string | null;
  private_label_available: boolean;
  private_label_notes: string | null;
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
    min_unit_price?: number | null;
    max_unit_price?: number | null;
    currency?: string;
    monthly_capacity_units?: number | null;
    status?: 'active' | 'inactive' | 'suspended';
    image_urls?: string[];
    compliance_badges?: string[];
    country_of_origin?: string;
    key_specifications?: string;
    usp?: string;
    moq_value?: number | null;
    moq_unit?: string;
    lead_time?: string;
    sample_available?: boolean;
    sample_notes?: string;
    price_unit?: string;
    incoterm?: string;
    incoterm_place?: string;
    payment_terms?: string;
    packing?: string;
    package_size?: string;
    shelf_life?: string;
    storage_conditions?: string;
    private_label_available?: boolean;
    private_label_notes?: string;
  }
) {
  const actor = await resolveActor();
  if (!actor.ok) {
    return { success: false, error: actor.error };
  }
  const { userId, role, admin } = actor;

  // Verify user has permission (is staff with CLIENT_WRITE + ownership, or the client themselves)
  const access = await assertProductWriteAccess(admin, userId, role, clientId);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  // Insert product
  const { data: product, error } = await admin
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
        image_urls: data.image_urls || [],
        compliance_badges: data.compliance_badges || [],
        country_of_origin: data.country_of_origin || null,
        key_specifications: data.key_specifications || null,
        usp: data.usp || null,
        moq_value: data.moq_value || null,
        moq_unit: data.moq_unit || null,
        lead_time: data.lead_time || null,
        sample_available: data.sample_available ?? false,
        sample_notes: data.sample_notes || null,
        price_unit: data.price_unit || null,
        incoterm: data.incoterm || null,
        incoterm_place: data.incoterm_place || null,
        payment_terms: data.payment_terms || null,
        packing: data.packing || null,
        package_size: data.package_size || null,
        shelf_life: data.shelf_life || null,
        storage_conditions: data.storage_conditions || null,
        private_label_available: data.private_label_available ?? false,
        private_label_notes: data.private_label_notes || null,
        created_by: userId,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('[v0] addClientProductAction error:', error);
    return { success: false, error: error.message };
  }

  // Log activity
  await admin.from('activities').insert([
    {
      action_type: 'client_product_added',
      description: `Product "${data.product_name}" added to client ${clientId}`,
      performed_by: userId,
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
    min_unit_price: number | null;
    max_unit_price: number | null;
    currency: string;
    monthly_capacity_units: number | null;
    status: 'active' | 'inactive' | 'suspended';
    image_urls: string[];
    compliance_badges: string[];
    country_of_origin: string;
    key_specifications: string;
    usp: string;
    moq_value: number | null;
    moq_unit: string;
    lead_time: string;
    sample_available: boolean;
    sample_notes: string;
    price_unit: string;
    incoterm: string;
    incoterm_place: string;
    payment_terms: string;
    packing: string;
    package_size: string;
    shelf_life: string;
    storage_conditions: string;
    private_label_available: boolean;
    private_label_notes: string;
  }>
  ) {
  const actor = await resolveActor();
  if (!actor.ok) {
    return { success: false, error: actor.error };
  }
  const { userId, role, admin } = actor;

  // Get product to check permissions
  const { data: product } = await admin
    .from('client_products')
    .select('client_id')
    .eq('id', productId)
    .single();

  if (!product) {
    return { success: false, error: 'Product not found' };
  }

  // Verify user has permission (is staff with CLIENT_WRITE + ownership, or the client themselves)
  const access = await assertProductWriteAccess(admin, userId, role, product.client_id);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  // Update product
  const { data: updated, error } = await admin
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
  await admin.from('activities').insert([
  {
  action_type: 'client_product_updated',
  description: `Product "${data.product_name || 'Unknown'}" updated`,
  performed_by: userId,
  },
  ]);
  
  return { success: true, data: updated };
  }
  
  // Delete a client product
  export async function deleteClientProductAction(productId: string) {
  const actor = await resolveActor();
  if (!actor.ok) {
    return { success: false, error: actor.error };
  }
  const { userId, role, admin } = actor;
  
  // Get product to check permissions
  const { data: product } = await admin
  .from('client_products')
  .select('client_id, product_name')
  .eq('id', productId)
  .single();
  
  if (!product) {
  return { success: false, error: 'Product not found' };
  }
  
  // Verify user has permission (is staff with CLIENT_WRITE + ownership, or the client themselves)
  const access = await assertProductWriteAccess(admin, userId, role, product.client_id);
  if (!access.ok) {
  return { success: false, error: access.error };
  }
  
  // Delete product
  const { error } = await admin.from('client_products').delete().eq('id', productId);
  
  if (error) {
  console.error('[v0] deleteClientProductAction error:', error);
  return { success: false, error: error.message };
  }
  
  // Log activity
  await admin.from('activities').insert([
  {
  action_type: 'client_product_deleted',
  description: `Product "${product.product_name}" deleted`,
  performed_by: userId,
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
  const actor = await resolveActor();
  if (!actor.ok) {
    return { success: false, error: actor.error, data: [] };
  }
  const { userId, role, admin } = actor;

  // The client may always list their own products; staff need CLIENT_VIEW
  // and, unless they have OWNERSHIP_BYPASS, must own the client.
  if (userId !== clientId) {
    if (!role || !can(role, CAPS.CLIENT_VIEW)) {
      return { success: false, error: 'Unauthorized', data: [] };
    }
    const scope = ownershipScopeFor(role, userId);
    const owned = await assertClientOwned(scope, admin, clientId);
    if (!owned.ok) {
      return { success: false, error: 'Unauthorized', data: [] };
    }
  }

  let query = admin
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
  const actor = await resolveActor();
  if (!actor.ok) {
    return { success: false, error: actor.error, data: [] };
  }
  const { role, admin } = actor;

  // Verify user has read access to client product data.
  if (!role || !can(role, CAPS.CLIENT_VIEW)) {
  return { success: false, error: 'Unauthorized', data: [] };
  }
  
  let query = admin.from('client_products').select(
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
