-- Run before relying on Dashboard "missed unlogged days" modal (requires onboarding_complete = true).
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false;

-- Existing profiles that already have a start date or body stats should see the missed-day flow.
UPDATE user_profiles
SET onboarding_complete = true
WHERE start_date IS NOT NULL OR weight_kg IS NOT NULL;
