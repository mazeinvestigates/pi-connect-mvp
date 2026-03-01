-- Email Notifications Schema

-- Add email preferences to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_preferences JSONB DEFAULT '{
  "new_messages": true,
  "new_jobs": true,
  "job_applications": true,
  "payment_confirmations": true,
  "reviews": true,
  "consultation_requests": true,
  "referrals": true,
  "admin_actions": true,
  "daily_digest": false,
  "marketing_emails": true
}'::jsonb;

-- Create email_queue table for tracking sent emails
CREATE TABLE IF NOT EXISTS email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  email_type VARCHAR(50) NOT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body_html TEXT,
  body_text TEXT,
  
  -- Metadata
  related_id UUID, -- ID of related entity (job, message, etc)
  related_type VARCHAR(50), -- Type of related entity
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_email_queue_user ON email_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_created ON email_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_queue_type ON email_queue(email_type);

-- Enable RLS
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own email queue
CREATE POLICY email_queue_view_own ON email_queue
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Only admins can view all emails
CREATE POLICY email_queue_admin_view ON email_queue
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
        AND profiles.role = 'admin'
    )
  );

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_email_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_queue_updated_at
  BEFORE UPDATE ON email_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_email_queue_updated_at();

-- Function to queue an email
CREATE OR REPLACE FUNCTION queue_email(
  p_user_id UUID,
  p_email_type VARCHAR,
  p_recipient_email VARCHAR,
  p_subject VARCHAR,
  p_body_html TEXT,
  p_body_text TEXT DEFAULT NULL,
  p_related_id UUID DEFAULT NULL,
  p_related_type VARCHAR DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_email_id UUID;
  v_preferences JSONB;
  v_pref_key TEXT;
BEGIN
  -- Get user's email preferences
  SELECT email_preferences INTO v_preferences
  FROM profiles
  WHERE user_id = p_user_id;
  
  -- Map email type to preference key
  v_pref_key := CASE p_email_type
    WHEN 'new_message' THEN 'new_messages'
    WHEN 'new_job' THEN 'new_jobs'
    WHEN 'job_application' THEN 'job_applications'
    WHEN 'payment_confirmation' THEN 'payment_confirmations'
    WHEN 'review_notification' THEN 'reviews'
    WHEN 'consultation_request' THEN 'consultation_requests'
    WHEN 'referral_notification' THEN 'referrals'
    WHEN 'admin_action' THEN 'admin_actions'
    ELSE 'marketing_emails'
  END;
  
  -- Check if user has this notification enabled
  IF v_preferences->v_pref_key = 'true' THEN
    INSERT INTO email_queue (
      user_id, 
      email_type, 
      recipient_email, 
      subject, 
      body_html, 
      body_text,
      related_id,
      related_type
    )
    VALUES (
      p_user_id, 
      p_email_type, 
      p_recipient_email, 
      p_subject, 
      p_body_html, 
      COALESCE(p_body_text, p_subject),
      p_related_id,
      p_related_type
    )
    RETURNING id INTO v_email_id;
    
    RETURN v_email_id;
  ELSE
    -- User has disabled this notification type
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE email_queue IS 'Queue of emails to be sent to users';
COMMENT ON FUNCTION queue_email IS 'Queue an email respecting user preferences';
