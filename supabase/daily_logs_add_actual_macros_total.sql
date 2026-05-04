-- Running totals for actual logged meals for the day (sum of clean logged entries).
alter table public.daily_logs
  add column if not exists actual_macros_total jsonb;

comment on column public.daily_logs.actual_macros_total is
  'Aggregated actual intake: { calories, protein_g, carbs_g, fat_g, fiber_g }';
