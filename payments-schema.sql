-- Payments and Transactions Schema

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Parties involved
  client_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  pi_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  
  -- Related entities
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  application_id UUID REFERENCES job_applications(id) ON DELETE SET NULL,
  
  -- Payment details
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  platform_fee_cents INTEGER NOT NULL DEFAULT 0,
  pi_payout_cents INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  
  -- Stripe IDs
  stripe_payment_intent_id VARCHAR(255),
  stripe_charge_id VARCHAR(255),
  stripe_transfer_id VARCHAR(255),
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
    'pending',
    'processing',
    'succeeded',
    'failed',
    'refunded',
    'partially_refunded',
    'disputed'
  )),
  
  -- Payment metadata
  payment_method VARCHAR(50),
  description TEXT,
  receipt_url TEXT,
  failure_reason TEXT,
  
  -- Timestamps
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_transactions_client ON transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_transactions_pi ON transactions(pi_id);
CREATE INDEX IF NOT EXISTS idx_transactions_job ON transactions(job_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at DESC);

-- Enable RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own transactions
CREATE POLICY transactions_view_own ON transactions
  FOR SELECT
  USING (
    auth.uid() = client_id 
    OR auth.uid() = pi_id
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
        AND profiles.role = 'admin'
    )
  );

-- Policy: Only system can insert (via backend function)
-- In production, you'd have a service role for this
CREATE POLICY transactions_insert_system ON transactions
  FOR INSERT
  WITH CHECK (true); -- Will be restricted by backend API

-- Policy: Only admins can update
CREATE POLICY transactions_update_admin ON transactions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
        AND profiles.role = 'admin'
    )
  );

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_transactions_updated_at();

-- Add payment_status to job_applications
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'refunded'));
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS payment_required BOOLEAN DEFAULT true;
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS agreed_amount_cents INTEGER;

-- Create index
CREATE INDEX IF NOT EXISTS idx_applications_payment ON job_applications(payment_status);

-- Add paid flag to jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payment_required BOOLEAN DEFAULT true;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS budget_min_cents INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS budget_max_cents INTEGER;

-- Function to calculate platform fee (15% default)
CREATE OR REPLACE FUNCTION calculate_platform_fee(amount_cents INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN FLOOR(amount_cents * 0.15); -- 15% platform fee
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate PI payout
CREATE OR REPLACE FUNCTION calculate_pi_payout(amount_cents INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN amount_cents - calculate_platform_fee(amount_cents);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON TABLE transactions IS 'All payment transactions processed through the platform';
COMMENT ON COLUMN transactions.amount_cents IS 'Total amount paid by client in cents';
COMMENT ON COLUMN transactions.platform_fee_cents IS 'Platform fee (typically 15% of amount)';
COMMENT ON COLUMN transactions.pi_payout_cents IS 'Amount paid out to PI after platform fee';
