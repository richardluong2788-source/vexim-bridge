-- Migration 028: Product Categories
-- Move the previously hard-coded product category list into a real table so
-- super_admin / admin can extend it from the UI without a code deploy.
--
-- Design notes:
--   * `value`     = canonical English token stored on client_products.category
--                   (e.g. "Coffee"). Kept stable so existing rows keep working.
--   * `label_vi`  = Vietnamese display label shown in dropdowns.
--   * `label_en`  = optional English label for future i18n.
--   * `display_order` lets admins reorder.
--   * `is_active = false` hides a category without breaking historical products
--     that already reference its `value`.

create table if not exists public.product_categories (
  id            uuid primary key default gen_random_uuid(),
  value         text not null unique,
  label_vi      text not null,
  label_en      text,
  display_order int  not null default 0,
  is_active     boolean not null default true,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists product_categories_active_order_idx
  on public.product_categories (is_active, display_order, label_vi);

-- Seed the 10 categories that were previously hard-coded in the dialog.
-- ON CONFLICT keeps this idempotent if re-run.
insert into public.product_categories (value, label_vi, label_en, display_order)
values
  ('Coffee',        'Cà phê',         'Coffee',        10),
  ('Cocoa',         'Ca cao',         'Cocoa',         20),
  ('Pepper',        'Hồ tiêu',        'Pepper',        30),
  ('Cashew',        'Hạt điều',       'Cashew',        40),
  ('Spices',        'Gia vị',         'Spices',        50),
  ('Nuts',          'Các loại hạt',   'Nuts',          60),
  ('Dried Fruits',  'Trái cây sấy',   'Dried Fruits',  70),
  ('Grains',        'Ngũ cốc',        'Grains',        80),
  ('Oils',          'Dầu',            'Oils',          90),
  ('Other',         'Khác',           'Other',         9999)
on conflict (value) do nothing;

-- Row-Level Security
alter table public.product_categories enable row level security;

-- Anyone authenticated can read active categories (clients need them on
-- their own product pages too).
drop policy if exists "Authenticated can read product_categories"
  on public.product_categories;
create policy "Authenticated can read product_categories"
  on public.product_categories
  for select
  to authenticated
  using (true);

-- Only admin / super_admin / staff can insert / update / delete.
drop policy if exists "Admins manage product_categories"
  on public.product_categories;
create policy "Admins manage product_categories"
  on public.product_categories
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'super_admin', 'staff')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'super_admin', 'staff')
    )
  );

-- Touch updated_at on update.
create or replace function public.product_categories_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists product_categories_set_updated_at on public.product_categories;
create trigger product_categories_set_updated_at
  before update on public.product_categories
  for each row execute function public.product_categories_set_updated_at();
