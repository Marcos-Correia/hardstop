-- ============================================================
-- HardStop – Schema Hardening
--
-- Adds:
--   1. processing_status to attempts for async AI feedback
--   2. Tightens base_time_seconds CHECK to [30, 600]
--   3. Upper bound on interval to prevent runaway scheduling
-- ============================================================

-- 1. Add processing_status to attempts
alter table public.attempts
  add column if not exists processing_status text
    not null default 'pending'
    check (processing_status in ('pending', 'complete', 'failed'));

-- Index for polling/subscription on incomplete AI processing
create index if not exists idx_attempts_processing_pending
  on public.attempts(processing_status)
  where processing_status = 'pending';

-- 2. Tighten base_time_seconds bounds: [30, 600]
--    The original CHECK was (>= 10). We drop it and add a range check.
--    First, clamp any existing rows that would violate the new constraint.
update public.questions
  set base_time_seconds = greatest(30, least(600, base_time_seconds))
  where base_time_seconds < 30 or base_time_seconds > 600;

alter table public.questions
  drop constraint if exists questions_base_time_seconds_check;

alter table public.questions
  add constraint questions_base_time_seconds_check
    check (base_time_seconds >= 30 and base_time_seconds <= 600);

-- 3. Cap interval at 365 days to prevent runaway scheduling
alter table public.questions
  drop constraint if exists questions_interval_check;

alter table public.questions
  add constraint questions_interval_check
    check (interval >= 0 and interval <= 365);

-- 4. Update the INSERT/UPDATE RLS policies on questions to match new bounds.
--    Drop old policies, recreate with tighter checks.
drop policy if exists "Users can insert their own questions" on public.questions;
drop policy if exists "Users can update their own questions" on public.questions;

create policy "Users can insert their own questions"
  on public.questions for insert
  with check (
    auth.uid() = user_id
    and ease_factor >= 1.3
    and interval >= 0 and interval <= 365
    and repetitions >= 0
    and base_time_seconds >= 30 and base_time_seconds <= 600
  );

create policy "Users can update their own questions"
  on public.questions for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and ease_factor >= 1.3
    and interval >= 0 and interval <= 365
    and repetitions >= 0
    and base_time_seconds >= 30 and base_time_seconds <= 600
  );
