<template>
  <div class="flex flex-col h-full bg-gray-50">
    <!-- Readiness Banner -->
    <div
      v-if="store.categories.length > 0 && !store.isReadyForSession"
      class="px-4 py-2.5 bg-amber-50 border-b border-amber-200"
    >
      <p class="text-xs font-medium text-amber-800">
        {{ $t('management.setupIncomplete') }}
      </p>
      <ul class="mt-1 space-y-0.5">
        <li
          v-for="(err, i) in store.readinessErrors.slice(0, 3)"
          :key="i"
          class="text-xs text-amber-700"
        >
          • {{ err }}
        </li>
        <li v-if="store.readinessErrors.length > 3" class="text-xs text-amber-600 italic">
          {{ $t('management.andMore', { count: store.readinessErrors.length - 3 }) }}
        </li>
      </ul>
    </div>

    <!-- Ready Banner -->
    <div
      v-if="store.isReadyForSession"
      class="px-4 py-2.5 bg-green-50 border-b border-green-200 flex items-center justify-between"
    >
      <div class="flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="text-xs font-medium text-green-800">{{ $t('management.ready') }}</p>
      </div>
      <button
        class="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white
               hover:bg-green-500 active:bg-green-700 min-h-[36px]"
        @click="$emit('startSession')"
      >
        {{ $t('management.startPractice') }}
      </button>
    </div>

    <!-- Tab Bar (only shown when not viewing a specific category's question list) -->
    <div
      v-if="!selectedCategoryId"
      class="flex items-center gap-1 px-4 py-2 border-b border-gray-200 bg-white"
    >
      <button
        v-for="tab in managementTabs"
        :key="tab.key"
        class="rounded-lg px-3 py-2 text-sm font-medium min-h-[44px] transition-colors"
        :class="activeTab === tab.key
          ? 'bg-indigo-100 text-indigo-700'
          : 'text-gray-600 hover:bg-gray-100'"
        @click="activeTab = tab.key"
      >
        {{ $t(tab.label) }}
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-hidden">
      <!-- Category question list (drills into a specific category) -->
      <QuestionsListView
        v-if="selectedCategoryId"
        :category-id="selectedCategoryId"
        @back="selectedCategoryId = null"
      />

      <!-- Tab: All Questions (CRUD) -->
      <CategoriesView
        v-else-if="activeTab === 'crud'"
        @select-category="onSelectCategory"
      />

      <!-- Tab: Performance Heatmap -->
      <QuestionHeatmap
        v-else-if="activeTab === 'heatmap'"
      />

      <!-- Tab: Mastery Progress -->
      <CategoryProgress
        v-else-if="activeTab === 'progress'"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useQuestionsStore } from '@/stores/questions'
import type { CategoryId } from '@/types/database'
import CategoriesView from './CategoriesView.vue'
import QuestionsListView from './QuestionsListView.vue'
import QuestionHeatmap from './QuestionHeatmap.vue'
import CategoryProgress from './CategoryProgress.vue'

type ManagementTab = 'crud' | 'heatmap' | 'progress'

const managementTabs: { key: ManagementTab; label: string }[] = [
  { key: 'crud', label: 'metrics.tabQuestions' },
  { key: 'heatmap', label: 'metrics.tabHeatmap' },
  { key: 'progress', label: 'metrics.tabMastery' },
]

defineEmits<{
  startSession: []
}>()

const store = useQuestionsStore()
const selectedCategoryId = ref<CategoryId | null>(null)
const activeTab = ref<ManagementTab>('crud')

function onSelectCategory(categoryId: CategoryId) {
  selectedCategoryId.value = categoryId
}

onMounted(() => {
  store.fetchCategories()
})
</script>
