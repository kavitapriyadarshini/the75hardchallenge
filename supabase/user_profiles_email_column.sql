-- Real-email auth: store sign-in email on user_profiles.
-- Run in Supabase SQL editor (or migrate) after deploying app changes.

ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS email text;

-- Legacy rows used `username` as a display handle; if it looks like an email, copy it.
UPDATE public.user_profiles
SET email = username
WHERE email IS NULL AND username IS NOT NULL AND username LIKE '%@%';

-- If `username` was NOT NULL, new signups only send `email` — allow null username.
ALTER TABLE public.user_profiles ALTER COLUMN username DROP NOT NULL;
