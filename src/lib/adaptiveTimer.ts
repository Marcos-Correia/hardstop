/**
 * Adaptive Timer
 *
 * Adjusts `base_time_seconds` per question based on user feedback.
 * Clamped to [MIN_TIME, MAX_TIME] to prevent degenerate values.
 */

export const MIN_TIME = 30   // seconds
export const MAX_TIME = 600  // 10 minutes
const INCREMENT = 15
const DECREMENT = 10

export type TimerFeedback = 'too_short' | 'too_long' | 'just_right'

/**
 * Compute the new base time after user feedback.
 * Always returns a value within [MIN_TIME, MAX_TIME].
 */
export function adjustBaseTime(
  currentBaseTime: number,
  feedback: TimerFeedback,
): number {
  switch (feedback) {
    case 'too_short':
      return Math.min(currentBaseTime + INCREMENT, MAX_TIME)
    case 'too_long':
      return Math.max(currentBaseTime - DECREMENT, MIN_TIME)
    case 'just_right':
      return currentBaseTime
  }
}
