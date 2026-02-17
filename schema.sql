-- =================================================================
-- PI CONNECT MVP - MINIMAL SCHEMA
-- =================================================================
-- This is a simplified, clean schema for the core MVP functionality
-- Tables: profiles, pi_profiles, consultation_requests

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =================================================================
-- PROFILES TABLE (Basic user info for all users)
-- =================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Anyone can view profiles" 
  ON public.profiles FOR SELECT 
  USING (true);

CREATE POLICY "Users can insert their own profile" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = user_id);

-- =================================================================
-- PI_PROFILES TABLE (Extended info for Private Investigators)
-- =================================================================
CREATE TABLE IF NOT EXISTS public.pi_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic Info
  first_name TEXT,
  last_name TEXT,
  company_name TEXT,
  bio TEXT,
  profile_photo_url TEXT,
  
  -- Location
  city TEXT,
  state TEXT,
  location TEXT, -- Combined "City, State" for display
  coverage_areas TEXT[], -- Array of cities/regions they serve
  
  -- Professional Details
  license_number TEXT,
  license_state TEXT,
  years_experience INTEGER DEFAULT 0,
  specialties TEXT[], -- Array like ['surveillance', 'background checks']
  languages TEXT[] DEFAULT ARRAY['English'],
  
  -- Contact & Availability
  phone TEXT,
  email TEXT,
  response_time TEXT DEFAULT 'Within 24 hours',
  accepts_remote_work BOOLEAN DEFAULT false,
  
  -- Ratings & Status
  is_verified BOOLEAN DEFAULT false,
  rating DECIMAL(3,2) DEFAULT 0.00,
  review_count INTEGER DEFAULT 0,
  subscription_status TEXT DEFAULT 'basic' CHECK (subscription_status IN ('basic', 'pro', 'elite')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pi_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pi_profiles
CREATE POLICY "Anyone can view verified PI profiles" 
  ON public.pi_profiles FOR SELECT 
  USING (is_verified = true);

CREATE POLICY "Users can view their own PI profile" 
  ON public.pi_profiles FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own PI profile" 
  ON public.pi_profiles FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own PI profile" 
  ON public.pi_profiles FOR UPDATE 
  USING (auth.uid() = user_id);

-- =================================================================
-- CONSULTATION_REQUESTS TABLE (When clients reach out to PIs)
-- =================================================================
CREATE TABLE IF NOT EXISTS public.consultation_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- PI being contacted
  pi_profile_id UUID NOT NULL REFERENCES public.pi_profiles(id) ON DELETE CASCADE,
  
  -- Requester info (may or may not be logged in)
  requester_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  requester_phone TEXT,
  organization TEXT,
  
  -- Request details
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  budget_min DECIMAL(10,2),
  budget_max DECIMAL(10,2),
  accepts_remote BOOLEAN DEFAULT false,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'accepted', 'declined', 'closed')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.consultation_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for consultation_requests
CREATE POLICY "PIs can view their consultation requests" 
  ON public.consultation_requests FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.pi_profiles 
      WHERE pi_profiles.id = consultation_requests.pi_profile_id 
      AND pi_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Requesters can view their own requests" 
  ON public.consultation_requests FOR SELECT 
  USING (auth.uid() = requester_user_id);

CREATE POLICY "Anyone can create consultation requests" 
  ON public.consultation_requests FOR INSERT 
  WITH CHECK (true);

-- =================================================================
-- HELPER FUNCTIONS
-- =================================================================

-- Function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile automatically
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for timestamp updates
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_pi_profiles_updated_at ON public.pi_profiles;
CREATE TRIGGER update_pi_profiles_updated_at
  BEFORE UPDATE ON public.pi_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =================================================================
-- SAMPLE DATA (Optional - for testing)
-- =================================================================

-- Note: You'll need real user IDs from auth.users to insert PI profiles
-- This is just a template showing the structure

/*
INSERT INTO public.pi_profiles (
  user_id,
  first_name,
  last_name,
  company_name,
  bio,
  city,
  state,
  location,
  license_number,
  license_state,
  years_experience,
  specialties,
  languages,
  phone,
  email,
  is_verified,
  rating,
  review_count,
  subscription_status
) VALUES (
  'YOUR_USER_ID_HERE',
  'John',
  'Smith',
  'Smith Investigations',
  'Experienced private investigator specializing in surveillance and background checks.',
  'Miami',
  'FL',
  'Miami, FL',
  'A-1234567',
  'FL',
  15,
  ARRAY['surveillance', 'background investigation', 'fraud investigation'],
  ARRAY['English', 'Spanish'],
  '555-0123',
  'john@smithinvestigations.com',
  true,
  4.8,
  24,
  'pro'
);
*/
