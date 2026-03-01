<template>
  <div class="flex flex-col h-full">
    <!-- Loading State -->
    <div v-if="store.metricsLoading" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <div class="animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent mx-auto mb-4"></div>
        <p class="text-sm text-gray-500">{{ $t('metrics.loading') }}</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="store.metricsError" class="flex-1 flex items-center justify-center px-6">
      <div class="text-center max-w-sm">
        <div class="rounded-full bg-red-100 p-4 mx-auto mb-4 w-fit">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <p class="text-sm text-red-600 mb-4">{{ store.metricsError }}</p>
        <button
          class="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white
                 hover:bg-indigo-500 min-h-[44px]"
          @click="store.calculateMetrics(true)"
        >
          {{ $t('common.retry') }}
        </button>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="store.categoryMetricsArray.length === 0" class="flex-1 flex items-center justify-center px-6">
      <div class="text-center max-w-sm">
        <div class="rounded-full bg-gray-100 p-4 mx-auto mb-4 w-fit">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p class="text-sm text-gray-500">{{ $t('metrics.noAttempts') }}</p>
      </div>
    </div>

    <!-- Category Progress List -->
    <div v-else class="flex-1 overflow-y-auto p-4">
      <!-- Interview Readiness Indicator -->
      <div class="rounded-xl border p-4 mb-6" :class="readinessBorderClass">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-semibold text-gray-900">{{ $t('metrics.interviewReadiness') }}</h3>
          <span class="text-lg font-bold" :class="readinessTextClass">
            {{ $t('metrics.readinessScore', { score: store.readinessScore }) }}
          </span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-3">
          <div
            class="h-3 rounded-full transition-all duration-500"
            :class="readinessBarClass"
            :style="{ width: `${Math.min(store.readinessScore, 100)}%` }"
          ></div>
        </div>
      </div>

      <!-- Category cards -->
      <div class="flex flex-col gap-6">
        <div
          v-for="metric in store.categoryMetricsArray"
          :key="metric.categoryId"
          class="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
        >
          <!-- Header row -->
          <button
            class="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors min-h-[44px]"
            @click="toggleExpand(metric.categoryId)"
          >
            <span class="text-sm font-semibold text-gray-900 truncate">{{ metric.categoryName }}</span>
            <div class="flex items-center gap-2 shrink-0">
              <span class="text-sm font-bold" :class="masteryTextClass(metric.masteryPercentage)">
                {{ metric.masteryPercentage }}% {{ $t('metrics.mastered') }}
              </span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4 text-gray-400 transition-transform duration-200"
                :class="{ 'rotate-180': expandedCategories.has(metric.categoryId) }"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          <!-- Progress bar -->
          <div class="px-4 pb-2">
            <div class="w-full bg-gray-200 rounded-full h-3">
              <div
                class="h-3 rounded-full transition-all duration-500"
                :class="masteryBarClass(metric.masteryPercentage)"
                :style="{ width: `${Math.min(metric.masteryPercentage, 100)}%` }"
              ></div>
            </div>
          </div>

          <!-- Details row -->
          <div class="flex items-center justify-between px-4 pb-3 text-xs text-gray-500">
            <span>{{ $t('metrics.xOfYMastered', { completed: metric.masteredCount, total: metric.questionCount }) }}</span>
            <span>{{ $t('metrics.averageScore', { score: metric.averageScore }) }}</span>
            <span :class="countdownClass(metric.nextReviewCountdown)">
              {{ countdownText(metric.nextReviewCountdown) }}
            </span>
          </div>

          <!-- Expandable question list -->
          <div
            v-if="expandedCategories.has(metric.categoryId)"
            class="border-t border-gray-100 divide-y divide-gray-50"
          >
            <div
              v-for="qm in questionsInCategory(metric.categoryId)"
              :key="qm.questionId"
              class="flex items-center px-4 py-2.5 hover:bg-gray-50"
            >
              <!-- Score indicator dot -->
              <span
                class="h-3 w-3 rounded-full shrink-0 mr-3"
                :class="dotColorClass(qm.lastScore)"
              ></span>
              <span class="flex-1 text-sm text-gray-700 truncate" :title="qm.questionText">
                {{ qm.questionText }}
              </span>
              <div class="flex items-center gap-3 shrink-0 ml-2">
                <span class="text-xs font-semibold" :class="scoreTextClass(qm.lastScore)">
                  {{ qm.lastScore }}%
                </span>
                <span v-if="qm.isMastered" class="text-green-500">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              </div>
            </div>
            <div v-if="questionsInCategory(metric.categoryId).length === 0" class="px-4 py-3 text-xs text-gray-400 text-center">
              {{ $t('metrics.noAttempts') }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useQuestionsStore } from '@/stores/questions'
import type { CategoryId } from '@/types/database'
import type { QuestionMetric } from '@/stores/questions'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const store = useQuestionsStore()

const expandedCategories = ref<Set<CategoryId>>(new Set())

onMounted(() => {
  store.calculateMetrics()
})

function toggleExpand(categoryId: CategoryId) {
  if (expandedCategories.value.has(categoryId)) {
    expandedCategories.value.delete(categoryId)
  } else {
    expandedCategories.value.add(categoryId)
  }
  // Trigger reactivity
  expandedCategories.value = new Set(expandedCategories.value)
}

function questionsInCategory(categoryId: CategoryId): QuestionMetric[] {
  return store.questionMetricsArray.filter((q) => q.categoryId === categoryId)
}

// ── Style helpers ─────────────────────────────────────────

function masteryBarClass(pct: number): string {
  if (pct >= 85) return 'bg-green-500'
  if (pct >= 50) return 'bg-yellow-500'
  return 'bg-red-500'
}

function masteryTextClass(pct: number): string {
  if (pct >= 85) return 'text-green-600'
  if (pct >= 50) return 'text-yellow-600'
  return 'text-red-600'
}

function dotColorClass(score: number): string {
  if (score >= 85) return 'bg-green-500'
  if (score >= 60) return 'bg-yellow-500'
  return 'bg-red-500'
}

function scoreTextClass(score: number): string {
  if (score >= 85) return 'text-green-600'
  if (score >= 60) return 'text-yellow-600'
  return 'text-red-600'
}

function countdownText(days: number): string {
  if (days <= 0) return t('metrics.reviewNow')
  return t('metrics.dueInDays', { count: days })
}

function countdownClass(days: number): string {
  if (days <= 0) return 'text-red-500 font-semibold'
  if (days <= 2) return 'text-yellow-600'
  return 'text-gray-500'
}

const readinessBorderClass = computed(() => {
  const s = store.readinessScore
  if (s >= 85) return 'border-green-300 bg-green-50'
  if (s >= 50) return 'border-yellow-300 bg-yellow-50'
  return 'border-red-300 bg-red-50'
})

const readinessTextClass = computed(() => {
  const s = store.readinessScore
  if (s >= 85) return 'text-green-600'
  if (s >= 50) return 'text-yellow-600'
  return 'text-red-600'
})

const readinessBarClass = computed(() => {
  const s = store.readinessScore
  if (s >= 85) return 'bg-green-500'
  if (s >= 50) return 'bg-yellow-500'
  return 'bg-red-500'
})
</script>
