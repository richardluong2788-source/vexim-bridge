-- ============================================================
-- ESH (Export Sales Hub) - Database Schema
-- Migration 001: Create all tables, RLS policies, and triggers
-- ============================================================
-- FIX: Tables are created FIRST (in dependency order), then all
-- RLS policies are added. This avoids forward-reference errors
-- like: leads.policy references opportunities before it exists.
-- ============================================================


-- ============================================================
-- STEP 1: CREATE ALL TABLES (in dependency order)
-- ============================================================

-- TABLE: profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE,
  full_name TEXT,
  role TEXT CHECK (role IN ('admin', 'staff', 'client')) NOT NULL DEFAULT 'client',
  company_name TEXT,
  industry TEXT,
  fda_registration_number TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TABLE: leads
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  linkedin_url TEXT,
  industry TEXT,
  website TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TABLE: opportunities
CREATE TABLE IF NOT EXISTS public.opportunities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.profiles(id) NOT NULL,
  lead_id UUID REFERENCES public.leads(id) NOT NULL,
  stage TEXT CHECK (stage IN ('new', 'contacted', 'quoted', 'won', 'lost')) NOT NULL DEFAULT 'new',
  potential_value DECIMAL(15, 2),
  notes TEXT,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(client_id, lead_id)
);

-- TABLE: activities
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  description TEXT,
  performed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================================
-- STEP 2: ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities    ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- STEP 3: CREATE RLS POLICIES
-- ============================================================

-- --- PROFILES policies ---
DROP POLICY IF EXISTS "Admins can view all profiles"   ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile"     ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile"   ON public.profiles;
DROP POLICY IF EXISTS "Service role can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Service role can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'staff')
    )
  );

-- --- LEADS policies ---
DROP POLICY IF EXISTS "Admins can manage all leads"         ON public.leads;
DROP POLICY IF EXISTS "Clients can view their assigned leads" ON public.leads;

CREATE POLICY "Admins can manage all leads"
  ON public.leads FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'staff')
    )
  );

-- This policy references opportunities — opportunities now exists.
CREATE POLICY "Clients can view their assigned leads"
  ON public.leads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.lead_id = leads.id AND o.client_id = auth.uid()
    )
  );

-- --- OPPORTUNITIES policies ---
DROP POLICY IF EXISTS "Admins can manage all opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Clients can view own opportunities"  ON public.opportunities;

CREATE POLICY "Admins can manage all opportunities"
  ON public.opportunities FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Clients can view own opportunities"
  ON public.opportunities FOR SELECT
  USING (auth.uid() = client_id);

-- --- ACTIVITIES policies ---
DROP POLICY IF EXISTS "Admins can manage all activities" ON public.activities;
DROP POLICY IF EXISTS "Clients can view own activities"  ON public.activities;

CREATE POLICY "Admins can manage all activities"
  ON public.activities FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Clients can view own activities"
  ON public.activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = activities.opportunity_id AND o.client_id = auth.uid()
    )
  );


-- ============================================================
-- STEP 4: TRIGGERS
-- ============================================================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'client')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update last_updated on opportunities change
CREATE OR REPLACE FUNCTION public.handle_opportunity_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_opportunity_updated ON public.opportunities;
CREATE TRIGGER on_opportunity_updated
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.handle_opportunity_updated();


-- ============================================================
-- NOTE: After running this migration, promote an admin via:
--   UPDATE public.profiles SET role = 'admin' WHERE email = 'admin@esh.com';
-- ============================================================
