-- Logged "I had something else" entries per day (one per meal_slot after user confirms clean meal).
alter table public.daily_logs
  add column if not exists actual_meals jsonb not null default '[]'::jsonb;

comment on column public.daily_logs.actual_meals is
  'Array of { meal_slot, description, calories, protein_g, carbs_g, fat_g, fiber_g, is_clean, logged_at }';
