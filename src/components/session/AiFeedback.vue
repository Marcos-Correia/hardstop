<script setup lang="ts">
import { computed } from 'vue'
import type { Attempt } from '@/types/database'

const props = defineProps<{
  attempt: Attempt
  originalAnswer: string
}>()

/** True when the corrected answer differs from the raw answer */
const hasCorrectedAnswer = computed(
  () =>
    !!props.attempt.answer_clean &&
    props.attempt.answer_clean.trim() !== props.originalAnswer.trim(),
)

/** Format a 0-1 score as a percentage string */
function pct(score: number | null): string {
  if (score === null || score === undefined) return '—'
  return `${Math.round(score * 100)}%`
}

/** Map a 0-1 score to a Tailwind color class for the bar */
function barColor(score: number | null): string {
  if (score === null) return 'bg-gray-300'
  if (score >= 0.85) return 'bg-green-500'
  if (score >= 0.6) return 'bg-yellow-500'
  return 'bg-red-500'
}

/** Map a 0-1 score to a label color */
function labelColor(score: number | null): string {
  if (score === null) return 'text-gray-400'
  if (score >= 0.85) return 'text-green-700'
  if (score >= 0.6) return 'text-yellow-700'
  return 'text-red-700'
}

const scores = computed(() => [
  {
    label: 'Fluency',
    description: 'Clarity, grammar, natural flow',
    value: props.attempt.fluency_score,
    icon: '🗣️',
  },
  {
    label: 'STAR Method',
    description: 'Situation / Task / Action / Result',
    value: props.attempt.star_score,
    icon: '⭐',
  },
  {
    label: 'Conciseness',
    description: 'No filler, stays on topic',
    value: props.attempt.conciseness_score,
    icon: '✂️',
  },
])
</script>

<template>
  <div class="ai-feedback">
    <h3 class="ai-feedback__title">AI Feedback</h3>

    <!-- ── Scores (compact horizontal row) ─────────────── -->
    <div class="ai-feedback__scores">
      <div
        v-for="s in scores"
        :key="s.label"
        class="ai-feedback__score-cell"
      >
        <div class="ai-feedback__score-header">
          <span class="ai-feedback__score-icon">{{ s.icon }}</span>
          <span class="ai-feedback__score-label">{{ s.label }}</span>
        </div>
        <div class="ai-feedback__bar-track">
          <div
            class="ai-feedback__bar-fill"
            :class="barColor(s.value)"
            :style="{ width: s.value !== null ? `${s.value * 100}%` : '0%' }"
          />
        </div>
        <span
          class="ai-feedback__score-value"
          :class="labelColor(s.value)"
        >
          {{ pct(s.value) }}
        </span>
      </div>
    </div>

    <!-- ── AI feedback text (inline) ───────────────────── -->
    <p v-if="attempt.ai_feedback" class="ai-feedback__text-body">
      <strong class="ai-feedback__text-label">Coach: </strong>{{ attempt.ai_feedback }}
    </p>

    <!-- ── Corrected answer (collapsible) ──────────────── -->
    <details v-if="hasCorrectedAnswer" class="ai-feedback__corrected">
      <summary class="ai-feedback__corrected-toggle">View corrected answer</summary>
      <p class="ai-feedback__corrected-body">{{ attempt.answer_clean }}</p>
    </details>
  </div>
</template>

<style scoped>
.ai-feedback {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  padding: 0.75rem;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 0.75rem;
}

.ai-feedback__title {
  font-size: 0.8125rem;
  font-weight: 700;
  color: #0c4a6e;
  margin: 0;
}

/* ── Scores: horizontal 3-column grid ─────────────────── */
.ai-feedback__scores {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.ai-feedback__score-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
}

.ai-feedback__score-header {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.ai-feedback__score-icon {
  font-size: 0.75rem;
  line-height: 1;
}

.ai-feedback__score-label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: #1e293b;
}

.ai-feedback__score-value {
  font-size: 0.75rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.ai-feedback__bar-track {
  width: 100%;
  height: 0.25rem;
  background: #e2e8f0;
  border-radius: 9999px;
  overflow: hidden;
}

.ai-feedback__bar-fill {
  height: 100%;
  border-radius: 9999px;
  transition: width 0.6s ease;
}

/* ── Feedback text (inline) ─────────────────────────────── */
.ai-feedback__text-label {
  font-weight: 600;
  color: #0369a1;
}

.ai-feedback__text-body {
  font-size: 0.8125rem;
  color: #334155;
  line-height: 1.5;
  margin: 0;
}

/* ── Corrected answer (collapsible) ─────────────────────── */
.ai-feedback__corrected {
  border-radius: 0.375rem;
  border: 1px solid #bbf7d0;
  background: #ffffff;
  overflow: hidden;
}

.ai-feedback__corrected-toggle {
  font-size: 0.75rem;
  font-weight: 600;
  color: #15803d;
  cursor: pointer;
  padding: 0.375rem 0.5rem;
  user-select: none;
}

.ai-feedback__corrected-body {
  font-size: 0.8125rem;
  color: #334155;
  line-height: 1.5;
  margin: 0;
  padding: 0 0.5rem 0.5rem;
  white-space: pre-wrap;
  max-height: 6rem;
  overflow-y: auto;
}
</style>
