<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useSessionStore } from '@/stores/session'
import { supabase } from '@/lib/supabase'
import { adjustBaseTime } from '@/lib/adaptiveTimer'
import type { Question, Attempt } from '@/types/database'
import type { TimerFeedback } from '@/lib/adaptiveTimer'
import CircularTimer from './CircularTimer.vue'
import SessionProgress from './SessionProgress.vue'
import AiFeedback from './AiFeedback.vue'

const emit = defineEmits<{
  'session-complete': []
  abandon: []
}>()

// ── Store ──────────────────────────────────────────────────
const session = useSessionStore()

// ── State ──────────────────────────────────────────────────
const currentIndex = ref(0)
const answer = ref('')
const secondsLeft = ref(0)
const isSubmitting = ref(false)
const hasTimedOut = ref(false)
const feedbackSent = ref(false)

// AI feedback state
const isProcessingAi = ref(false)
const aiFeedbackResult = ref<Attempt | null>(null)
const aiFeedbackError = ref<string | null>(null)
const submittedAnswer = ref('')

/** True when the answer has been submitted and we are showing feedback */
const showPostSubmission = ref(false)

let timer: ReturnType<typeof setInterval> | null = null
let startedAt = 0       // epoch ms – used to compute duration
let timerDuration = 0   // total seconds for current question
let timerStartedAt = 0  // epoch ms – used for drift-free countdown

// ── Derived ────────────────────────────────────────────────
const currentQuestion = computed<Question | null>(
  () => session.questions[currentIndex.value] ?? null,
)

const isReadOnly = computed(() => hasTimedOut.value || isSubmitting.value)

const isSessionComplete = computed(
  () => currentIndex.value >= session.questions.length,
)

// ── Timer control (drift-free using Date.now delta) ────────
function startTimer(seconds: number) {
  stopTimer()
  timerDuration = seconds
  secondsLeft.value = seconds
  hasTimedOut.value = false
  startedAt = Date.now()
  timerStartedAt = Date.now()

  timer = setInterval(() => {
    const elapsed = (Date.now() - timerStartedAt) / 1000
    const remaining = Math.max(0, Math.round(timerDuration - elapsed))
    secondsLeft.value = remaining

    if (remaining <= 0) {
      hasTimedOut.value = true
      stopTimer()
      submit()  // auto-submit on timeout
    }
  }, 250) // 250ms for smooth visual updates without excessive reactivity
}

function stopTimer() {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
}

onBeforeUnmount(stopTimer)

// ── Reset when question changes ────────────────────────────
watch(currentQuestion, (q) => {
  if (q) {
    answer.value = ''
    hasTimedOut.value = false
    feedbackSent.value = false
    showPostSubmission.value = false
    aiFeedbackResult.value = null
    aiFeedbackError.value = null
    isProcessingAi.value = false
    submittedAnswer.value = ''
    startTimer(q.base_time_seconds)
  }
}, { immediate: true })

// ── Submission ─────────────────────────────────────────────
async function submit() {
  const question = currentQuestion.value
  if (!question || isSubmitting.value) return

  isSubmitting.value = true
  stopTimer()

  const durationSeconds = Math.round((Date.now() - startedAt) / 1000)
  const rawAnswer = answer.value || ''
  submittedAnswer.value = rawAnswer

  try {
    const { data: insertedAttempt, error: insertError } = await supabase
      .from('attempts')
      .insert({
        question_id: question.id,
        user_id: question.user_id,
        answer_raw: rawAnswer || null,
        duration_seconds: durationSeconds,
      })
      .select()
      .maybeSingle()

    if (insertError) throw insertError

    // Persist session progress for mobile resume
    session.persistProgress(currentIndex.value + 1)

    // Show the post-submission screen
    showPostSubmission.value = true
    isSubmitting.value = false

    // Trigger AI processing in the background (only if answer is non-empty)
    if (rawAnswer.trim() && insertedAttempt) {
      processAiFeedback(
        insertedAttempt.id,
        question.title,
        rawAnswer,
        question.user_id,
        question.id,
      )
    }
  } catch (err) {
    console.error('Failed to save attempt', err)
    isSubmitting.value = false
    // Still show post-submission so user can advance
    showPostSubmission.value = true
  }
}

/** Call the process-answer edge function and fetch updated attempt */
async function processAiFeedback(
  attemptId: string,
  questionTitle: string,
  answerRaw: string,
  userId: string,
  questionId: string,
) {
  isProcessingAi.value = true
  aiFeedbackError.value = null

  try {
    // Invoke the process-answer edge function
    const { data: fnResponse, error: fnError } = await supabase.functions.invoke(
      'process-answer',
      {
        body: { attemptId, questionTitle, answerRaw, userId, questionId },
      },
    )

    // Check for network/HTTP errors
    if (fnError) throw fnError

    // Check for business logic errors in response body
    if (
      !fnResponse ||
      fnResponse.status === 'failed' ||
      (fnResponse as Record<string, unknown>).error
    ) {
      const errorMsg =
        ((fnResponse as Record<string, unknown>)?.error as string | undefined) ||
        'AI processing failed on the server'
      throw new Error(errorMsg)
    }

    // Fetch the updated attempt with AI scores
    const { data: updatedAttempt, error: fetchError } = await supabase
      .from('attempts')
      .select('*')
      .eq('id', attemptId)
      .single()

    if (fetchError) throw fetchError

    aiFeedbackResult.value = updatedAttempt as Attempt
  } catch (err) {
    console.error('AI feedback processing failed', err)
    aiFeedbackError.value =
      err instanceof Error ? err.message : 'AI evaluation failed'
  } finally {
    isProcessingAi.value = false
  }
}

function advance() {
  showPostSubmission.value = false
  currentIndex.value++
}

// ── Timer feedback (adaptive timer with bounds) ────────────
async function sendTimerFeedback(feedback: TimerFeedback) {
  const question = currentQuestion.value
  if (!question || feedbackSent.value) return

  feedbackSent.value = true
  const newBase = adjustBaseTime(question.base_time_seconds, feedback)

  await supabase
    .from('questions')
    .update({ base_time_seconds: newBase })
    .eq('id', question.id)
}
</script>

<template>
  <!-- ── Session complete ───────────────────────────────── -->
  <div v-if="isSessionComplete" class="session-done">
    <div class="session-done__card">
      <div class="session-done__icon">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h2 class="session-done__title">Session Complete!</h2>
      <p class="session-done__subtitle">
        You answered {{ session.questions.length }} questions. Great work!
      </p>
      <div class="session-done__actions">
        <button
          class="session__btn session__btn--primary session__btn--touch"
          style="width: 100%;"
          @click="emit('session-complete')"
        >
          Done
        </button>
      </div>
    </div>
  </div>

  <!-- ── Active session ─────────────────────────────────── -->
  <div v-else-if="currentQuestion" class="session">
    <!-- Progress bar -->
    <SessionProgress
      :current="currentIndex"
      :total="session.questions.length"
      class="session__progress"
    />

    <!-- Main card -->
    <div class="session__card">
      <!-- Header: question + timer -->
      <div class="session__header">
        <h2 class="session__question">{{ currentQuestion.title }}</h2>

        <CircularTimer
          :total="currentQuestion.base_time_seconds"
          :remaining="secondsLeft"
          class="session__timer"
        />
      </div>

      <!-- Hint -->
      <p v-if="currentQuestion.hint" class="session__hint">
        💡 {{ currentQuestion.hint }}
      </p>

      <!-- Answer area -->
      <label for="answer-input" class="sr-only">Your answer</label>
      <textarea
        id="answer-input"
        v-model="answer"
        :readonly="isReadOnly"
        :placeholder="isReadOnly ? 'Time\'s up!' : 'Type your answer here…'"
        class="session__textarea"
        :class="{ 'session__textarea--locked': isReadOnly }"
        rows="6"
      />

      <!-- Actions (before submission) -->
      <div v-if="!showPostSubmission" class="session__actions">
        <button
          class="session__btn session__btn--primary"
          :disabled="isReadOnly || isSubmitting || !answer.trim()"
          @click="submit"
        >
          {{ isSubmitting ? 'Saving…' : 'Submit Answer' }}
        </button>
      </div>

      <!-- Post-submission: AI feedback + timer feedback + next -->
      <div v-if="showPostSubmission" class="session__post-submission">
        <!-- AI feedback section -->
        <div class="session__ai-section">
          <!-- Loading state -->
          <div v-if="isProcessingAi" class="session__ai-loading">
            <div class="session__ai-spinner" />
            <p class="session__ai-loading-text">Evaluating your answer…</p>
          </div>

          <!-- Error state -->
          <div v-else-if="aiFeedbackError" class="session__ai-error">
            <p class="session__ai-error-text">
              ⚠️ {{ aiFeedbackError }}
            </p>
          </div>

          <!-- Results -->
          <AiFeedback
            v-else-if="aiFeedbackResult"
            :attempt="aiFeedbackResult"
            :original-answer="submittedAnswer"
          />

          <!-- Empty answer (no AI to run) -->
          <p
            v-else-if="!submittedAnswer.trim()"
            class="session__ai-empty"
          >
            No answer submitted — AI evaluation skipped.
          </p>
        </div>

        <!-- Timer feedback -->
        <div class="session__feedback">
          <p class="session__feedback-label">How was the time limit?</p>
          <div class="session__feedback-buttons">
            <button
              class="session__btn session__btn--outline session__btn--touch"
              :disabled="feedbackSent"
              @click="sendTimerFeedback('too_short')"
            >
              ⏱ Too Short (+15 s)
            </button>
            <button
              class="session__btn session__btn--outline session__btn--touch"
              :disabled="feedbackSent"
              @click="sendTimerFeedback('too_long')"
            >
              ⏱ Too Long (−10 s)
            </button>
            <button
              class="session__btn session__btn--outline session__btn--touch"
              :disabled="feedbackSent"
              @click="sendTimerFeedback('just_right')"
            >
              ✓ Just Right
            </button>
          </div>
        </div>

        <!-- Next question -->
        <button
          class="session__btn session__btn--primary session__btn--touch session__btn--next"
          @click="advance"
        >
          Next Question →
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Utility ──────────────────────────────────────────────── */
.sr-only {
  position: absolute;
  width: 1px; height: 1px;
  margin: -1px; padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* ── Session layout ──────────────────────────────────────── */
.session {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 44rem;
  margin: 0 auto;
  /* safe-area-inset for notched / island phones */
  padding: calc(1rem + env(safe-area-inset-top))
           calc(1rem + env(safe-area-inset-right))
           calc(1rem + env(safe-area-inset-bottom))
           calc(1rem + env(safe-area-inset-left));

  @media (min-width: 640px) {
    padding: 2rem;
  }
}

.session__progress {
  flex-shrink: 0;
}

/* ── Card ─────────────────────────────────────────────────── */
.session__card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: #ffffff;
  border-radius: 1rem;
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.1), 0 1px 2px rgb(0 0 0 / 0.06);

  @media (min-width: 640px) {
    padding: 2rem;
  }
}

/* ── Header ───────────────────────────────────────────────── */
.session__header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;

  @media (min-width: 640px) {
    flex-direction: row;
    justify-content: space-between;
    align-items: flex-start;
  }
}

.session__question {
  font-size: 1.125rem;
  font-weight: 700;
  color: #111827;
  line-height: 1.4;
  flex: 1;

  @media (min-width: 640px) {
    font-size: 1.375rem;
  }
}

.session__timer {
  flex-shrink: 0;
}

/* ── Hint ─────────────────────────────────────────────────── */
.session__hint {
  font-size: 0.875rem;
  color: #6b7280;
  background: #f9fafb;
  border-left: 3px solid #3b82f6;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
}

/* ── Textarea ─────────────────────────────────────────────── */
.session__textarea {
  width: 100%;
  resize: vertical;
  min-height: 8rem;
  padding: 0.75rem 1rem;
  font-family: inherit;
  font-size: 1rem;
  line-height: 1.6;
  color: #1f2937;
  background: #f9fafb;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  outline: none;
  transition: border-color 0.2s ease, background-color 0.2s ease;

  @media (min-width: 640px) {
    min-height: 10rem;
  }
}

.session__textarea:focus {
  border-color: #3b82f6;
  background: #ffffff;
}

.session__textarea--locked {
  background: #f3f4f6;
  color: #9ca3af;
  cursor: not-allowed;
  border-color: #d1d5db;
}

/* ── Buttons ──────────────────────────────────────────────── */
.session__actions {
  display: flex;
  justify-content: flex-end;
}

.session__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* 44px minimum touch target (WCAG 2.5.5) */
  min-height: 2.75rem;
  padding: 0.625rem 1.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: 0.5rem;
  border: 2px solid transparent;
  cursor: pointer;
  transition: background-color 0.2s ease, opacity 0.2s ease;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation; /* prevent double-tap zoom on mobile */
}

.session__btn--touch {
  min-height: 3rem;
  padding: 0.75rem 1.25rem;
}

.session__btn--next {
  width: 100%;
  margin-top: 0.5rem;
}

.session__btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.session__btn--primary {
  background-color: #3b82f6;
  color: #ffffff;
}

.session__btn--primary:hover:not(:disabled) {
  background-color: #2563eb;
}

.session__btn--outline {
  background-color: transparent;
  color: #374151;
  border-color: #d1d5db;
}

.session__btn--outline:hover:not(:disabled) {
  background-color: #f3f4f6;
}

/* ── Post-submission section ───────────────────────────────── */
.session__post-submission {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid #e5e7eb;
}

.session__ai-section {
  min-height: 4rem;
}

/* AI loading spinner */
.session__ai-loading {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: #f0f9ff;
  border-radius: 0.75rem;
  border: 1px solid #bae6fd;
}

.session__ai-spinner {
  width: 1.25rem;
  height: 1.25rem;
  border: 2.5px solid #bae6fd;
  border-top-color: #0284c7;
  border-radius: 50%;
  animation: ai-spin 0.8s linear infinite;
  flex-shrink: 0;
}

@keyframes ai-spin {
  to { transform: rotate(360deg); }
}

.session__ai-loading-text {
  font-size: 0.875rem;
  color: #0c4a6e;
  font-weight: 500;
  margin: 0;
}

.session__ai-error {
  padding: 0.75rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.75rem;
}

.session__ai-error-text {
  font-size: 0.875rem;
  color: #991b1b;
  margin: 0;
}

.session__ai-empty {
  font-size: 0.875rem;
  color: #6b7280;
  font-style: italic;
  margin: 0;
  padding: 0.5rem 0;
}

/* ── Timer feedback ───────────────────────────────────────── */
.session__feedback {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid #e5e7eb;
}

.session__feedback-label {
  font-size: 0.8125rem;
  color: #6b7280;
  font-weight: 500;
}

.session__feedback-buttons {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
}

/* ── Session complete screen ──────────────────────────────── */
.session-done {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 1rem;
}

.session-done__card {
  text-align: center;
  background: #ffffff;
  border-radius: 1rem;
  padding: 2.5rem 2rem;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.1);
}

.session-done__title {
  font-size: 1.75rem;
  font-weight: 800;
  color: #111827;
  margin-bottom: 0.5rem;
}

.session-done__subtitle {
  font-size: 1rem;
  color: #6b7280;
}

.session-done__icon {
  display: flex;
  justify-content: center;
  margin-bottom: 1rem;
}

.session-done__actions {
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* ── Error details ───────────────────────────────────────── */
.error-details {
  text-align: left;
}

.error-msg {
  font-size: 0.875rem;
  color: #dc2626;
  background: #fee2e2;
  border: 1px solid #fecaca;
  border-radius: 0.375rem;
  padding: 0.75rem;
  margin-bottom: 1rem;
}

.error-steps {
  font-size: 0.875rem;
  color: #6b7280;
}

.error-steps strong {
  color: #111827;
}

.error-steps ol {
  margin: 0.5rem 0 0;
  padding-left: 1.5rem;
}

.error-steps li {
  margin: 0.75rem 0;
}

.error-steps code {
  background: #f3f4f6;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-family: monospace;
  font-size: 0.85em;
  color: #374151;
}
</style>
