-- Add question_type to classify behavioral vs general questions.
-- Behavioral questions are evaluated with STAR method; general ones are not.
alter table public.questions
  add column if not exists question_type text not null default 'behavioral'
    check (question_type in ('behavioral', 'general'));

-- Allow star_score to be NULL for general questions
alter table public.attempts
  alter column star_score drop not null;

-- Update RLS insert/update policies to allow the new column (no change needed,
-- existing policies cover all columns for the owning user).
