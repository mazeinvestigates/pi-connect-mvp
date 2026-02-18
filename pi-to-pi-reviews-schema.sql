-- Add review_type column to reviews table to distinguish client vs PI reviews
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS review_type VARCHAR(20) DEFAULT 'client' CHECK (review_type IN ('client', 'professional'));

-- Add professional rating fields (optional - can use same rating field)
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS professionalism_rating INTEGER CHECK (professionalism_rating >= 1 AND professionalism_rating <= 5);
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5);
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS expertise_rating INTEGER CHECK (expertise_rating >= 1 AND expertise_rating <= 5);

-- Add referral_id to link professional reviews to referrals
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS referral_id UUID REFERENCES job_referrals(id);

-- Update the unique constraint to allow multiple review types
-- Drop old constraint if it exists
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_pi_profile_id_reviewer_id_key;

-- Add new constraint that allows one review per type
ALTER TABLE reviews ADD CONSTRAINT reviews_unique_per_type 
  UNIQUE (pi_profile_id, reviewer_id, review_type);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_reviews_type ON reviews(review_type);
CREATE INDEX IF NOT EXISTS idx_reviews_referral ON reviews(referral_id);

-- Update trigger to calculate separate averages for client and professional reviews
-- This will keep the existing client rating in the main rating field
CREATE OR REPLACE FUNCTION update_pi_rating()
RETURNS TRIGGER AS $$
BEGIN
  -- Update client rating (existing behavior)
  UPDATE pi_profiles
  SET 
    rating = (
      SELECT COALESCE(AVG(rating), 0)
      FROM reviews
      WHERE pi_profile_id = NEW.pi_profile_id 
        AND review_type = 'client'
    ),
    review_count = (
      SELECT COUNT(*)
      FROM reviews
      WHERE pi_profile_id = NEW.pi_profile_id 
        AND review_type = 'client'
    ),
    updated_at = NOW()
  WHERE id = NEW.pi_profile_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add professional review count column
ALTER TABLE pi_profiles ADD COLUMN IF NOT EXISTS professional_review_count INTEGER DEFAULT 0;
ALTER TABLE pi_profiles ADD COLUMN IF NOT EXISTS professional_rating DECIMAL(3,2) DEFAULT 0;

-- Create separate trigger for professional reviews
CREATE OR REPLACE FUNCTION update_pi_professional_rating()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.review_type = 'professional' THEN
    UPDATE pi_profiles
    SET 
      professional_rating = (
        SELECT COALESCE(AVG(rating), 0)
        FROM reviews
        WHERE pi_profile_id = NEW.pi_profile_id 
          AND review_type = 'professional'
      ),
      professional_review_count = (
        SELECT COUNT(*)
        FROM reviews
        WHERE pi_profile_id = NEW.pi_profile_id 
          AND review_type = 'professional'
      ),
      updated_at = NOW()
    WHERE id = NEW.pi_profile_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger and recreate with both functions
DROP TRIGGER IF EXISTS update_rating_on_review_insert ON reviews;

CREATE TRIGGER update_rating_on_review_insert
  AFTER INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_pi_rating();

CREATE TRIGGER update_professional_rating_on_review_insert
  AFTER INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_pi_professional_rating();
