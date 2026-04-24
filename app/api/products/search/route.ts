import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const subcategory = searchParams.get('subcategory');
    const minCapacity = searchParams.get('min_capacity');
    const minPrice = searchParams.get('min_price');
    const maxPrice = searchParams.get('max_price');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('client_products')
      .select(
        `
        id,
        product_name,
        category,
        subcategory,
        unit_of_measure,
        min_unit_price,
        max_unit_price,
        currency,
        monthly_capacity_units,
        client_id,
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
      )
      .eq('status', 'active'); // Only show active products publicly

    if (category) {
      query = query.eq('category', category);
    }

    if (subcategory) {
      query = query.eq('subcategory', subcategory);
    }

    if (minCapacity) {
      query = query.gte('monthly_capacity_units', parseInt(minCapacity));
    }

    if (minPrice) {
      query = query.gte('max_unit_price', parseFloat(minPrice));
    }

    if (maxPrice) {
      query = query.lte('min_unit_price', parseFloat(maxPrice));
    }

    if (search) {
      query = query.or(
        `product_name.ilike.%${search}%,product_code.ilike.%${search}%,description.ilike.%${search}%`
      );
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('[v0] Products search error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      count: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[v0] Products API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
