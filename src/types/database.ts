import type {
  UserId,
  QuestionId,
  CategoryId,
  AttemptId,
  ProfileId,
} from './branded'

// Re-export branded types for convenience
export type { UserId, QuestionId, CategoryId, AttemptId, ProfileId }

/** Mirrors `public.categories` */
export interface Category {
  id: CategoryId
  user_id: UserId
  name: string
  description: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

/** Mirrors `public.questions` */
export interface Question {
  id: QuestionId
  category_id: CategoryId
  user_id: UserId
  title: string
  hint: string | null
  question_type: 'behavioral' | 'general'
  next_review: string        // ISO-8601 timestamptz
  interval: number           // days
  ease_factor: number
  repetitions: number
  base_time_seconds: number
  created_at: string
  updated_at: string
}

/** Processing status for async AI evaluation */
export type ProcessingStatus = 'pending' | 'complete' | 'failed'

/** Mirrors `public.attempts` */
export interface Attempt {
  id: AttemptId
  user_id: UserId
  question_id: QuestionId
  answer_raw: string | null
  answer_clean: string | null
  duration_seconds: number
  fluency_score: number | null
  star_score: number | null
  conciseness_score: number | null
  ai_feedback: string | null
  timer_feedback: 'too_short' | 'too_long' | null
  processing_status: ProcessingStatus
  created_at: string
}

/** Mirrors `public.profiles` */
export interface Profile {
  id: ProfileId
  full_name: string | null
  avatar_url: string | null
  locale: string
  created_at: string
  updated_at: string
}

/** Insert payload for attempts (omit server-generated fields) */
export type AttemptInsert = Pick<
  Attempt,
  'question_id' | 'user_id' | 'answer_raw' | 'duration_seconds'
> & {
  timer_feedback?: Attempt['timer_feedback']
}
