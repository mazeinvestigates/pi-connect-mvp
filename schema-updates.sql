-- ================================================================
-- SCHEMA UPDATES FOR FULL FEATURE SET
-- ================================================================
-- Run this AFTER the initial schema to add all new tables

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their messages" ON messages 
  FOR SELECT USING (
    sender_id = auth.uid() OR
    conversation_id IN (
      SELECT id FROM conversations 
      WHERE participant_1 = auth.uid() OR participant_2 = auth.uid()
    )
  );

CREATE POLICY "Users can send messages" ON messages 
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_2 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(participant_1, participant_2)
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their conversations" ON conversations 
  FOR SELECT USING (
    participant_1 = auth.uid() OR participant_2 = auth.uid()
  );

CREATE POLICY "Users can create conversations" ON conversations 
  FOR INSERT WITH CHECK (
    participant_1 = auth.uid() OR participant_2 = auth.uid()
  );

-- Jobs table (for job postings)
CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  posted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  location text NOT NULL,
  city text,
  state text,
  investigation_type text NOT NULL,
  budget_min decimal(10,2),
  budget_max decimal(10,2),
  urgency text DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'urgent')),
  required_specialties text[],
  status text DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
  deadline date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view open jobs" ON jobs 
  FOR SELECT USING (status = 'open' OR posted_by = auth.uid());

CREATE POLICY "Users can post jobs" ON jobs 
  FOR INSERT WITH CHECK (auth.uid() = posted_by);

CREATE POLICY "Job owners can update" ON jobs 
  FOR UPDATE USING (auth.uid() = posted_by);

-- Job applications
CREATE TABLE IF NOT EXISTS job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  applicant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cover_letter text,
  proposed_rate decimal(10,2),
  estimated_timeline text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  applied_at timestamptz DEFAULT now(),
  responded_at timestamptz,
  UNIQUE(job_id, applicant_id)
);

ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Applicants and job owners view applications" ON job_applications 
  FOR SELECT USING (
    applicant_id = auth.uid() OR 
    job_id IN (SELECT id FROM jobs WHERE posted_by = auth.uid())
  );

CREATE POLICY "PIs can apply to jobs" ON job_applications 
  FOR INSERT WITH CHECK (auth.uid() = applicant_id);

CREATE POLICY "Applicants can update own applications" ON job_applications 
  FOR UPDATE USING (auth.uid() = applicant_id);

-- Job referrals (PI to PI)
CREATE TABLE IF NOT EXISTS job_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  referred_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_to uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz DEFAULT now(),
  responded_at timestamptz,
  UNIQUE(job_id, referred_to)
);

ALTER TABLE job_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view referrals involving them" ON job_referrals 
  FOR SELECT USING (
    referred_by = auth.uid() OR 
    referred_to = auth.uid() OR
    job_id IN (SELECT id FROM jobs WHERE posted_by = auth.uid())
  );

CREATE POLICY "Users can create referrals" ON job_referrals 
  FOR INSERT WITH CHECK (auth.uid() = referred_by);

CREATE POLICY "Referred users can respond" ON job_referrals 
  FOR UPDATE USING (auth.uid() = referred_to);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL,
  related_id uuid,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications" ON notifications 
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can mark notifications read" ON notifications 
  FOR UPDATE USING (user_id = auth.uid());

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pi_profile_id uuid NOT NULL REFERENCES pi_profiles(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rating decimal(2,1) NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text text,
  case_type text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reviews" ON reviews 
  FOR SELECT USING (true);

CREATE POLICY "Users can create reviews" ON reviews 
  FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

-- Function to update PI rating when review is added
CREATE OR REPLACE FUNCTION update_pi_rating()
RETURNS trigger AS $$
BEGIN
  UPDATE pi_profiles
  SET 
    rating = (
      SELECT AVG(rating)
      FROM reviews
      WHERE pi_profile_id = NEW.pi_profile_id
    ),
    review_count = (
      SELECT COUNT(*)
      FROM reviews
      WHERE pi_profile_id = NEW.pi_profile_id
    )
  WHERE id = NEW.pi_profile_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_review_created
  AFTER INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_pi_rating();

-- Function to update conversation last_message_at
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS trigger AS $$
BEGIN
  UPDATE conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_message_sent
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_timestamp();

-- Add admin role to profiles if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE profiles ADD COLUMN role text DEFAULT 'client' CHECK (role IN ('client', 'admin'));
  END IF;
END $$;

