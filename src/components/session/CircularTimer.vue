<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  /** Total seconds for this question */
  total: number
  /** Seconds remaining */
  remaining: number
}>()

const RADIUS = 54
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** Fraction of time elapsed: 0 → 1 */
const progress = computed(() =>
  props.total > 0 ? 1 - props.remaining / props.total : 1,
)

/** SVG stroke-dashoffset drives the arc */
const dashOffset = computed(() => CIRCUMFERENCE * (1 - progress.value))

/** Human-readable mm:ss */
const display = computed(() => {
  const clamped = Math.max(0, props.remaining)
  const m = Math.floor(clamped / 60)
  const s = clamped % 60
  return `${m}:${s.toString().padStart(2, '0')}`
})

/** Colour shifts as time runs low */
const strokeColour = computed(() => {
  if (props.remaining <= 10) return '#ef4444'  // red-500
  if (props.remaining <= 30) return '#f59e0b'  // amber-500
  return '#3b82f6'                              // blue-500
})
</script>

<template>
  <div class="circular-timer" role="timer" :aria-label="`${display} remaining`">
    <svg
      viewBox="0 0 120 120"
      class="circular-timer__svg"
    >
      <!-- Background track -->
      <circle
        cx="60" cy="60" :r="RADIUS"
        fill="none"
        stroke="currentColor"
        class="circular-timer__track"
        stroke-width="8"
      />
      <!-- Animated arc -->
      <circle
        cx="60" cy="60" :r="RADIUS"
        fill="none"
        :stroke="strokeColour"
        stroke-width="8"
        stroke-linecap="round"
        :stroke-dasharray="CIRCUMFERENCE"
        :stroke-dashoffset="dashOffset"
        class="circular-timer__arc"
      />
    </svg>

    <span class="circular-timer__label" :class="{ 'circular-timer__label--danger': remaining <= 10 }">
      {{ display }}
    </span>
  </div>
</template>

<style scoped>
.circular-timer {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 7rem;
  height: 7rem;

  @media (min-width: 640px) {
    width: 9rem;
    height: 9rem;
  }
}

.circular-timer__svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.circular-timer__track {
  color: var(--color-track, #e5e7eb); /* gray-200 */
  opacity: 0.3;
}

.circular-timer__arc {
  transition: stroke-dashoffset 0.4s ease, stroke 0.3s ease;
}

.circular-timer__label {
  position: absolute;
  font-variant-numeric: tabular-nums;
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937; /* gray-800 */

  @media (min-width: 640px) {
    font-size: 2rem;
  }
}

.circular-timer__label--danger {
  color: #ef4444;
  animation: pulse-text 1s ease-in-out infinite;
}

@keyframes pulse-text {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.5; }
}
</style>
