-- Fix infinite recursion in profiles RLS policies
-- Problem: Policy "Admins can view all profiles" queries profiles table inside the policy,
-- which triggers the same policy again -> infinite recursion.
-- Solution: Use a SECURITY DEFINER function that bypasses RLS to check the role.

-- 1) Helper function to get current user role (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Allow authenticated users to call it
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;

-- 2) Drop ALL existing policies on profiles to start clean
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles;', r.policyname);
  END LOOP;
END$$;

-- 3) Recreate safe policies (no self-reference)

-- Everyone authenticated can read their own profile
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Admins can view all profiles (uses SECURITY DEFINER function, no recursion)
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.get_current_user_role() = 'admin');

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Admins can update any profile
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.get_current_user_role() = 'admin');

-- Admins can insert profiles (used when creating new client accounts)
CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (public.get_current_user_role() = 'admin');

-- Users can insert their own profile (used on signup)
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
