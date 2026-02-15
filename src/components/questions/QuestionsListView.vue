<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center gap-2 px-4 py-3 border-b border-gray-200 bg-white">
      <button
        class="rounded-lg p-2 text-gray-600 hover:bg-gray-100 active:bg-gray-200 min-h-[44px] min-w-[44px]
               flex items-center justify-center shrink-0"
        :title="$t('common.back')"
        @click="$emit('back')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div class="flex-1 min-w-0">
        <h2 class="text-lg font-bold text-gray-900 truncate">{{ category?.name }}</h2>
        <p class="text-sm text-gray-500">
          {{ $t('questions.counter', { current: questionList.length, min: MIN_QUESTIONS_PER_CATEGORY, max: MAX_QUESTIONS_PER_CATEGORY }) }}
        </p>
      </div>
      <div v-if="store.canAddQuestion(categoryId)" class="flex items-center gap-2 shrink-0">
        <button
          class="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white
                 shadow-sm hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 min-h-[44px]"
          :disabled="showAddForm || showBulkForm"
          @click="openAddForm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {{ $t('questions.add') }}
        </button>
        <button
          class="flex items-center gap-1.5 rounded-lg border border-indigo-600 px-3 py-2 text-sm font-semibold text-indigo-600
                 hover:bg-indigo-50 active:bg-indigo-100 disabled:opacity-50 min-h-[44px]"
          :disabled="showAddForm || showBulkForm"
          @click="openBulkForm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          Bulk
        </button>
      </div>
      <span v-else-if="questionList.length >= MAX_QUESTIONS_PER_CATEGORY" class="text-xs text-amber-600 font-medium shrink-0">
        {{ $t('questions.limitReached') }}
      </span>
    </div>

    <!-- Add Form -->
    <div v-if="showAddForm" class="px-4 py-3 bg-indigo-50 border-b border-indigo-100">
      <form @submit.prevent="handleAdd" class="flex flex-col gap-2">
        <input
          ref="addTitleInput"
          v-model="newTitle"
          type="text"
          :placeholder="$t('questions.titlePlaceholder')"
          maxlength="500"
          required
          class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm
                 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
        />
        <input
          v-model="newHint"
          type="text"
          :placeholder="$t('questions.hintPlaceholder')"
          maxlength="500"
          class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm
                 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
        />
        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-600 shrink-0">{{ $t('questions.timeLabel') }}</label>
          <input
            v-model.number="newBaseTime"
            type="number"
            min="30"
            max="600"
            step="15"
            class="w-24 rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-center
                   focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
          />
          <span class="text-sm text-gray-500">{{ $t('questions.seconds') }}</span>
        </div>
        <div class="flex gap-2">
          <button
            type="submit"
            :disabled="!newTitle.trim()"
            class="flex-1 rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white
                   hover:bg-indigo-500 disabled:opacity-50 min-h-[44px]"
          >
            {{ $t('common.save') }}
          </button>
          <button
            type="button"
            class="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold
                   text-gray-700 hover:bg-gray-50 min-h-[44px]"
            @click="closeAddForm"
          >
            {{ $t('common.cancel') }}
          </button>
        </div>
      </form>
    </div>

    <!-- Bulk Add Form -->
    <div v-if="showBulkForm" class="px-4 py-3 bg-indigo-50 border-b border-indigo-100">
      <form @submit.prevent="handleBulkAdd" class="flex flex-col gap-2">
        <div class="text-xs text-indigo-700 mb-1">
          Enter questions separated by commas, each wrapped in double quotes.<br>
          Example: "Question 1", "Question 2", "Question 3"
        </div>
        <textarea
          ref="bulkTitlesInput"
          v-model="bulkTitles"
          rows="3"
          placeholder='"What is your biggest strength?", "Describe a challenging project", "Why do you want this role?"'
          required
          class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm
                 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
        ></textarea>
        <div class="text-xs text-gray-600 mb-1">
          Optional hints (same format, must match question count):
        </div>
        <textarea
          v-model="bulkHints"
          rows="2"
          placeholder='"Focus on communication skills", "Mention problem-solving approach", "Connect to company values"'
          class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm
                 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
        ></textarea>
        <div class="flex items-center gap-2 text-sm text-gray-600">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>All questions will use default time: <strong>120 seconds</strong></span>
        </div>
        <div v-if="bulkPreview.length > 0" class="text-xs text-gray-600 bg-white rounded p-2 border border-gray-200">
          <strong>Preview:</strong> {{ bulkPreview.length }} question(s) will be added
        </div>
        <div class="flex gap-2">
          <button
            type="submit"
            :disabled="bulkPreview.length === 0"
            class="flex-1 rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white
                   hover:bg-indigo-500 disabled:opacity-50 min-h-[44px]"
          >
            {{ $t('common.save') }}
          </button>
          <button
            type="button"
            class="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold
                   text-gray-700 hover:bg-gray-50 min-h-[44px]"
            @click="closeBulkForm"
          >
            {{ $t('common.cancel') }}
          </button>
        </div>
      </form>
    </div>

    <!-- Empty State -->
    <div
      v-if="!store.isLoading && questionList.length === 0"
      class="flex-1 flex flex-col items-center justify-center px-6 text-center"
    >
      <div class="rounded-full bg-indigo-100 p-4 mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 class="text-base font-semibold text-gray-900 mb-1">{{ $t('questions.emptyTitle') }}</h3>
      <p class="text-sm text-gray-500 max-w-xs">
        {{ $t('questions.emptyDescription', { min: MIN_QUESTIONS_PER_CATEGORY, max: MAX_QUESTIONS_PER_CATEGORY }) }}
      </p>
    </div>

    <!-- Question List -->
    <ul v-else class="flex-1 overflow-y-auto divide-y divide-gray-100">
      <li
        v-for="(question, index) in questionList"
        :key="question.id"
        class="relative group"
      >
        <!-- Editing mode -->
        <form
          v-if="editingId === question.id"
          @submit.prevent="handleUpdate(question.id)"
          class="px-4 py-3 bg-amber-50"
        >
          <input
            ref="editTitleInput"
            v-model="editTitle"
            type="text"
            maxlength="500"
            required
            class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm mb-2
                   focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
          />
          <input
            v-model="editHint"
            type="text"
            maxlength="500"
            :placeholder="$t('questions.hintPlaceholder')"
            class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm mb-2
                   focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
          />
          <div class="flex items-center gap-2 mb-2">
            <label class="text-sm text-gray-600 shrink-0">{{ $t('questions.timeLabel') }}</label>
            <input
              v-model.number="editBaseTime"
              type="number"
              min="30"
              max="600"
              step="15"
              class="w-24 rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-center
                     focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
            />
            <span class="text-sm text-gray-500">{{ $t('questions.seconds') }}</span>
          </div>
          <div class="flex gap-2">
            <button
              type="submit"
              :disabled="!editTitle.trim()"
              class="flex-1 rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white
                     hover:bg-indigo-500 disabled:opacity-50 min-h-[44px]"
            >
              {{ $t('common.save') }}
            </button>
            <button
              type="button"
              class="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold
                     text-gray-700 hover:bg-gray-50 min-h-[44px]"
              @click="cancelEdit"
            >
              {{ $t('common.cancel') }}
            </button>
          </div>
        </form>

        <!-- Display mode -->
        <div v-else class="flex items-start px-4 py-3 hover:bg-gray-50">
          <span class="flex items-center justify-center h-6 w-6 rounded-full bg-gray-100 text-xs
                       font-semibold text-gray-500 mt-0.5 shrink-0 mr-3">
            {{ index + 1 }}
          </span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-900">{{ question.title }}</p>
            <p v-if="question.hint" class="text-xs text-gray-500 mt-0.5 truncate">
              {{ $t('questions.hintPrefix') }} {{ question.hint }}
            </p>
            <div class="flex items-center gap-3 mt-1">
              <span class="inline-flex items-center gap-1 text-xs text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {{ formatTime(question.base_time_seconds) }}
              </span>
            </div>
          </div>

          <!-- Action buttons -->
          <div class="flex items-center gap-1 ml-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity sm:opacity-100">
            <button
              class="rounded-lg p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 min-h-[44px] min-w-[44px]
                     flex items-center justify-center"
              :title="$t('common.edit')"
              @click.stop="startEdit(question)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              class="rounded-lg p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 min-h-[44px] min-w-[44px]
                     flex items-center justify-center"
              :title="$t('common.delete')"
              @click.stop="handleDelete(question)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </li>
    </ul>

    <!-- Error -->
    <div v-if="store.error" class="px-4 py-3 bg-red-50 border-t border-red-100">
      <p class="text-sm text-red-700">{{ store.error }}</p>
    </div>

    <!-- Confirm Delete Dialog -->
    <div
      v-if="confirmDelete"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      @click.self="confirmDelete = null"
    >
      <div class="bg-white rounded-xl shadow-xl max-w-sm w-full p-5">
        <h3 class="text-base font-semibold text-gray-900 mb-2">{{ $t('questions.deleteTitle') }}</h3>
        <p class="text-sm text-gray-600 mb-4">
          {{ $t('questions.deleteConfirm') }}
        </p>
        <p class="text-sm text-gray-500 italic mb-4 line-clamp-2">"{{ confirmDelete.title }}"</p>
        <div class="flex gap-2">
          <button
            class="flex-1 rounded-lg bg-red-600 px-3 py-2.5 text-sm font-semibold text-white
                   hover:bg-red-500 min-h-[44px]"
            @click="confirmDeleteAction"
          >
            {{ $t('common.delete') }}
          </button>
          <button
            class="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold
                   text-gray-700 hover:bg-gray-50 min-h-[44px]"
            @click="confirmDelete = null"
          >
            {{ $t('common.cancel') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import {
  useQuestionsStore,
  MIN_QUESTIONS_PER_CATEGORY,
  MAX_QUESTIONS_PER_CATEGORY,
} from '@/stores/questions'
import type { Question, CategoryId, QuestionId } from '@/types/database'

const props = defineProps<{
  categoryId: CategoryId
}>()

defineEmits<{
  back: []
}>()

const store = useQuestionsStore()

const category = computed(() => store.categories.find((c) => c.id === props.categoryId))
const questionList = computed(() => store.questionsByCategory.get(props.categoryId) ?? [])

// ── Add form ──────────────────────────────────────────────
const showAddForm = ref(false)
const newTitle = ref('')
const newHint = ref('')
const newBaseTime = ref(120)
const addTitleInput = ref<HTMLInputElement | null>(null)

function openAddForm() {
  showAddForm.value = true
  newTitle.value = ''
  newHint.value = ''
  newBaseTime.value = 120
  nextTick(() => addTitleInput.value?.focus())
}

function closeAddForm() {
  showAddForm.value = false
  newTitle.value = ''
  newHint.value = ''
  newBaseTime.value = 120
}

async function handleAdd() {
  if (!newTitle.value.trim()) return
  const result = await store.addQuestion(
    props.categoryId,
    newTitle.value,
    newHint.value || undefined,
    newBaseTime.value,
  )
  if (result) closeAddForm()
}

// ── Bulk add ──────────────────────────────────────────────
const showBulkForm = ref(false)
const bulkTitles = ref('')
const bulkHints = ref('')
const bulkTitlesInput = ref<HTMLTextAreaElement | null>(null)

const bulkPreview = computed(() => {
  return parseBulkInput(bulkTitles.value)
})

function parseBulkInput(input: string): string[] {
  if (!input.trim()) return []
  // Match strings wrapped in double quotes, separated by commas
  const regex = /"([^"]*)"/g
  const matches = []
  let match
  while ((match = regex.exec(input)) !== null) {
    const value = match[1].trim()
    if (value) matches.push(value)
  }
  return matches
}

function openBulkForm() {
  showBulkForm.value = true
  bulkTitles.value = ''
  bulkHints.value = ''
  nextTick(() => bulkTitlesInput.value?.focus())
}

function closeBulkForm() {
  showBulkForm.value = false
  bulkTitles.value = ''
  bulkHints.value = ''
}

async function handleBulkAdd() {
  const titles = parseBulkInput(bulkTitles.value)
  if (titles.length === 0) return
  
  const hints = parseBulkInput(bulkHints.value)
  
  const result = await store.bulkAddQuestions(
    props.categoryId,
    titles,
    hints,
    120 // locked default time
  )
  
  if (result.success > 0) {
    closeBulkForm()
  }
}

// ── Edit ──────────────────────────────────────────────────
const editingId = ref<QuestionId | null>(null)
const editTitle = ref('')
const editHint = ref('')
const editBaseTime = ref(120)
const editTitleInput = ref<HTMLInputElement | null>(null)

function startEdit(question: Question) {
  editingId.value = question.id
  editTitle.value = question.title
  editHint.value = question.hint ?? ''
  editBaseTime.value = question.base_time_seconds
  nextTick(() => {
    const inputs = editTitleInput.value
    if (Array.isArray(inputs)) {
      (inputs as HTMLInputElement[])[0]?.focus()
    } else {
      inputs?.focus()
    }
  })
}

function cancelEdit() {
  editingId.value = null
}

async function handleUpdate(id: QuestionId) {
  if (!editTitle.value.trim()) return
  const success = await store.updateQuestion(id, props.categoryId, {
    title: editTitle.value,
    hint: editHint.value || undefined,
    base_time_seconds: editBaseTime.value,
  })
  if (success) editingId.value = null
}

// ── Delete ────────────────────────────────────────────────
const confirmDelete = ref<Question | null>(null)

function handleDelete(question: Question) {
  confirmDelete.value = question
}

async function confirmDeleteAction() {
  if (!confirmDelete.value) return
  await store.deleteQuestion(confirmDelete.value.id, props.categoryId)
  confirmDelete.value = null
}

// ── Helpers ───────────────────────────────────────────────
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}s`
  if (s === 0) return `${m}m`
  return `${m}m ${s}s`
}
</script>
