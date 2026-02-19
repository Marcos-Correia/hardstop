/** Target session duration window in seconds */
export const SESSION_MIN_SECONDS = 10 * 60
export const SESSION_MAX_SECONDS = 25 * 60

export interface BudgetCheckResult {
  status: 'ok' | 'too_short' | 'too_long'
  totalSeconds: number
}

export function checkSessionBudget(
  questions: { base_time_seconds: number }[],
): BudgetCheckResult {
  const totalSeconds = questions.reduce((sum, q) => sum + q.base_time_seconds, 0)
  return {
    status: totalSeconds < SESSION_MIN_SECONDS
      ? 'too_short'
      : totalSeconds > SESSION_MAX_SECONDS
        ? 'too_long'
        : 'ok',
    totalSeconds,
  }
}
