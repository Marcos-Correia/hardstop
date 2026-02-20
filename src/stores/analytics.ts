import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'
import type {
  Attempt,
  Question,
  AttemptId,
  UserId,
} from '@/types/database'

/** Score breakdown for a session */
export interface SessionScores {
  fluency: number
  star: number
  conciseness: number
}

/** Time breakdown for a single question attempt */
export interface QuestionTimeMetric {
  questionId: string
  questionTitle: string
  timeSpent: number
  timeAllocated: number
}

/** Complete time metrics for a session */
export interface SessionTimeMetrics {
  totalTimeSpent: number
  totalTimeAllocated: number
  perQuestionBreakdown: QuestionTimeMetric[]
}

/** SRS change for a question */
export interface SrsChange {
  questionId: string
  questionTitle: string
  oldNextReview: string
  newNextReview: string
  oldInterval: number
  newInterval: number
  oldEaseFactor: number
  newEaseFactor: number
}

/** Complete session summary */
export interface SessionSummaryData {
  totalQuestionsAnswered: number
  averageScores: SessionScores
  timeMetrics: SessionTimeMetrics
  attemptDetails: Attempt[]
  questionDetails: Map<string, Question>
  hasProcessingAttempts: boolean
}

export const useAnalyticsStore = defineStore('analytics', () => {
  /**
   * Fetch all attempts and calculate average scores.
   * Returns averages (0-1 range) or 0 if no scores available.
   */
  async function calculateAverageScores(
    attemptIds: AttemptId[],
    userId: UserId,
  ): Promise<SessionScores> {
    if (attemptIds.length === 0) {
      return { fluency: 0, star: 0, conciseness: 0 }
    }

    try {
      const { data, error } = await supabase
        .from('attempts')
        .select('fluency_score, star_score, conciseness_score')
        .in('id', attemptIds)
        .eq('user_id', userId)

      if (error) throw error
      if (!data || data.length === 0) {
        return { fluency: 0, star: 0, conciseness: 0 }
      }

      let fluencySum = 0
      let starSum = 0
      let concisenessSum = 0
      let validCount = 0

      for (const attempt of data) {
        // Only include attempts that have all three scores
        if (
          attempt.fluency_score !== null &&
          attempt.star_score !== null &&
          attempt.conciseness_score !== null
        ) {
          fluencySum += attempt.fluency_score
          starSum += attempt.star_score
          concisenessSum += attempt.conciseness_score
          validCount++
        }
      }

      return {
        fluency: validCount > 0 ? fluencySum / validCount : 0,
        star: validCount > 0 ? starSum / validCount : 0,
        conciseness: validCount > 0 ? concisenessSum / validCount : 0,
      }
    } catch (err) {
      console.error('Failed to calculate average scores:', err)
      return { fluency: 0, star: 0, conciseness: 0 }
    }
  }

  /**
   * Calculate time metrics for a session.
   * Groups by question and sums duration_seconds.
   */
  async function calculateTimeMetrics(
    attemptIds: AttemptId[],
    userId: UserId,
    questions: Question[],
  ): Promise<SessionTimeMetrics> {
    if (attemptIds.length === 0) {
      return {
        totalTimeSpent: 0,
        totalTimeAllocated: 0,
        perQuestionBreakdown: [],
      }
    }

    try {
      const { data, error } = await supabase
        .from('attempts')
        .select('question_id, duration_seconds')
        .in('id', attemptIds)
        .eq('user_id', userId)

      if (error) throw error
      if (!data || data.length === 0) {
        return {
          totalTimeSpent: 0,
          totalTimeAllocated: 0,
          perQuestionBreakdown: [],
        }
      }

      // Map attempts by question_id to sum duration
      const timeByQuestion = new Map<string, number>()
      for (const attempt of data) {
        const current = timeByQuestion.get(attempt.question_id) || 0
        timeByQuestion.set(attempt.question_id, current + attempt.duration_seconds)
      }

      // Build breakdown with question metadata
      const breakdown: QuestionTimeMetric[] = []
      let totalSpent = 0
      let totalAllocated = 0

      for (const questionId of timeByQuestion.keys()) {
        const timeSpent = timeByQuestion.get(questionId) || 0
        const question = questions.find((q) => q.id === questionId)
        if (question) {
          const timeAllocated = question.base_time_seconds
          breakdown.push({
            questionId,
            questionTitle: question.title,
            timeSpent,
            timeAllocated,
          })
          totalSpent += timeSpent
          totalAllocated += timeAllocated
        }
      }

      return {
        totalTimeSpent: totalSpent,
        totalTimeAllocated: totalAllocated,
        perQuestionBreakdown: breakdown.sort(
          (a, b) => a.questionId.localeCompare(b.questionId),
        ),
      }
    } catch (err) {
      console.error('Failed to calculate time metrics:', err)
      return {
        totalTimeSpent: 0,
        totalTimeAllocated: 0,
        perQuestionBreakdown: [],
      }
    }
  }

  /**
   * Fetch all attempt details for a session.
   * Returns array of full Attempt objects with all scores.
   */
  async function fetchAttemptDetails(
    attemptIds: AttemptId[],
    userId: UserId,
  ): Promise<Attempt[]> {
    if (attemptIds.length === 0) return []

    try {
      const { data, error } = await supabase
        .from('attempts')
        .select('*')
        .in('id', attemptIds)
        .eq('user_id', userId)

      if (error) throw error
      return (data || []) as Attempt[]
    } catch (err) {
      console.error('Failed to fetch attempt details:', err)
      return []
    }
  }

  /**
   * Check if any attempts are still processing (AI evaluation pending).
   */
  function checkForProcessingAttempts(attempts: Attempt[]): boolean {
    return attempts.some((a) => a.processing_status === 'pending')
  }

  /**
   * Compute complete session summary.
   * This is the main entrypoint called after a session completes.
   */
  async function computeSessionSummary(
    attemptIds: AttemptId[],
    userId: UserId,
    questions: Question[],
  ): Promise<SessionSummaryData> {
    try {
      const [
        averageScores,
        timeMetrics,
        attemptDetails,
      ] = await Promise.all([
        calculateAverageScores(attemptIds, userId),
        calculateTimeMetrics(attemptIds, userId, questions),
        fetchAttemptDetails(attemptIds, userId),
      ])

      const hasProcessing = checkForProcessingAttempts(attemptDetails)

      // Create a map of questions by ID for quick lookup
      const questionMap = new Map(questions.map((q) => [q.id, q]))

      return {
        totalQuestionsAnswered: attemptIds.length,
        averageScores,
        timeMetrics,
        attemptDetails,
        questionDetails: questionMap,
        hasProcessingAttempts: hasProcessing,
      }
    } catch (err) {
      console.error('Failed to compute session summary:', err)
      return {
        totalQuestionsAnswered: 0,
        averageScores: { fluency: 0, star: 0, conciseness: 0 },
        timeMetrics: {
          totalTimeSpent: 0,
          totalTimeAllocated: 0,
          perQuestionBreakdown: [],
        },
        attemptDetails: [],
        questionDetails: new Map(),
        hasProcessingAttempts: false,
      }
    }
  }

  return {
    calculateAverageScores,
    calculateTimeMetrics,
    fetchAttemptDetails,
    checkForProcessingAttempts,
    computeSessionSummary,
  }
})
