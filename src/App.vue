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
            @click="activeTab = tab.key"
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
        <QuestionManagement
          v-if="activeTab === 'questions'"
          @start-session="startSession"
        />
        <SessionView v-else-if="activeTab === 'practice'" />
      </main>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from './lib/supabase'
import AuthView from './components/AuthView.vue'
import SessionView from './components/session/SessionView.vue'
import QuestionManagement from './components/questions/QuestionManagement.vue'
import type { User } from '@supabase/supabase-js'

type TabKey = 'questions' | 'practice'

const tabs: { key: TabKey; label: string }[] = [
  { key: 'questions', label: 'nav.questions' },
  { key: 'practice', label: 'nav.practice' },
]

const user = ref<User | null>(null)
const activeTab = ref<TabKey>('questions')

onMounted(async () => {
  // Check current session
  const { data } = await supabase.auth.getSession()
  user.value = data.session?.user ?? null

  // Listen for auth changes
  supabase.auth.onAuthStateChange((_event, session) => {
    user.value = session?.user ?? null
  })
})

function onAuthSuccess() {
  // Auth succeeded; user state will update via the listener
}

function startSession() {
  activeTab.value = 'practice'
}

async function handleLogout() {
  await supabase.auth.signOut()
  user.value = null
  activeTab.value = 'questions'
}
</script>