-- Trackro schema
-- Run this in the Supabase SQL editor for your project.

create extension if not exists "pgcrypto";

create table if not exists weight_entries (
  id uuid primary key default gen_random_uuid(),
  logged_at date not null,
  weight_lbs numeric not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists exercise_entries (
  id uuid primary key default gen_random_uuid(),
  logged_at date not null,
  exercise_name text not null,
  category text not null default 'cardio', -- cardio | lifting | core
  duration_min numeric,
  sets integer,
  reps integer,
  load_lbs numeric,
  distance_mi numeric,
  pace_sec_per_mi numeric,
  calories_burned numeric,
  details text, -- itemized exercise breakdown for lifting/core workouts
  notes text,
  created_at timestamptz not null default now()
);

-- Adds columns for installs that already ran the table creation above.
alter table exercise_entries add column if not exists pace_sec_per_mi numeric;
alter table exercise_entries add column if not exists details text;

create table if not exists macro_entries (
  id uuid primary key default gen_random_uuid(),
  logged_at date not null,
  meal_name text not null default 'Meal',
  food_name text not null,
  calories numeric not null default 0,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists common_foods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  calories numeric not null default 0,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists goals (
  id integer primary key default 1,
  target_weight_lbs numeric,
  target_calories numeric,
  target_protein_g numeric,
  target_carbs_g numeric,
  target_fat_g numeric,
  updated_at timestamptz not null default now(),
  constraint goals_singleton check (id = 1)
);

insert into goals (id) values (1) on conflict (id) do nothing;

create index if not exists weight_entries_logged_at_idx on weight_entries (logged_at desc);
create index if not exists exercise_entries_logged_at_idx on exercise_entries (logged_at desc);
create index if not exists macro_entries_logged_at_idx on macro_entries (logged_at desc);
create index if not exists common_foods_name_idx on common_foods (name);

-- RLS left open (anon key only) — access is gated at the app layer via a passcode,
-- not per-row auth. See README for the tradeoffs of this approach.
alter table weight_entries enable row level security;
alter table exercise_entries enable row level security;
alter table macro_entries enable row level security;
alter table common_foods enable row level security;
alter table goals enable row level security;

create policy "anon full access" on weight_entries for all using (true) with check (true);
create policy "anon full access" on exercise_entries for all using (true) with check (true);
create policy "anon full access" on macro_entries for all using (true) with check (true);
create policy "anon full access" on common_foods for all using (true) with check (true);
create policy "anon full access" on goals for all using (true) with check (true);
