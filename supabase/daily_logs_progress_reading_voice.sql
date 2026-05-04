-- Run in Supabase SQL editor (or migration). Adds optional tracking columns on daily_logs.

alter table public.daily_logs
  add column if not exists progress_photo text null;

comment on column public.daily_logs.progress_photo is
  'Optional base64 data URL of progress photo for the day.';

alter table public.daily_logs
  add column if not exists reading_log jsonb null;

comment on column public.daily_logs.reading_log is
  'Optional reading entry: { book_title, pages_today, total_pages, logged_at }.';

alter table public.daily_logs
  add column if not exists workout_voice jsonb null;

comment on column public.daily_logs.workout_voice is
  'Flags when a workout was logged via voice UI, e.g. { "indoor": true } or { "outdoor": true }.';

-- If you had a CHECK constraint on user_profiles.diet_type listing old values, replace it, e.g.:
-- alter table public.user_profiles drop constraint if exists user_profiles_diet_type_check;
-- alter table public.user_profiles add constraint user_profiles_diet_type_check
--   check (diet_type in (
--     'North Indian (Roti, Dal, Sabzi, Paneer)',
--     'South Indian (Rice, Sambar, Dosa, Idli)',
--     'Indian Fusion (Mix of North + South)',
--     'Mediterranean (Olive oil, Legumes, Fish, Veggies)',
--     'High Protein Indian (Eggs, Paneer, Dal, Sprouts)',
--     'Vegetarian Indian',
--     'Vegan Indian',
--     'General Healthy (Balanced, no restriction)'
--   ));

-- Optional: migrate existing profile diet strings to new labels
-- update public.user_profiles set diet_type = 'North Indian (Roti, Dal, Sabzi, Paneer)'
--   where diet_type = 'Indian (Ragi, Dal, Sabzi)';
-- update public.user_profiles set diet_type = 'General Healthy (Balanced, no restriction)'
--   where diet_type = 'General Healthy';
-- update public.user_profiles set diet_type = 'Mediterranean (Olive oil, Legumes, Fish, Veggies)'
--   where diet_type = 'Mediterranean';
