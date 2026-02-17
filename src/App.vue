<template>
  <div id="app" class="h-screen flex flex-col">
    <!-- Unauthenticated: show auth UI -->
    <AuthView v-if="!user" @auth-success="onAuthSuccess" />

    <!-- Authenticated -->
    <template v-else>
      <!-- Top nav bar -->
      <nav class="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shrink-0
                  safe-area-top">
        <h1 class="text-lg font-bold text-gray-900">HardStop</h1>
        <div class="flex items-center gap-1">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            class="rounded-lg px-3 py-2 text-sm font-medium min-h-[44px] transition-colors"
            :class="activeTab === tab.key
              ? 'bg-indigo-100 text-indigo-700'
              : 'text-gray-600 hover:bg-gray-100'"
            @click="navigateTab(tab.key)"
          >
            {{ $t(tab.label) }}
          </button>
          <button
            class="ml-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100
                   hover:text-red-600 min-h-[44px]"
            @click="handleLogout"
          >
            {{ $t('nav.logout') }}
          </button>
        </div>
      </nav>

      <!-- Content area -->
      <main class="flex-1 overflow-hidden">
        <!-- Questions / Categories CRUD -->
        <QuestionManagement
          v-if="activeTab === 'questions'"
          @start-session="goToPractice"
        />

        <!-- Attempts History -->
        <AttemptsHistoryView
          v-else-if="activeTab === 'history'"
        />

        <!-- Session lobby: checks readiness before starting -->
        <div v-else-if="activeTab === 'practice' && !sessionActive" class="flex-1 flex flex-col">
          <!-- Loading state while checking / building session -->
          <div v-if="sessionStore.isLoading" class="flex-1 flex items-center justify-center">
            <div class="text-center">
              <div class="animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent mx-auto mb-4"></div>
              <p class="text-sm text-gray-500">{{ $t('lobby.building') }}</p>
            </div>
          </div>

          <!-- Error state -->
          <div v-else-if="sessionStore.error" class="flex-1 flex items-center justify-center px-6">
            <div class="text-center max-w-sm">
              <div class="rounded-full bg-red-100 p-4 mx-auto mb-4 w-fit">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 class="text-lg font-bold text-gray-900 mb-2">{{ $t('lobby.errorTitle') }}</h2>
              <p class="text-sm text-red-600 mb-4">{{ sessionStore.error }}</p>
              <button
                class="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white
                       hover:bg-indigo-500 min-h-[44px]"
                @click="sessionStore.error = null"
              >
                {{ $t('lobby.tryAgain') }}
              </button>
            </div>
          </div>

          <!-- Setup required: not enough categories/questions -->
          <div v-else-if="!questionsStore.isReadyForSession" class="flex-1 flex items-center justify-center px-6">
            <div class="text-center max-w-sm">
              <div class="rounded-full bg-amber-100 p-4 mx-auto mb-4 w-fit">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
              <h2 class="text-lg font-bold text-gray-900 mb-2">{{ $t('lobby.setupRequired') }}</h2>
              <p class="text-sm text-gray-500 mb-4">{{ $t('lobby.setupDescription') }}</p>
              <ul class="text-left mb-6 space-y-1.5">
                <li
                  v-for="(err, i) in questionsStore.readinessErrors.slice(0, 5)"
                  :key="i"
                  class="flex items-start gap-2 text-sm text-amber-700"
                >
                  <span class="mt-0.5 shrink-0 text-amber-400">•</span>
                  {{ err }}
                </li>
              </ul>
              <button
                class="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white
                       hover:bg-indigo-500 min-h-[44px] w-full"
                @click="activeTab = 'questions'"
              >
                {{ $t('lobby.goToSetup') }}
              </button>
            </div>
          </div>

          <!-- Ready: show Start Session -->
          <div v-else class="flex-1 flex items-center justify-center px-6">
            <div class="text-center max-w-sm">
              <div class="rounded-full bg-green-100 p-4 mx-auto mb-4 w-fit">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 class="text-lg font-bold text-gray-900 mb-2">{{ $t('lobby.readyTitle') }}</h2>
              <p class="text-sm text-gray-500 mb-2">
                {{ $t('lobby.readyDescription', {
                  categories: questionsStore.categoryCount,
                  questions: totalQuestionCount
                }) }}
              </p>
              <p v-if="sessionStore.isRestoredSession" class="text-sm text-indigo-600 font-medium mb-4">
                {{ $t('lobby.resumeAvailable') }}
              </p>
              <p v-else class="mb-4"></p>
              <button
                class="rounded-lg bg-green-600 px-6 py-3 text-base font-bold text-white
                       shadow-lg hover:bg-green-500 active:bg-green-700 min-h-[48px] w-full
                       transition-colors"
                @click="handleStartSession"
              >
                {{ sessionStore.isRestoredSession ? $t('lobby.resumeSession') : $t('lobby.startSession') }}
              </button>
              <button
                v-if="sessionStore.isRestoredSession"
                class="mt-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm
                       font-medium text-gray-600 hover:bg-gray-50 min-h-[44px] w-full"
                @click="handleNewSession"
              >
                {{ $t('lobby.newSession') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Active session -->
        <SessionView
          v-else-if="activeTab === 'practice' && sessionActive"
          @session-complete="onSessionComplete"
          @abandon="onAbandonSession"
        />
      </main>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { supabase } from './lib/supabase'
import { useSessionStore } from './stores/session'
import { useQuestionsStore } from './stores/questions'
import { useAttemptsStore } from './stores/attempts'
import AuthView from './components/AuthView.vue'
import SessionView from './components/session/SessionView.vue'
import QuestionManagement from './components/questions/QuestionManagement.vue'
import AttemptsHistoryView from './components/AttemptsHistoryView.vue'
import type { User } from '@supabase/supabase-js'

type TabKey = 'questions' | 'practice' | 'history'

const tabs: { key: TabKey; label: string }[] = [
  { key: 'questions', label: 'nav.questions' },
  { key: 'practice', label: 'nav.practice' },
  { key: 'history', label: 'nav.history' },
]

const user = ref<User | null>(null)
const activeTab = ref<TabKey>('questions')
const sessionActive = ref(false)

const sessionStore = useSessionStore()
const questionsStore = useQuestionsStore()
const attemptsStore = useAttemptsStore()

const totalQuestionCount = computed(() => {
  let total = 0
  for (const cat of questionsStore.categories) {
    total += questionsStore.questionCount(cat.id)
  }
  return total
})

onMounted(async () => {
  const { data } = await supabase.auth.getSession()
  user.value = data.session?.user ?? null

  supabase.auth.onAuthStateChange((_event, session) => {
    user.value = session?.user ?? null
  })
})

// When user becomes authenticated, load their data and check for resume
watch(user, async (u) => {
  if (u) {
    await questionsStore.fetchCategories()
    await sessionStore.tryRestore()
    await attemptsStore.fetchAttempts()
  } else {
    questionsStore.$reset()
    sessionActive.value = false
  }
})

function onAuthSuccess() {
  // Auth succeeded; user state will update via the listener
}

function navigateTab(key: TabKey) {
  if (key === 'practice' && sessionActive.value) {
    // Already in active session, allow going back to it
    activeTab.value = key
    return
  }
  // Otherwise reset to lobby
  if (key === 'practice') {
    sessionActive.value = false
  }
  activeTab.value = key
}

function goToPractice() {
  activeTab.value = 'practice'
  sessionActive.value = false
}

async function handleStartSession() {
  // If there's a restored session, just activate it
  if (sessionStore.isRestoredSession && sessionStore.questions.length > 0) {
    sessionActive.value = true
    return
  }

  const questions = await sessionStore.buildSession()
  if (questions.length > 0) {
    sessionActive.value = true
  }
}

async function handleNewSession() {
  sessionStore.clearPersistedSession()
  const questions = await sessionStore.buildSession()
  if (questions.length > 0) {
    sessionActive.value = true
  }
}

function onSessionComplete() {
  sessionStore.clearPersistedSession()
  sessionActive.value = false
}

function onAbandonSession() {
  sessionActive.value = false
}

async function handleLogout() {
  await supabase.auth.signOut()
  user.value = null
  activeTab.value = 'questions'
  sessionActive.value = false
}
</script>