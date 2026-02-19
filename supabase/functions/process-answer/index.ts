/**
 * Supabase Edge Function: process-answer
 *
 * Two-phase answer processing:
 *   Phase 1 — Save raw answer immediately (data durability, never lost)
 *   Phase 2 — Attempt async AI cleanup + evaluation, mark status accordingly
 *
 * Invoked from the client after an attempt is inserted,
 * or via a Supabase webhook / pg_notify trigger.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface RequestPayload {
  attemptId: string
  questionTitle: string
  answerRaw: string
  userId: string
  questionId: string
  questionType: 'behavioral' | 'general'
  timeUsedSeconds: number
  baseTimeSeconds: number
}

serve(async (req) => {
  // ── Validate environment variables ─────────────────────────
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY environment variable not set')
    return new Response(
      JSON.stringify({
        error: 'OPENAI_API_KEY not configured. Create supabase/.env.local with: OPENAI_API_KEY=sk-...',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase environment variables')
    return new Response(
      JSON.stringify({ error: 'Supabase configuration missing' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  try {
    const payload: RequestPayload = await req.json()
    const { attemptId, questionTitle, answerRaw, userId, questionId, questionType, timeUsedSeconds, baseTimeSeconds } = payload

    if (!attemptId || !answerRaw) {
      return new Response(
        JSON.stringify({ error: 'Missing attemptId or answerRaw' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Service-role client bypasses RLS for writes
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // ── Phase 2: AI Processing (attempt is already saved by client) ────
    try {
      // Important: evaluateAnswer depends on the grammatically cleaned answer.
      const cleaned = await cleanGrammar(answerRaw, OPENAI_API_KEY)
      const evaluation = await evaluateAnswer(
        questionTitle,
        cleaned,
        questionType ?? 'behavioral',
        timeUsedSeconds ?? 0,
        baseTimeSeconds ?? 120,
        userId,
        questionId,
        supabase,
        OPENAI_API_KEY,
      )

      await supabase
        .from('attempts')
        .update({
          answer_clean: cleaned,
          fluency_score: evaluation.fluency,
          star_score: evaluation.star,
          conciseness_score: evaluation.conciseness,
          ai_feedback: evaluation.feedback,
          processing_status: 'complete',
        })
        .eq('id', attemptId)

      return new Response(
        JSON.stringify({ status: 'complete' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    } catch (aiError) {
      console.error('AI processing failed:', aiError)

      // Mark as failed — the raw answer is safe in the DB
      await supabase
        .from('attempts')
        .update({ processing_status: 'failed' })
        .eq('id', attemptId)

      return new Response(
        JSON.stringify({ status: 'failed', error: 'AI processing error' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }
  } catch (err) {
    console.error('Edge function error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})

// ── AI Helpers ─────────────────────────────────────────────

async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`OpenAI API error ${res.status}: ${body}`)
  }

  const json = await res.json()
  return json.choices[0]?.message?.content ?? ''
}

/** Pre-processing: fix grammar and typos */
async function cleanGrammar(rawText: string, apiKey: string): Promise<string> {
  return callOpenAI(
    'You are a text editor. Fix grammar and typos only. Do not change meaning, terminology, or sentence structure. Return only the corrected text.',
    rawText,
    apiKey,
  )
}

interface EvaluationResult {
  fluency: number
  star: number | null
  conciseness: number
  feedback: string
}

/**
 * Evaluate the corrected answer against the user's earliest answer
 * for the same question (progression tracking).
 */
async function evaluateAnswer(
  questionTitle: string,
  correctedAnswer: string,
  questionType: 'behavioral' | 'general',
  timeUsedSeconds: number,
  baseTimeSeconds: number,
  userId: string,
  questionId: string,
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
): Promise<EvaluationResult> {
  const { data: earliest } = await supabase
    .from('attempts')
    .select('answer_raw')
    .eq('user_id', userId)
    .eq('question_id', questionId)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  const earliestAnswer = earliest?.answer_raw ?? '(no previous answer)'
  const isBehavioral = questionType === 'behavioral'
  const timeRatio = baseTimeSeconds > 0 ? timeUsedSeconds / baseTimeSeconds : 1

  const starInstructions = isBehavioral
    ? '3. star (0.0–1.0) — Situation/Task/Action/Result structure alignment'
    : '3. star — always null (this question type does not use STAR)'

  const timeNote = timeRatio < 0.5
    ? 'The user submitted very quickly relative to the allocated time — be lenient on conciseness.'
    : timeRatio > 1.1
    ? 'The user ran over the allocated time — apply normal conciseness standards.'
    : ''

  const prompt = `
Question: "${questionTitle}"
Question type: ${questionType}
Time allocated: ${baseTimeSeconds}s | Time used: ${timeUsedSeconds}s
${timeNote}

Earliest answer:
"""
${earliestAnswer}
"""

Current answer (grammar-corrected):
"""
${correctedAnswer}
"""

Evaluate the current answer on these metrics:
1. fluency (0.0–1.0) — clarity, grammar, natural flow
2. conciseness (0.0–1.0) — no filler, stays on topic, appropriate length for time given
${starInstructions}

Respond in JSON only:
${isBehavioral
    ? '{"fluency": 0.0, "star": 0.0, "conciseness": 0.0, "feedback": "2-3 sentence constructive feedback comparing progression from earliest to current answer"}'
    : '{"fluency": 0.0, "star": null, "conciseness": 0.0, "feedback": "2-3 sentence constructive feedback comparing progression from earliest to current answer"}'
}
`

  const raw = await callOpenAI(
    'You are an interview coach evaluating practice answers. Respond in valid JSON only.',
    prompt,
    apiKey,
  )

  try {
    const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    return {
      fluency: clampScore(parsed.fluency),
      star: parsed.star === null || parsed.star === undefined ? null : clampScore(parsed.star),
      conciseness: clampScore(parsed.conciseness),
      feedback: String(parsed.feedback ?? ''),
    }
  } catch {
    throw new Error(`Failed to parse AI evaluation: ${raw.slice(0, 200)}`)
  }
}

function clampScore(value: unknown): number {
  const num = Number(value)
  if (Number.isNaN(num)) return 0
  return Math.max(0, Math.min(1, num))
}
