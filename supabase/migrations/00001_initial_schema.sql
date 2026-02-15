-- ============================================================
-- HardStop – Initial Schema
-- Supabase (PostgreSQL) with Row Level Security
-- ============================================================

-- 0. Extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. PROFILES
--    Mirrors auth.users; created via a trigger on sign-up.
-- ============================================================
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  avatar_url  text,
  locale      text default 'en',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using  (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 2. CATEGORIES
--    Each user manages their own question categories.
-- ============================================================
create table public.categories (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  description text,
  sort_order  int default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),

  unique (user_id, name)
);

create index idx_categories_user_id on public.categories(user_id);

alter table public.categories enable row level security;

create policy "Users can view their own categories"
  on public.categories for select
  using (auth.uid() = user_id);

create policy "Users can insert their own categories"
  on public.categories for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own categories"
  on public.categories for update
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own categories"
  on public.categories for delete
  using (auth.uid() = user_id);

-- ============================================================
-- 3. QUESTIONS
--    Linked to a category. Carries all SRS scheduling fields
--    and the adaptive timer base.
-- ============================================================
create table public.questions (
  id                 uuid primary key default uuid_generate_v4(),
  category_id        uuid not null references public.categories(id) on delete cascade,
  user_id            uuid not null references public.profiles(id) on delete cascade,

  -- Content
  title              text not null,
  hint               text,

  -- SRS fields (Simplified SM-2) — all NOT NULL to prevent null-math bugs
  next_review        timestamptz not null default now(),
  interval           int         not null default 0     check (interval >= 0),
  ease_factor        real        not null default 2.5   check (ease_factor >= 1.3),
  repetitions        int         not null default 0     check (repetitions >= 0),

  -- Adaptive timer
  base_time_seconds  int         not null default 120   check (base_time_seconds >= 10),

  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

create index idx_questions_user_id     on public.questions(user_id);
create index idx_questions_category_id on public.questions(category_id);

-- Partial index: only rows that are due for review.
-- This is the hot-path query for buildSession().
/*
create index idx_questions_due_review
  on public.questions(user_id, next_review)
  where next_review <= now();
  */
  create index idx_questions_user_next_review 
  on public.questions(user_id, next_review);

alter table public.questions enable row level security;

create policy "Users can view their own questions"
  on public.questions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own questions"
  on public.questions for insert
  with check (
    auth.uid() = user_id
    and ease_factor >= 1.3
    and interval >= 0
    and repetitions >= 0
    and base_time_seconds >= 10
  );

create policy "Users can update their own questions"
  on public.questions for update
  using  (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and ease_factor >= 1.3
    and interval >= 0
    and repetitions >= 0
    and base_time_seconds >= 10
  );

create policy "Users can delete their own questions"
  on public.questions for delete
  using (auth.uid() = user_id);

-- ============================================================
-- 4. ATTEMPTS
--    Stores every practice answer and its duration.
-- ============================================================
create table public.attempts (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  question_id       uuid not null references public.questions(id) on delete cascade,

  -- Answer data
  answer_raw        text,                   -- original user input
  answer_clean      text,                   -- post AI grammar/typo cleanup
  duration_seconds  int not null check (duration_seconds >= 0),

  -- AI evaluation results (populated async by Edge Function)
  fluency_score     real,                   -- 0-1
  star_score        real,                   -- 0-1 STAR method alignment
  conciseness_score real,                   -- 0-1
  ai_feedback       text,                   -- free-form AI commentary

  -- Timer feedback from user
  timer_feedback    text check (timer_feedback in ('too_short', 'too_long', null)),

  created_at        timestamptz default now()
);

create index idx_attempts_user_id     on public.attempts(user_id);
create index idx_attempts_question_id on public.attempts(question_id);
create index idx_attempts_created_at  on public.attempts(user_id, created_at desc);

alter table public.attempts enable row level security;

create policy "Users can view their own attempts"
  on public.attempts for select
  using (auth.uid() = user_id);

create policy "Users can insert their own attempts"
  on public.attempts for insert
  with check (
    auth.uid() = user_id
    and duration_seconds >= 0
  );

-- Attempts are immutable — no update/delete policies from clients.
-- AI evaluation fields are populated by Edge Functions using the
-- service_role key which bypasses RLS.

-- ============================================================
-- 5. HELPER: updated_at trigger
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create trigger set_questions_updated_at
  before update on public.questions
  for each row execute function public.set_updated_at();
