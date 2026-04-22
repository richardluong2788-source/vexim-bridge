-- =====================================================================
-- Fix RLS policies so super_admin (and staff) have the same visibility
-- as admin where intended.
--
-- Problem found on 2026-04-22: the admin portal's /admin/clients page
-- returned an empty list for super_admin users. The underlying policies
-- on public.profiles (and a couple of others) hard-coded role = 'admin'
-- only, so super_admin accounts failed the USING clause and saw zero
-- rows — even though the data was there.
--
-- This migration rewrites the affected policies to use the same role
-- allowlist (admin, staff, super_admin) that the rest of the codebase
-- already uses.
-- =====================================================================

-- -----------------------
-- public.profiles
-- -----------------------
drop policy if exists "Admins can view all profiles"   on public.profiles;
drop policy if exists "Admins can update all profiles" on public.profiles;
drop policy if exists "Admins can insert profiles"     on public.profiles;

create policy "Admins can view all profiles"
  on public.profiles
  for select
  using (
    public.get_current_user_role() = any (array['admin','staff','super_admin'])
  );

create policy "Admins can update all profiles"
  on public.profiles
  for update
  using (
    public.get_current_user_role() = any (array['admin','staff','super_admin'])
  )
  with check (
    public.get_current_user_role() = any (array['admin','staff','super_admin'])
  );

create policy "Admins can insert profiles"
  on public.profiles
  for insert
  with check (
    public.get_current_user_role() = any (array['admin','staff','super_admin'])
  );

-- -----------------------
-- public.leads
-- -----------------------
drop policy if exists "Admins can manage all leads" on public.leads;

create policy "Admins can manage all leads"
  on public.leads
  for all
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = any (array['admin','staff','super_admin','lead_researcher','account_executive'])
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = any (array['admin','staff','super_admin','lead_researcher','account_executive'])
    )
  );

-- -----------------------
-- public.opportunities
-- -----------------------
drop policy if exists "Admins can manage all opportunities" on public.opportunities;

create policy "Admins can manage all opportunities"
  on public.opportunities
  for all
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = any (array['admin','staff','super_admin','account_executive'])
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = any (array['admin','staff','super_admin','account_executive'])
    )
  );
