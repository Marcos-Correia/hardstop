<template>
  <div id="app">
    <!-- Unauthenticated: show auth UI -->
    <AuthView v-if="!user" @auth-success="onAuthSuccess" />

    <!-- Authenticated: show session UI -->
    <SessionView v-else />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { supabase } from './lib/supabase'
import AuthView from './components/AuthView.vue'
import SessionView from './components/session/SessionView.vue'
import type { User } from '@supabase/supabase-js'

const user = ref<User | null>(null)

onMounted(async () => {
  // Check current session
  const { data } = await supabase.auth.getSession()
  user.value = data.session?.user ?? null

  // Listen for auth changes
  supabase.auth.onAuthStateChange((event, session) => {
    user.value = session?.user ?? null
  })
})

function onAuthSuccess() {
  // Auth succeeded; user state will update via the listener
}
</script>

<style>
/* Add global styles if needed */
</style>