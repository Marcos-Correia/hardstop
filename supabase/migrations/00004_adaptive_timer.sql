-- Adaptive timer: track feedback direction and streak per question
-- so the adjustment amount decays geometrically on consecutive same-direction feedback.

alter table public.questions
  add column if not exists last_time_feedback text
    check (last_time_feedback in ('too_short', 'too_long', 'just_right')),
  add column if not exists time_feedback_streak integer not null default 0,
  add column if not exists last_time_adjustment integer not null default 15;
