<template>
  <div class="h-full flex flex-col overflow-hidden bg-gray-50 safe-area-horizontal">
    <!-- Header -->
    <div class="shrink-0 bg-white border-b border-gray-200 px-6 py-4">
      <h2 class="text-2xl font-bold text-gray-900">{{ $t('history.title') || 'Practice History' }}</h2>
      <p class="mt-1 text-sm text-gray-500">
        {{ $t('history.subtitle') || 'Review past attempts and track your improvement' }}
      </p>
    </div>

    <!-- Content area -->
    <div class="flex-1 overflow-auto flex flex-col">
      <!-- Loading state -->
      <div v-if="isLoading" class="flex-1 flex items-center justify-center">
        <div class="text-center">
          <div class="animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent mx-auto mb-4"></div>
          <p class="text-sm text-gray-500">{{ $t('common.loading') || 'Loading...' }}</p>
        </div>
      </div>

      <!-- Error state -->
      <div v-else-if="error" class="flex-1 flex items-center justify-center px-6">
        <div class="text-center max-w-sm">
          <div class="rounded-full bg-red-100 p-4 mx-auto mb-4 w-fit">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 class="text-lg font-bold text-gray-900 mb-2">{{ $t('common.error') || 'Error' }}</h3>
          <p class="text-sm text-red-600 mb-4">{{ error }}</p>
          <button
            class="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 min-h-[44px]"
            @click="retryFetch"
          >
            {{ $t('common.retry') || 'Try Again' }}
          </button>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else-if="filteredAttempts.length === 0" class="flex-1 flex items-center justify-center px-6">
        <div class="text-center max-w-sm">
          <div class="rounded-full bg-amber-100 p-4 mx-auto mb-4 w-fit">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <h3 class="text-lg font-bold text-gray-900 mb-2">{{ $t('history.empty') || 'No attempts yet' }}</h3>
          <p class="text-sm text-gray-500">{{ $t('history.emptyDesc') || 'Start a practice session to record your first attempt.' }}</p>
        </div>
      </div>

      <!-- Main content -->
      <template v-else>
        <!-- Stats cards -->
        <div class="shrink-0 px-6 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- Total attempts -->
          <div class="rounded-lg bg-white p-4 border border-gray-200 shadow-sm">
            <p class="text-sm font-medium text-gray-500">{{ $t('history.totalAttempts') || 'Total Attempts' }}</p>
            <p class="mt-2 text-3xl font-bold text-gray-900">{{ stats.totalAttempts }}</p>
            <p class="mt-1 text-xs text-gray-500" v-if="stats.completedCount">
              {{ stats.completedCount }} {{ $t('history.completed') || 'completed' }}
            </p>
          </div>

          <!-- Average fluency -->
          <div class="rounded-lg bg-white p-4 border border-gray-200 shadow-sm">
            <p class="text-sm font-medium text-gray-500">{{ $t('history.avgFluency') || 'Avg Fluency' }}</p>
            <p class="mt-2 text-3xl font-bold text-indigo-600">{{ formatScore(stats.averageFluency) }}%</p>
            <div class="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div class="bg-indigo-600 h-2 rounded-full" :style="{ width: (stats.averageFluency * 100) + '%' }"></div>
            </div>
          </div>

          <!-- Average STAR score -->
          <div class="rounded-lg bg-white p-4 border border-gray-200 shadow-sm">
            <p class="text-sm font-medium text-gray-500">{{ $t('history.avgStar') || 'Avg STAR Score' }}</p>
            <p class="mt-2 text-3xl font-bold text-blue-600">{{ formatScore(stats.averageStar) }}%</p>
            <div class="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div class="bg-blue-600 h-2 rounded-full" :style="{ width: (stats.averageStar * 100) + '%' }"></div>
            </div>
          </div>

          <!-- Average conciseness -->
          <div class="rounded-lg bg-white p-4 border border-gray-200 shadow-sm">
            <p class="text-sm font-medium text-gray-500">{{ $t('history.avgConciseness') || 'Avg Conciseness' }}</p>
            <p class="mt-2 text-3xl font-bold text-green-600">{{ formatScore(stats.averageConciseness) }}%</p>
            <div class="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div class="bg-green-600 h-2 rounded-full" :style="{ width: (stats.averageConciseness * 100) + '%' }"></div>
            </div>
          </div>
        </div>

        <!-- Filters and Sort -->
        <div class="shrink-0 px-6 py-4 bg-white border-t border-gray-200 space-y-4">
          <div class="flex flex-col sm:flex-row gap-4 items-end">
            <!-- Category filter -->
            <div class="flex-1">
              <label class="block text-sm font-medium text-gray-700 mb-1">
                {{ $t('history.filterCategory') || 'Filter by Category' }}
              </label>
              <select
                :value="selectedCategoryFilter ?? ''"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                @change="onCategoryChange(($event.target as HTMLSelectElement).value)"
              >
                <option value="">{{ $t('history.allCategories') || 'All Categories' }}</option>
                <option v-for="cat in uniqueCategories" :key="cat" :value="cat">
                  {{ cat }}
                </option>
              </select>
            </div>

            <!-- Question filter -->
            <div class="flex-1">
              <label class="block text-sm font-medium text-gray-700 mb-1">
                {{ $t('history.filterQuestion') || 'Filter by Question' }}
              </label>
              <select
                :key="selectedCategoryFilter ?? '__all__'"
                :value="selectedQuestionFilter ?? ''"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                @change="onQuestionChange(($event.target as HTMLSelectElement).value)"
              >
                <option value="">{{ $t('history.allQuestions') || 'All Questions' }}</option>
                <option v-for="[id, title] in uniqueQuestions" :key="id" :value="id">
                  {{ title }}
                </option>
              </select>
            </div>

            <!-- Sort -->
            <div class="flex-1">
              <label class="block text-sm font-medium text-gray-700 mb-1">
                {{ $t('history.sortBy') || 'Sort By' }}
              </label>
              <select
                v-model="sortBy"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="date_desc">{{ $t('history.newestFirst') || 'Newest First' }}</option>
                <option value="date_asc">{{ $t('history.oldestFirst') || 'Oldest First' }}</option>
                <option value="score_desc">{{ $t('history.highestScore') || 'Highest Score' }}</option>
              </select>
            </div>

            <!-- Clear filters button -->
            <button
              class="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 min-h-[44px]"
              @click="clearFilters"
            >
              {{ $t('history.clearFilters') || 'Clear' }}
            </button>
          </div>
        </div>

        <!-- Attempts table -->
        <div class="flex-1 px-6 py-4 overflow-auto">
          <div class="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-gray-200 bg-gray-50">
                  <th class="px-4 py-3 text-left font-semibold text-gray-900">{{ $t('history.date') || 'Date' }}</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-900">{{ $t('history.question') || 'Question' }}</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-900">{{ $t('history.category') || 'Category' }}</th>
                  <th class="px-4 py-3 text-center font-semibold text-gray-900">{{ $t('history.duration') || 'Duration' }}</th>
                  <th class="px-4 py-3 text-center font-semibold text-gray-900">{{ $t('history.fluency') || 'Fluency' }}</th>
                  <th class="px-4 py-3 text-center font-semibold text-gray-900">{{ $t('history.star') || 'STAR' }}</th>
                  <th class="px-4 py-3 text-center font-semibold text-gray-900">{{ $t('history.conciseness') || 'Conciseness' }}</th>
                  <th class="px-4 py-3 text-center font-semibold text-gray-900">{{ $t('history.status') || 'Status' }}</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-900">{{ $t('history.actions') || 'Actions' }}</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="attempt in filteredAttempts" :key="attempt.id">
                  <tr class="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                    <!-- Date -->
                    <td class="px-4 py-3 text-gray-900">
                      <div class="text-sm font-medium">{{ formatDate(attempt.created_at) }}</div>
                      <div class="text-xs text-gray-500">{{ formatTime(attempt.created_at) }}</div>
                    </td>

                    <!-- Question -->
                    <td class="px-4 py-3 text-gray-900 max-w-xs truncate">
                      {{ attempt.question_title }}
                    </td>

                    <!-- Category -->
                    <td class="px-4 py-3 text-gray-900">
                      <span class="inline-block px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium">
                        {{ attempt.category_name }}
                      </span>
                    </td>

                    <!-- Duration -->
                    <td class="px-4 py-3 text-center text-gray-900">
                      {{ formatDuration(attempt.duration_seconds) }}
                    </td>

                    <!-- Fluency -->
                    <td class="px-4 py-3 text-center">
                      <div v-if="attempt.fluency_score !== null" class="flex flex-col items-center gap-1">
                        <span class="font-medium text-gray-900">{{ formatScore(attempt.fluency_score) }}%</span>
                        <div class="w-16 bg-gray-200 rounded-full h-1.5">
                          <div
                            class="bg-indigo-600 h-1.5 rounded-full"
                            :style="{ width: (attempt.fluency_score * 100) + '%' }"
                          ></div>
                        </div>
                      </div>
                      <span v-else class="text-gray-400 text-xs">—</span>
                    </td>

                    <!-- STAR -->
                    <td class="px-4 py-3 text-center">
                      <div v-if="attempt.star_score !== null" class="flex flex-col items-center gap-1">
                        <span class="font-medium text-gray-900">{{ formatScore(attempt.star_score) }}%</span>
                        <div class="w-16 bg-gray-200 rounded-full h-1.5">
                          <div
                            class="bg-blue-600 h-1.5 rounded-full"
                            :style="{ width: (attempt.star_score * 100) + '%' }"
                          ></div>
                        </div>
                      </div>
                      <span v-else class="text-gray-400 text-xs">—</span>
                    </td>

                    <!-- Conciseness -->
                    <td class="px-4 py-3 text-center">
                      <div v-if="attempt.conciseness_score !== null" class="flex flex-col items-center gap-1">
                        <span class="font-medium text-gray-900">{{ formatScore(attempt.conciseness_score) }}%</span>
                        <div class="w-16 bg-gray-200 rounded-full h-1.5">
                          <div
                            class="bg-green-600 h-1.5 rounded-full"
                            :style="{ width: (attempt.conciseness_score * 100) + '%' }"
                          ></div>
                        </div>
                      </div>
                      <span v-else class="text-gray-400 text-xs">—</span>
                    </td>

                    <!-- Status -->
                    <td class="px-4 py-3 text-center">
                      <span
                        class="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium"
                        :class="{
                          'bg-green-100 text-green-700': attempt.processing_status === 'complete',
                          'bg-yellow-100 text-yellow-700': attempt.processing_status === 'pending',
                          'bg-red-100 text-red-700': attempt.processing_status === 'failed',
                        }"
                      >
                        {{ formatStatus(attempt.processing_status) }}
                      </span>
                    </td>

                    <!-- Actions -->
                    <td class="px-4 py-3">
                      <button
                        class="text-indigo-600 hover:text-indigo-700 font-medium text-sm"
                        @click="expandedAttempt = expandedAttempt === attempt.id ? null : attempt.id"
                      >
                        {{ expandedAttempt === attempt.id ? $t('common.hide') : $t('history.viewDetails') }}
                      </button>
                    </td>
                  </tr>

                  <!-- Expanded detail row -->
                  <tr v-if="expandedAttempt === attempt.id" class="bg-gray-50">
                    <td colspan="9" class="px-4 py-4">
                      <div class="space-y-3">
                        <!-- Your answer -->
                        <div v-if="attempt.answer_raw">
                          <h4 class="text-sm font-semibold text-gray-900 mb-1">{{ $t('history.yourAnswer') || 'Your Answer' }}</h4>
                          <p class="text-sm text-gray-600 bg-white p-3 rounded-lg border border-gray-200">
                            {{ attempt.answer_raw }}
                          </p>
                        </div>

                        <!-- Corrected answer -->
                        <div v-if="attempt.answer_clean">
                          <h4 class="text-sm font-semibold text-gray-900 mb-1">{{ $t('history.correctedAnswer') || 'Corrected Answer' }}</h4>
                          <p class="text-sm text-gray-600 bg-white p-3 rounded-lg border border-gray-200">
                            {{ attempt.answer_clean }}
                          </p>
                        </div>

                        <!-- AI feedback -->
                        <div v-if="attempt.ai_feedback">
                          <h4 class="text-sm font-semibold text-gray-900 mb-1">{{ $t('history.aiFeedback') || 'AI Feedback' }}</h4>
                          <div class="text-sm text-gray-600 bg-white p-3 rounded-lg border border-gray-200 whitespace-pre-wrap">
                            {{ attempt.ai_feedback }}
                          </div>
                        </div>

                        <!-- Timer feedback -->
                        <div v-if="attempt.timer_feedback" class="text-sm">
                          <span class="font-semibold text-gray-900">{{ $t('history.timerFeedback') || 'Timer Feedback' }}:</span>
                          <span class="text-gray-600 ml-2 capitalize">{{ attempt.timer_feedback?.replace(/_/g, ' ') }}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAttemptsStore } from '@/stores/attempts'

const { locale } = useI18n()
const attemptsStore = useAttemptsStore()
const expandedAttempt = ref<string | null>(null)

const isLoading = computed(() => attemptsStore.isLoading)
const error = computed(() => attemptsStore.error)
const filteredAttempts = computed(() => attemptsStore.filteredAttempts)
const uniqueCategories = computed(() => attemptsStore.uniqueCategories)
const uniqueQuestions = computed(() => attemptsStore.uniqueQuestions)
const stats = computed(() => attemptsStore.stats)
const selectedCategoryFilter = computed(() => attemptsStore.selectedCategoryFilter)
const selectedQuestionFilter = computed(() => attemptsStore.selectedQuestionFilter)

const sortBy = computed({
  get: () => attemptsStore.sortBy,
  set: (val: 'date_desc' | 'date_asc' | 'score_desc') => attemptsStore.setSortBy(val),
})

function onCategoryChange(val: string) {
  attemptsStore.setCategoryFilter(val || null)
}

function onQuestionChange(val: string) {
  attemptsStore.setQuestionFilter(val || null)
}

onMounted(async () => {
  await attemptsStore.fetchAttempts()
})

function retryFetch() {
  attemptsStore.fetchAttempts()
}

function clearFilters() {
  attemptsStore.clearFilters()
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString(locale.value, { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' })
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins > 0) {
    return `${mins}m ${secs}s`
  }
  return `${secs}s`
}

function formatScore(score: number): number {
  return Math.round(score * 100)
}

function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    complete: 'Completed',
    pending: 'Processing',
    failed: 'Failed',
  }
  return statusMap[status] || status
}
</script>
