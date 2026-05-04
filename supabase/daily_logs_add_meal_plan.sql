-- Run in Supabase SQL editor (or psql) before using "Save to today's log" on the Meals tab.
alter table public.daily_logs
  add column if not exists meal_plan text;

comment on column public.daily_logs.meal_plan is 'AI or fallback single-day meal plan text for that calendar day.';
