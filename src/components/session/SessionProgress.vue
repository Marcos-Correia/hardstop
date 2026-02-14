<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  /** 0-based index of the current question */
  current: number
  /** Total questions in the session */
  total: number
}>()

const percentage = computed(() =>
  props.total > 0 ? ((props.current + 1) / props.total) * 100 : 0,
)
</script>

<template>
  <div class="session-progress">
    <div class="session-progress__info">
      <span class="session-progress__counter">
        Question {{ current + 1 }} / {{ total }}
      </span>
      <span class="session-progress__pct">{{ Math.round(percentage) }}%</span>
    </div>

    <div
      class="session-progress__track"
      role="progressbar"
      :aria-valuenow="current + 1"
      :aria-valuemin="1"
      :aria-valuemax="total"
    >
      <div
        class="session-progress__fill"
        :style="{ width: `${percentage}%` }"
      />
      <!-- Step dots -->
      <div class="session-progress__dots">
        <span
          v-for="i in total"
          :key="i"
          class="session-progress__dot"
          :class="{
            'session-progress__dot--done': i - 1 < current,
            'session-progress__dot--active': i - 1 === current,
          }"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.session-progress {
  width: 100%;
}

.session-progress__info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280; /* gray-500 */
}

.session-progress__track {
  position: relative;
  width: 100%;
  height: 0.5rem;
  border-radius: 9999px;
  background-color: #e5e7eb; /* gray-200 */
  overflow: hidden;
}

.session-progress__fill {
  height: 100%;
  border-radius: 9999px;
  background-color: #3b82f6; /* blue-500 */
  transition: width 0.4s ease;
}

.session-progress__dots {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2px;
}

.session-progress__dot {
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 9999px;
  background-color: #d1d5db; /* gray-300 */
  transition: background-color 0.3s ease, transform 0.3s ease;
  flex-shrink: 0;
}

.session-progress__dot--done {
  background-color: #ffffff;
}

.session-progress__dot--active {
  background-color: #ffffff;
  transform: scale(1.4);
  box-shadow: 0 0 0 2px #3b82f6;
}
</style>
