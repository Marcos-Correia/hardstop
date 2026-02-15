<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
      <div>
        <h2 class="text-lg font-bold text-gray-900">{{ $t('categories.title') }}</h2>
        <p class="text-sm text-gray-500">
          {{ $t('categories.counter', { current: store.categoryCount, min: MIN_CATEGORIES, max: MAX_CATEGORIES }) }}
        </p>
      </div>
      <button
        v-if="store.canAddCategory"
        class="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white
               shadow-sm hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 min-h-[44px]"
        :disabled="showAddForm"
        @click="openAddForm"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        {{ $t('categories.add') }}
      </button>
      <span v-else class="text-xs text-amber-600 font-medium">
        {{ $t('categories.limitReached') }}
      </span>
    </div>

    <!-- Add Form -->
    <div v-if="showAddForm" class="px-4 py-3 bg-indigo-50 border-b border-indigo-100">
      <form @submit.prevent="handleAdd" class="flex flex-col gap-2">
        <input
          ref="addNameInput"
          v-model="newName"
          type="text"
          :placeholder="$t('categories.namePlaceholder')"
          maxlength="100"
          required
          class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm
                 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
        />
        <input
          v-model="newDescription"
          type="text"
          :placeholder="$t('categories.descriptionPlaceholder')"
          maxlength="255"
          class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm
                 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
        />
        <div class="flex gap-2">
          <button
            type="submit"
            :disabled="!newName.trim()"
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

    <!-- Loading -->
    <div v-if="store.isLoading" class="flex-1 flex items-center justify-center">
      <div class="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="store.categories.length === 0"
      class="flex-1 flex flex-col items-center justify-center px-6 text-center"
    >
      <div class="rounded-full bg-indigo-100 p-4 mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </div>
      <h3 class="text-base font-semibold text-gray-900 mb-1">{{ $t('categories.emptyTitle') }}</h3>
      <p class="text-sm text-gray-500 max-w-xs">{{ $t('categories.emptyDescription') }}</p>
    </div>

    <!-- Category List -->
    <ul v-else class="flex-1 overflow-y-auto divide-y divide-gray-100">
      <li
        v-for="cat in store.categories"
        :key="cat.id"
        class="relative group"
      >
        <!-- Editing mode -->
        <form
          v-if="editingId === cat.id"
          @submit.prevent="handleUpdate(cat.id)"
          class="px-4 py-3 bg-amber-50"
        >
          <input
            ref="editNameInput"
            v-model="editName"
            type="text"
            maxlength="100"
            required
            class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm mb-2
                   focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
          />
          <input
            v-model="editDescription"
            type="text"
            maxlength="255"
            :placeholder="$t('categories.descriptionPlaceholder')"
            class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm mb-2
                   focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
          />
          <div class="flex gap-2">
            <button
              type="submit"
              :disabled="!editName.trim()"
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
        <div
          v-else
          class="flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer active:bg-gray-100"
          @click="$emit('selectCategory', cat.id)"
        >
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-gray-900 truncate">{{ cat.name }}</p>
            <p v-if="cat.description" class="text-xs text-gray-500 truncate mt-0.5">{{ cat.description }}</p>
            <p class="text-xs mt-1" :class="questionCountClass(cat.id)">
              {{ $t('categories.questionCount', { count: store.questionCount(cat.id) }) }}
              <span v-if="store.questionCount(cat.id) < MIN_QUESTIONS_PER_CATEGORY" class="text-amber-600">
                ({{ $t('categories.needMore', { need: MIN_QUESTIONS_PER_CATEGORY - store.questionCount(cat.id) }) }})
              </span>
            </p>
          </div>

          <!-- Action buttons -->
          <div class="flex items-center gap-1 ml-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity sm:opacity-100">
            <button
              class="rounded-lg p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 min-h-[44px] min-w-[44px]
                     flex items-center justify-center"
              :title="$t('common.edit')"
              @click.stop="startEdit(cat)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              class="rounded-lg p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 min-h-[44px] min-w-[44px]
                     flex items-center justify-center"
              :title="$t('common.delete')"
              @click.stop="handleDelete(cat)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <div
              class="rounded-lg p-2 text-gray-400 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
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
        <h3 class="text-base font-semibold text-gray-900 mb-2">{{ $t('categories.deleteTitle') }}</h3>
        <p class="text-sm text-gray-600 mb-1">
          {{ $t('categories.deleteConfirm', { name: confirmDelete.name }) }}
        </p>
        <p v-if="store.questionCount(confirmDelete.id) > 0" class="text-sm text-red-600 mb-4">
          {{ $t('categories.deleteWarning', { count: store.questionCount(confirmDelete.id) }) }}
        </p>
        <p v-else class="mb-4"></p>
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
import { ref, nextTick } from 'vue'
import { useQuestionsStore, MIN_QUESTIONS_PER_CATEGORY, MIN_CATEGORIES, MAX_CATEGORIES } from '@/stores/questions'
import type { Category, CategoryId } from '@/types/database'

defineEmits<{
  selectCategory: [categoryId: CategoryId]
}>()

const store = useQuestionsStore()

// ── Add form ──────────────────────────────────────────────
const showAddForm = ref(false)
const newName = ref('')
const newDescription = ref('')
const addNameInput = ref<HTMLInputElement | null>(null)

function openAddForm() {
  showAddForm.value = true
  newName.value = ''
  newDescription.value = ''
  nextTick(() => addNameInput.value?.focus())
}

function closeAddForm() {
  showAddForm.value = false
  newName.value = ''
  newDescription.value = ''
}

async function handleAdd() {
  if (!newName.value.trim()) return
  const result = await store.addCategory(newName.value, newDescription.value || undefined)
  if (result) closeAddForm()
}

// ── Edit ──────────────────────────────────────────────────
const editingId = ref<CategoryId | null>(null)
const editName = ref('')
const editDescription = ref('')
const editNameInput = ref<HTMLInputElement | null>(null)

function startEdit(cat: Category) {
  editingId.value = cat.id
  editName.value = cat.name
  editDescription.value = cat.description ?? ''
  nextTick(() => {
    const inputs = editNameInput.value
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

async function handleUpdate(id: CategoryId) {
  if (!editName.value.trim()) return
  const success = await store.updateCategory(id, {
    name: editName.value,
    description: editDescription.value || undefined,
  })
  if (success) editingId.value = null
}

// ── Delete ────────────────────────────────────────────────
const confirmDelete = ref<Category | null>(null)

function handleDelete(cat: Category) {
  confirmDelete.value = cat
}

async function confirmDeleteAction() {
  if (!confirmDelete.value) return
  await store.deleteCategory(confirmDelete.value.id)
  confirmDelete.value = null
}

// ── Question count color ──────────────────────────────────
function questionCountClass(categoryId: CategoryId): string {
  const count = store.questionCount(categoryId)
  if (count >= MIN_QUESTIONS_PER_CATEGORY) return 'text-green-600'
  if (count > 0) return 'text-amber-600'
  return 'text-gray-400'
}
</script>
