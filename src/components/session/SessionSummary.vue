<script setup lang="ts">
import { computed } from 'vue'
import type { SessionSummaryData } from '@/stores/analytics'
import type { Attempt, Question } from '@/types/database'

const { summaryData } = defineProps<{
  summaryData: SessionSummaryData
}>()

const emit = defineEmits<{
  'review-answers': []
  'new-session': []
  'back-to-dashboard': []
}>()

/**
 * Format a 0-1 score as a percentage with appropriate color
 */
function formatScore(score: number | null): string {
  if (score === null || score === undefined) return '—'
  return `${Math.round(score * 100)}%`
}

/**
 * Determine Tailwind color class based on score
 */
function scoreColor(score: number | null): string {
  if (score === null) return 'bg-gray-200'
  if (score >= 0.85) return 'bg-green-500'
  if (score >= 0.6) return 'bg-yellow-500'
  return 'bg-red-500'
}

/**
 * Determine text color class based on score
 */
function scoreTextColor(score: number | null): string {
  if (score === null) return 'text-gray-500'
  if (score >= 0.85) return 'text-green-700'
  if (score >= 0.6) return 'text-yellow-700'
  return 'text-red-700'
}

/**
 * Calculate percentage of time used vs allocated
 */
function timePercentage(spent: number, allocated: number): number {
  if (allocated === 0) return 0
  return (spent / allocated) * 100
}

/**
 * Format seconds to mm:ss format
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Compute an overall score as average of the three metric scores
 */
function computeOverallScore(attempt: Attempt): number | null {
  const scores = [
    attempt.fluency_score,
    attempt.star_score,
    attempt.conciseness_score,
  ].filter((s: number | null) => s !== null)

  if (scores.length === 0) return null
  return scores.reduce((a: number, b: number) => a + b, 0) / scores.length
}

/**
 * Get the question title for an attempt
 */
function getQuestionTitle(questionId: string): string {
  const question = Array.from(
    summaryData.questionDetails.values()
  ).find((q: Question) => q.id === questionId)
  return question?.title || 'Unknown Question'
}

/**
 * Determine if the session has any AI scores available
 */
const hasScores = computed(() => {
  return summaryData.attemptDetails.some(
    (a) =>
      a.fluency_score !== null &&
      a.star_score !== null &&
      a.conciseness_score !== null,
  )
})

/**
 * Build list of questions answered with their scores and times
 */
const questionBreakdown = computed(() => {
  return summaryData.attemptDetails.map((attempt) => {
    const timeMetric = summaryData.timeMetrics.perQuestionBreakdown.find(
      (m) => m.questionId === attempt.question_id,
    )
    return {
      attempt,
      timeMetric,
      questionTitle: getQuestionTitle(attempt.question_id),
    }
  })
})
</script>

<template>
  <div class="session-summary">
    <!-- Header -->
    <div class="session-summary__header">
      <div class="session-summary__header-icon">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-12 w-12 text-green-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h1 class="session-summary__title">{{ $t('summary.title') }}</h1>
      <p class="session-summary__subtitle">
        {{ $t('summary.questionsAnswered', {
          count: summaryData.totalQuestionsAnswered,
        }) }}
      </p>
    </div>

    <!-- Processing indicator -->
    <div
      v-if="summaryData.hasProcessingAttempts"
      class="session-summary__processing-banner"
    >
      <div class="session-summary__spinner" />
      <span class="session-summary__processing-text">
        {{ $t('summary.processingFeedback') }}
      </span>
    </div>

    <!-- Scores section -->
    <div class="session-summary__section">
      <h2 class="session-summary__section-title">
        {{ $t('summary.averageScores') }}
      </h2>

      <!-- Show message if no scores yet -->
      <div v-if="!hasScores" class="session-summary__no-scores">
        <p>{{ $t('summary.noScoresYet') }}</p>
      </div>

      <!-- Score cards -->
      <div v-else class="session-summary__scores-grid">
        <!-- Fluency -->
        <div class="session-summary__score-card">
          <div class="session-summary__score-icon">🗣️</div>
          <h3 class="session-summary__score-label">
            {{ $t('history.fluency') }}
          </h3>
          <div
            class="session-summary__score-percentage"
            :class="scoreTextColor(summaryData.averageScores.fluency)"
          >
            {{ formatScore(summaryData.averageScores.fluency) }}
          </div>
          <div class="session-summary__score-bar">
            <div
              :class="scoreColor(summaryData.averageScores.fluency)"
              :style="{
                width:
                  summaryData.averageScores.fluency !== null
                    ? `${summaryData.averageScores.fluency * 100}%`
                    : '0%',
              }"
            />
          </div>
        </div>

        <!-- STAR Score -->
        <div class="session-summary__score-card">
          <div class="session-summary__score-icon">⭐</div>
          <h3 class="session-summary__score-label">
            {{ $t('summary.starScore') }}
          </h3>
          <div
            class="session-summary__score-percentage"
            :class="scoreTextColor(summaryData.averageScores.star)"
          >
            {{ formatScore(summaryData.averageScores.star) }}
          </div>
          <div class="session-summary__score-bar">
            <div
              :class="scoreColor(summaryData.averageScores.star)"
              :style="{
                width:
                  summaryData.averageScores.star !== null
                    ? `${summaryData.averageScores.star * 100}%`
                    : '0%',
              }"
            />
          </div>
        </div>

        <!-- Conciseness -->
        <div class="session-summary__score-card">
          <div class="session-summary__score-icon">✂️</div>
          <h3 class="session-summary__score-label">
            {{ $t('summary.conciseness') }}
          </h3>
          <div
            class="session-summary__score-percentage"
            :class="scoreTextColor(summaryData.averageScores.conciseness)"
          >
            {{ formatScore(summaryData.averageScores.conciseness) }}
          </div>
          <div class="session-summary__score-bar">
            <div
              :class="scoreColor(summaryData.averageScores.conciseness)"
              :style="{
                width:
                  summaryData.averageScores.conciseness !== null
                    ? `${summaryData.averageScores.conciseness * 100}%`
                    : '0%',
              }"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Time breakdown section -->
    <div class="session-summary__section">
      <h2 class="session-summary__section-title">
        {{ $t('summary.timeBreakdown') }}
      </h2>
      <div class="session-summary__time-stats">
        <div class="session-summary__time-stat">
          <span class="session-summary__time-label">
            {{ $t('summary.totalTimeSpent') }}
          </span>
          <span class="session-summary__time-value">
            {{ formatTime(summaryData.timeMetrics.totalTimeSpent) }}
          </span>
        </div>
        <div class="session-summary__time-stat">
          <span class="session-summary__time-label">
            {{ $t('summary.totalTimeAllocated') }}
          </span>
          <span class="session-summary__time-value">
            {{ formatTime(summaryData.timeMetrics.totalTimeAllocated) }}
          </span>
        </div>
      </div>
    </div>

    <!-- Per-question breakdown table (desktop) / cards (mobile) -->
    <div class="session-summary__section">
      <h2 class="session-summary__section-title">
        {{ $t('summary.questionBreakdown') }}
      </h2>

      <!-- Desktop table -->
      <div class="session-summary__table-wrapper">
        <table class="session-summary__table">
          <thead>
            <tr>
              <th>{{ $t('history.question') }}</th>
              <th class="session-summary__table-center">
                {{ $t('summary.timeSpent') }}
              </th>
              <th class="session-summary__table-center">
                {{ $t('summary.timeAllocated') }}
              </th>
              <th class="session-summary__table-center">
                {{ $t('summary.usage') }}
              </th>
              <th class="session-summary__table-center">
                {{ $t('summary.overallScore') }}
              </th>
              <th class="session-summary__table-center">
                {{ $t('history.status') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, idx) in questionBreakdown"
              :key="idx"
              class="session-summary__table-row"
            >
              <td class="session-summary__table-question">
                <span class="session-summary__question-badge">
                  {{ idx + 1 }}
                </span>
                {{ row.questionTitle }}
              </td>
              <td class="session-summary__table-center">
                {{
                  row.timeMetric
                    ? formatTime(row.timeMetric.timeSpent)
                    : '—'
                }}
              </td>
              <td class="session-summary__table-center">
                {{
                  row.timeMetric
                    ? formatTime(row.timeMetric.timeAllocated)
                    : '—'
                }}
              </td>
              <td class="session-summary__table-center">
                <div class="session-summary__progress-bar">
                  {{
                    row.timeMetric
                      ? `${timePercentage(row.timeMetric.timeSpent, row.timeMetric.timeAllocated).toFixed(0)}%`
                      : '—'
                  }}
                </div>
              </td>
              <td class="session-summary__table-center">
                <span
                  :class="scoreTextColor(computeOverallScore(row.attempt))"
                  class="session-summary__score-badge"
                >
                  {{ formatScore(computeOverallScore(row.attempt)) }}
                </span>
              </td>
              <td class="session-summary__table-center">
                <span
                  v-if="
                    row.attempt.processing_status === 'pending'
                  "
                  class="session-summary__status-badge session-summary__status-badge--pending"
                >
                  ⏳ {{ $t('summary.pending') }}
                </span>
                <span
                  v-else-if="
                    row.attempt.processing_status === 'failed'
                  "
                  class="session-summary__status-badge session-summary__status-badge--failed"
                >
                  ❌ {{ $t('summary.failed') }}
                </span>
                <span
                  v-else
                  class="session-summary__status-badge session-summary__status-badge--complete"
                >
                  ✓ {{ $t('summary.complete') }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Action buttons -->
    <div class="session-summary__actions">
      <button
        class="session-summary__btn session-summary__btn--secondary"
        @click="emit('back-to-dashboard')"
      >
        {{ $t('summary.backToDashboard') }}
      </button>
      <button
        class="session-summary__btn session-summary__btn--secondary"
        :disabled="true"
        title="Review feature coming soon (P2)"
      >
        {{ $t('summary.reviewAnswers') }}
      </button>
      <button
        class="session-summary__btn session-summary__btn--primary"
        @click="emit('new-session')"
      >
        {{ $t('summary.newSession') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
/* ── Layout ─────────────────────────────────────────────── */
.session-summary {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 56rem;
  margin: 0 auto;
  padding: calc(0.75rem + env(safe-area-inset-top))
    calc(0.75rem + env(safe-area-inset-right))
    calc(0.75rem + env(safe-area-inset-bottom))
    calc(0.75rem + env(safe-area-inset-left));
  max-height: 100vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;

  @media (min-width: 640px) {
    padding: 2rem;
    gap: 1.5rem;
  }
}

/* ── Header ─────────────────────────────────────────────── */
.session-summary__header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 1rem;
}

.session-summary__header-icon {
  display: flex;
  justify-content: center;
}

.session-summary__title {
  font-size: 1.875rem;
  font-weight: 800;
  color: #111827;

  @media (min-width: 640px) {
    font-size: 2.25rem;
  }
}

.session-summary__subtitle {
  font-size: 1.125rem;
  color: #6b7280;
  margin: 0;
}

/* ── Processing banner ──────────────────────────────────── */
.session-summary__processing-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 0.75rem;
}

.session-summary__spinner {
  width: 1.25rem;
  height: 1.25rem;
  border: 2.5px solid #bae6fd;
  border-top-color: #0284c7;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.session-summary__processing-text {
  font-size: 0.875rem;
  color: #0c4a6e;
  font-weight: 500;
}

/* ── Section ────────────────────────────────────────────── */
.session-summary__section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: #ffffff;
  border-radius: 0.75rem;
  padding: 1rem;
  border: 1px solid #e5e7eb;

  @media (min-width: 640px) {
    gap: 1rem;
    padding: 1.5rem;
    border-radius: 1rem;
  }
}

.session-summary__section-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: #111827;
  margin: 0 0 0.5rem;
}

/* ── Scores section ─────────────────────────────────────── */
.session-summary__no-scores {
  padding: 2rem 1rem;
  text-align: center;
  background: #f9fafb;
  border-radius: 0.75rem;
}

.session-summary__no-scores p {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0;
}

.session-summary__scores-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;

  @media (min-width: 640px) {
    grid-template-columns: repeat(3, 1fr);
  }
}

.session-summary__score-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 0.75rem;
  background: #f9fafb;
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;

  @media (min-width: 640px) {
    gap: 0.75rem;
    padding: 1.25rem 1rem;
  }
}

.session-summary__score-icon {
  font-size: 2rem;

  @media (min-width: 640px) {
    font-size: 2.5rem;
  }
}

.session-summary__score-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #6b7280;
  margin: 0;
  text-align: center;
}

.session-summary__score-percentage {
  font-size: 1.375rem;
  font-weight: 800;

  @media (min-width: 640px) {
    font-size: 1.75rem;
  }
}

.session-summary__score-bar {
  width: 100%;
  height: 0.5rem;
  background: #e5e7eb;
  border-radius: 9999px;
  overflow: hidden;
}

.session-summary__score-bar > div {
  height: 100%;
  border-radius: 9999px;
  transition: width 0.3s ease;
}

/* ── Time stats ─────────────────────────────────────────── */
.session-summary__time-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.session-summary__time-stat {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: #f9fafb;
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;

  @media (min-width: 640px) {
    padding: 1rem;
  }
}

.session-summary__time-label {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.session-summary__time-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #111827;
}

/* ── Table ──────────────────────────────────────────────– */
.session-summary__table-wrapper {
  overflow-x: auto;
}

.session-summary__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.session-summary__table thead {
  background: #f9fafb;
  border-bottom: 2px solid #e5e7eb;
}

.session-summary__table th {
  padding: 0.75rem;
  text-align: left;
  font-weight: 600;
  color: #6b7280;
  white-space: nowrap;
}

.session-summary__table-center {
  text-align: center;
}

.session-summary__table-row {
  border-bottom: 1px solid #e5e7eb;
  transition: background-color 0.2s ease;
}

.session-summary__table-row:hover {
  background-color: #f9fafb;
}

.session-summary__table-row td {
  padding: 0.75rem;
}

.session-summary__table-question {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: #111827;
}

.session-summary__question-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.75rem;
  height: 1.75rem;
  background: #e0e7ff;
  color: #4f46e5;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 600;
  flex-shrink: 0;
}

.session-summary__progress-bar {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #374151;
}

.session-summary__score-badge {
  display: inline-block;
  min-width: 3rem;
  text-align: center;
  font-weight: 700;
}

.session-summary__status-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.session-summary__status-badge--pending {
  background: #fef3c7;
  color: #92400e;
}

.session-summary__status-badge--complete {
  background: #d1fae5;
  color: #065f46;
}

.session-summary__status-badge--failed {
  background: #fee2e2;
  color: #991b1b;
}

/* ── Actions ────────────────────────────────────────────── */
.session-summary__actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  position: sticky;
  bottom: 0;
  background: #ffffff;
  padding: 0.75rem 0;

  @media (min-width: 640px) {
    flex-direction: row;
    justify-content: flex-end;
    gap: 0.75rem;
  }
}

.session-summary__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.75rem;
  padding: 0.625rem 1.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: 0.5rem;
  border: 2px solid transparent;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  flex: 1;

  @media (min-width: 640px) {
    flex: 0 1 auto;
  }
}

.session-summary__btn:hover {
  opacity: 0.9;
}

.session-summary__btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.session-summary__btn--primary {
  background-color: #4f46e5;
  color: #ffffff;
}

.session-summary__btn--primary:hover:not(:disabled) {
  background-color: #4338ca;
}

.session-summary__btn--secondary {
  background-color: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
}

.session-summary__btn--secondary:hover:not(:disabled) {
  background-color: #e5e7eb;
}
</style>
