'use server';

/**
 * Server actions for managing the product category lookup table.
 *
 * Backs the Category dropdown in the Add/Edit Product dialog. Reads are
 * available to any authenticated user (clients see the same options on
 * their own product list); writes are restricted to admin/super_admin/staff.
 */

import { createClient } from '@/lib/supabase/server';

export interface ProductCategory {
  id: string;
  value: string;
  label_vi: string;
  label_en: string | null;
  display_order: number;
  is_active: boolean;
}

/**
 * Returns active categories ordered by display_order, then Vietnamese label.
 * Also returns `canAdd` so the UI can decide whether to show the "+" button
 * without making a second round-trip.
 */
export async function listProductCategoriesAction(): Promise<{
  success: boolean;
  data: ProductCategory[];
  canAdd: boolean;
  error?: string;
}> {
  const supabase = await createClient();

  // Determine whether the current user can manage categories.
  let canAdd = false;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    canAdd =
      profile?.role === 'admin' ||
      profile?.role === 'super_admin' ||
      profile?.role === 'staff';
  }

  const { data, error } = await supabase
    .from('product_categories')
    .select('id, value, label_vi, label_en, display_order, is_active')
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('label_vi', { ascending: true });

  if (error) {
    console.error('[v0] listProductCategoriesAction error:', error);
    return { success: false, data: [], canAdd, error: error.message };
  }

  return { success: true, data: (data as ProductCategory[]) ?? [], canAdd };
}

/**
 * Adds a new product category. Only admin/super_admin/staff allowed.
 *
 * - `value` is normalized (trimmed, collapsed whitespace) and must be unique.
 *   We accept whatever the admin types — typically a short English token —
 *   so we don't try to auto-translate.
 * - `label_vi` is required (this is what users actually see).
 * - If the user provides a Vietnamese label only, we still need *some* value
 *   to store on `client_products.category`; in that case fall back to the
 *   Vietnamese label (DB unique constraint will catch duplicates).
 */
export async function addProductCategoryAction(input: {
  value?: string;
  label_vi: string;
  label_en?: string;
}): Promise<{ success: boolean; data?: ProductCategory; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const isAdmin =
    profile?.role === 'admin' ||
    profile?.role === 'super_admin' ||
    profile?.role === 'staff';

  if (!isAdmin) {
    return { success: false, error: 'Unauthorized' };
  }

  const labelVi = input.label_vi?.trim();
  if (!labelVi) {
    return { success: false, error: 'Vietnamese label is required' };
  }

  // Normalize: strip extra whitespace; if no explicit value, use label_vi.
  const value = (input.value?.trim() || labelVi).replace(/\s+/g, ' ');
  const labelEn = input.label_en?.trim() || null;

  // Check for duplicate value (case-insensitive) up-front for a nicer error.
  const { data: existing } = await supabase
    .from('product_categories')
    .select('id, is_active')
    .ilike('value', value)
    .maybeSingle();

  if (existing) {
    // If the admin re-adds an inactive one, just re-activate it.
    if (!existing.is_active) {
      const { data: reactivated, error: reErr } = await supabase
        .from('product_categories')
        .update({ is_active: true, label_vi: labelVi, label_en: labelEn })
        .eq('id', existing.id)
        .select('id, value, label_vi, label_en, display_order, is_active')
        .single();
      if (reErr) {
        console.error('[v0] reactivate category error:', reErr);
        return { success: false, error: reErr.message };
      }
      return { success: true, data: reactivated as ProductCategory };
    }
    return { success: false, error: 'Danh mục này đã tồn tại' };
  }

  // Append at the end of the list (just before "Other" if present).
  const { data: maxRow } = await supabase
    .from('product_categories')
    .select('display_order')
    .lt('display_order', 9000)
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (maxRow?.display_order ?? 0) + 10;

  const { data: created, error } = await supabase
    .from('product_categories')
    .insert({
      value,
      label_vi: labelVi,
      label_en: labelEn,
      display_order: nextOrder,
      is_active: true,
      created_by: user.id,
    })
    .select('id, value, label_vi, label_en, display_order, is_active')
    .single();

  if (error) {
    console.error('[v0] addProductCategoryAction error:', error);
    return { success: false, error: error.message };
  }

  return { success: true, data: created as ProductCategory };
}
