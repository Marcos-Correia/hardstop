import { supabase } from './supabase'

export interface EvaluateAnswerRequest {
  question: string
  raw_answer: string
  baseline_answer?: string
}

export interface EvaluateAnswerResponse {
  corrected_answer: string
  comparison_score?: {
    vocabulary_improvement: number
    conciseness_score: number
    overall_score: number
  }
}

/**
 * Evaluates a user's answer by correcting grammar/spelling and comparing
 * against their baseline (first attempt) answer.
 * 
 * @param request - The question, raw answer, and optional baseline
 * @returns Corrected answer and comparison scores (if baseline provided)
 */
export async function evaluateAnswer(
  request: EvaluateAnswerRequest
): Promise<EvaluateAnswerResponse> {
  const { data, error } = await supabase.functions.invoke<EvaluateAnswerResponse>(
    'evaluate-answer',
    {
      body: request,
    }
  )

  if (error) {
    throw new Error(`Failed to evaluate answer: ${error.message}`)
  }

  if (!data) {
    throw new Error('No data returned from evaluate-answer function')
  }

  return data
}

/**
 * Saves the corrected answer to the database after evaluation.
 * This should be called after evaluateAnswer() to persist the cleaned answer.
 */
export async function saveEvaluatedAnswer(
  userId: string,
  questionId: string,
  correctedAnswer: string,
  comparisonScore?: number
) {
  const { error } = await supabase
    .from('user_answers')
    .insert({
      user_id: userId,
      question_id: questionId,
      answer_text: correctedAnswer,
      comparison_score: comparisonScore,
      created_at: new Date().toISOString(),
    })

  if (error) {
    throw new Error(`Failed to save answer: ${error.message}`)
  }
}
