-- Run in Supabase SQL editor (see app for client usage of these columns).

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS challenge_type text NOT NULL DEFAULT '75hard';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS challenge_completed_at date;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS is_recovery_day boolean NOT NULL DEFAULT false;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS challenge_type text NOT NULL DEFAULT '75hard';

-- Exact one-liner form (if columns are new and empty DB):
-- ALTER TABLE user_profiles ADD COLUMN challenge_type text NOT NULL DEFAULT '75hard';
-- ALTER TABLE user_profiles ADD COLUMN challenge_completed_at date;
-- ALTER TABLE daily_logs ADD COLUMN is_recovery_day boolean NOT NULL DEFAULT false;
-- ALTER TABLE attempts ADD COLUMN challenge_type text NOT NULL DEFAULT '75hard';
