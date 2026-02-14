/**
 * Simplified SM-2 Spaced Repetition Algorithm
 *
 * Implements the core scheduling logic described in the copilot-instructions:
 *   intervals: 1d, 3d, 7d, 15d, 30d
 *   ease_factor floor: 1.3 (enforced by DB CHECK, but also clamped here)
 *
 * Quality grades map to user self-assessment after each answer.
 */
import type { Question } from '@/types/database'

// ── Types ──────────────────────────────────────────────────

/** 0 = total blackout, 5 = perfect recall (standard SM-2 scale) */
export type QualityGrade = 0 | 1 | 2 | 3 | 4 | 5

export interface SrsUpdate {
  ease_factor: number
  interval: number        // days
  repetitions: number
  next_review: string     // ISO-8601
}

// ── Constants ──────────────────────────────────────────────

/** SM-2 spec: ease factor must never drop below 1.3 */
const MIN_EASE_FACTOR = 1.3

/**
 * Pre-defined interval steps for the simplified variant.
 * Once repetitions exceed this array, we switch to multiplicative mode.
 */
const INTERVAL_STEPS = [1, 3, 7, 15, 30] as const

// ── Core Algorithm ─────────────────────────────────────────

/**
 * Compute the next SRS state for a question after a review.
 *
 * @param question - Current question with SRS fields
 * @param grade    - User's self-assessed quality (0–5)
 * @returns        - New SRS field values to persist
 */
export function computeSrsUpdate(
  question: Pick<Question, 'ease_factor' | 'interval' | 'repetitions'>,
  grade: QualityGrade,
): SrsUpdate {
  let { ease_factor, interval, repetitions } = question

  if (grade < 3) {
    // ── Failed recall: reset to beginning ──────────────────
    repetitions = 0
    interval = INTERVAL_STEPS[0] // 1 day
  } else {
    // ── Successful recall ──────────────────────────────────
    repetitions += 1

    if (repetitions - 1 < INTERVAL_STEPS.length) {
      // Use pre-defined step intervals
      interval = INTERVAL_STEPS[repetitions - 1]
    } else {
      // Beyond defined steps: multiplicative growth
      interval = Math.round(interval * ease_factor)
    }
  }

  // ── Update ease factor (SM-2 formula) ────────────────────
  // EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
  ease_factor =
    ease_factor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))

  // Clamp to floor
  ease_factor = Math.max(MIN_EASE_FACTOR, Math.round(ease_factor * 100) / 100)

  // ── Compute next review date ─────────────────────────────
  const next = new Date()
  next.setDate(next.getDate() + interval)

  return {
    ease_factor,
    interval,
    repetitions,
    next_review: next.toISOString(),
  }
}

/**
 * Map AI evaluation scores to a quality grade.
 *
 * Converts the 0–1 fluency/star/conciseness scores into a 0–5 SM-2 grade.
 * Falls back to a user-supplied grade if AI scores aren't available.
 */
export function scoresToGrade(
  fluency: number | null,
  starScore: number | null,
  conciseness: number | null,
): QualityGrade {
  const scores = [fluency, starScore, conciseness].filter(
    (s): s is number => s !== null,
  )

  if (scores.length === 0) return 3 // neutral default if no AI scores

  const avg = scores.reduce((a, b) => a + b, 0) / scores.length

  // Map [0, 1] → [0, 5]
  const raw = Math.round(avg * 5)
  return Math.min(5, Math.max(0, raw)) as QualityGrade
}
