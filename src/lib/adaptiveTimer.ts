export const MIN_TIME = 30
export const MAX_TIME = 600
const BASE_DELTA = 15
const DECAY_FACTOR = 0.66
const MIN_ADJUSTMENT = 5

export type TimerFeedback = 'too_short' | 'too_long' | 'just_right'

export interface TimerState {
  base_time_seconds: number
  last_time_feedback: TimerFeedback | null
  time_feedback_streak: number
  last_time_adjustment: number
}

export interface TimerAdjustmentResult {
  base_time_seconds: number
  last_time_feedback: TimerFeedback
  time_feedback_streak: number
  last_time_adjustment: number
}

export function computeTimerAdjustment(
  state: TimerState,
  feedback: TimerFeedback,
): TimerAdjustmentResult {
  if (feedback === 'just_right') {
    return {
      base_time_seconds: state.base_time_seconds,
      last_time_feedback: 'just_right',
      time_feedback_streak: 0,
      last_time_adjustment: BASE_DELTA,
    }
  }

  const sameDirection = feedback === state.last_time_feedback
  const rawAdjustment = sameDirection
    ? Math.round(state.last_time_adjustment * DECAY_FACTOR)
    : BASE_DELTA

  const adjustment = Math.max(rawAdjustment, MIN_ADJUSTMENT)
  const delta = feedback === 'too_short' ? adjustment : -adjustment

  return {
    base_time_seconds: Math.min(MAX_TIME, Math.max(MIN_TIME, state.base_time_seconds + delta)),
    last_time_feedback: feedback,
    time_feedback_streak: sameDirection ? state.time_feedback_streak + 1 : 1,
    last_time_adjustment: adjustment,
  }
}
