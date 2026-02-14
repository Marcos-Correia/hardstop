<template>
  <div class="auth-container">
    <div class="auth-card">
      <h1 class="auth-title">HardStop</h1>
      <p class="auth-subtitle">Interview Trainer</p>

      <!-- Not Configured State -->
      <div v-if="!isSupabaseConfigured" class="auth-section">
        <div class="alert alert-error">
          <strong>Setup Required</strong>
          <p>
            Please configure your Supabase credentials in the <code>.env</code> file:
          </p>
          <ul>
            <li><code>VITE_SUPABASE_URL</code></li>
            <li><code>VITE_SUPABASE_PUBLISHABLE_KEY</code></li>
          </ul>
          <p>Then restart the dev server.</p>
        </div>
      </div>

      <!-- Auth Form -->
      <div v-else class="auth-section">
        <form @submit.prevent="handleAuth" class="auth-form">
          <div class="form-group">
            <label for="email">Email</label>
            <input
              id="email"
              v-model="email"
              type="email"
              placeholder="your@email.com"
              required
              :disabled="isLoading"
            />
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input
              id="password"
              v-model="password"
              type="password"
              placeholder="At least 6 characters"
              required
              :disabled="isLoading"
            />
          </div>

          <button
            type="submit"
            class="auth-btn"
            :disabled="isLoading || !email || !password"
          >
            {{ isLogin ? 'Sign In' : 'Sign Up' }}
          </button>

          <button
            type="button"
            class="auth-btn auth-btn--secondary"
            @click="isLogin = !isLogin"
            :disabled="isLoading"
          >
            {{ isLogin ? 'Need an account?' : 'Already have an account?' }}
          </button>
        </form>

        <div v-if="error" class="alert alert-error">
          {{ error }}
        </div>

        <div class="auth-note">
          <strong>Next steps after signing in:</strong>
          <ol>
            <li>
              Run the SQL migrations in Supabase Dashboard
              <code>SQL Editor</code>:
            </li>
            <li>Paste contents of <code>supabase/migrations/00001_initial_schema.sql</code></li>
            <li>Paste contents of <code>supabase/migrations/00002_schema_hardening.sql</code></li>
            <li>Refresh the page to start practicing!</li>
          </ol>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

const email = ref('')
const password = ref('')
const isLogin = ref(true)
const isLoading = ref(false)
const error = ref('')

async function handleAuth() {
  isLoading.value = true
  error.value = ''

  try {
    let result
    if (isLogin.value) {
      result = await supabase.auth.signInWithPassword({
        email: email.value,
        password: password.value,
      })
    } else {
      result = await supabase.auth.signUp({
        email: email.value,
        password: password.value,
      })
    }

    if (result.error) {
      error.value = result.error.message
    } else {
      // Success — wait a moment for session to settle
      await new Promise((r) => setTimeout(r, 500))
      // Parent component should detect the session change and refresh
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Auth failed'
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.auth-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 1rem;
}

.auth-card {
  background: white;
  border-radius: 1rem;
  padding: 2.5rem 2rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 400px;
  width: 100%;
}

.auth-title {
  font-size: 1.75rem;
  font-weight: 800;
  color: #111827;
  text-align: center;
  margin: 0 0 0.25rem;
}

.auth-subtitle {
  font-size: 0.875rem;
  color: #6b7280;
  text-align: center;
  margin: 0 0 2rem;
}

.auth-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
}

.form-group input {
  padding: 0.75rem;
  font-size: 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
}

.form-group input:disabled {
  background: #f3f4f6;
  color: #9ca3af;
  cursor: not-allowed;
}

.auth-btn {
  padding: 0.75rem;
  font-size: 1rem;
  font-weight: 600;
  border: none;
  border-radius: 0.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  cursor: pointer;
  transition: opacity 0.2s;
}

.auth-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.auth-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.auth-btn--secondary {
  background: transparent;
  color: #667eea;
  border: 2px solid #e5e7eb;
  font-weight: 500;
}

.auth-btn--secondary:hover:not(:disabled) {
  background: #f9fafb;
}

.alert {
  padding: 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
}

.alert-error {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.alert strong {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
}

.alert p {
  margin: 0.5rem 0;
}

.alert ul,
.alert ol {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}

.alert li {
  margin: 0.25rem 0;
}

.alert code {
  background: rgba(0, 0, 0, 0.1);
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-family: monospace;
  font-size: 0.8em;
}

.auth-note {
  background: #f0f9ff;
  border: 1px solid #bfdbfe;
  border-radius: 0.5rem;
  padding: 1rem;
  font-size: 0.875rem;
  color: #1e40af;
}

.auth-note strong {
  display: block;
  margin-bottom: 0.5rem;
}

.auth-note ol {
  margin: 0;
  padding-left: 1.5rem;
}

.auth-note li {
  margin: 0.5rem 0;
}

.auth-note code {
  background: rgba(0, 0, 0, 0.1);
  padding: 0.2rem 0.4rem;
  border-radius: 0.25rem;
  font-family: monospace;
  font-size: 0.85em;
}
</style>
