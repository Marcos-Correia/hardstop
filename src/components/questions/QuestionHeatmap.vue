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
    <div v-else-if="store.questionMetricsArray.length === 0" class="flex-1 flex items-center justify-center px-6">
      <div class="text-center max-w-sm">
        <div class="rounded-full bg-gray-100 p-4 mx-auto mb-4 w-fit">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p class="text-sm text-gray-500">{{ $t('metrics.noAttempts') }}</p>
      </div>
    </div>

    <!-- Heatmap Grid -->
    <div v-else class="flex-1 overflow-y-auto p-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <div
          v-for="metric in store.questionMetricsArray"
          :key="metric.questionId"
          class="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden
                 hover:shadow-md transition-shadow cursor-pointer"
          @click="handleCardClick(metric.questionId)"
        >
          <!-- Color block with score -->
          <div
            class="relative flex items-center justify-center h-24"
            :class="scoreColorClass(metric.lastScore)"
          >
            <span class="text-3xl font-bold text-white drop-shadow-sm">
              {{ metric.lastScore }}%
            </span>
            <!-- Mastered badge -->
            <span
              v-if="metric.isMastered"
              class="absolute top-2 right-2 inline-flex items-center gap-0.5 rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold text-green-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {{ $t('metrics.mastered') }}
            </span>
          </div>

          <!-- Card body -->
          <div class="p-3">
            <!-- Question text -->
            <p
              class="text-sm font-medium text-gray-900 line-clamp-2 mb-1.5"
              :title="metric.questionText"
            >
              {{ metric.questionText }}
            </p>

            <!-- Category badge -->
            <span class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 mb-2">
              {{ metric.categoryName }}
            </span>

            <!-- Details row -->
            <div class="flex items-center justify-between text-xs text-gray-400">
              <span>{{ metric.attemptCount }} {{ metric.attemptCount === 1 ? 'attempt' : 'attempts' }}</span>
              <span :class="reviewCountdownClass(metric.nextReviewDate)">
                {{ reviewCountdownText(metric.nextReviewDate) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useQuestionsStore } from '@/stores/questions'
import type { QuestionId } from '@/types/database'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const store = useQuestionsStore()

const emit = defineEmits<{
  selectQuestion: [questionId: QuestionId]
}>()

onMounted(() => {
  store.calculateMetrics()
})

function scoreColorClass(score: number): string {
  if (score >= 85) return 'bg-green-500'
  if (score >= 60) return 'bg-yellow-500'
  return 'bg-red-500'
}

function reviewCountdownText(nextReview: Date | null): string {
  if (!nextReview) return ''
  const now = new Date()
  const diffDays = Math.ceil((nextReview.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return t('metrics.reviewNow')
  return t('metrics.dueInDays', { count: diffDays })
}

function reviewCountdownClass(nextReview: Date | null): string {
  if (!nextReview) return ''
  const now = new Date()
  const diffDays = Math.ceil((nextReview.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return 'text-red-500 font-semibold'
  if (diffDays <= 2) return 'text-yellow-600'
  return 'text-gray-400'
}

function handleCardClick(questionId: QuestionId) {
  emit('selectQuestion', questionId)
}
</script>
