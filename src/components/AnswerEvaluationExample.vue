<script setup lang="ts">
import { ref } from 'vue'
import { evaluateAnswer } from '@/lib/answerEvaluation'

const question = ref('Tell me about a time you demonstrated leadership.')
const rawAnswer = ref('')
const baselineAnswer = ref('') // Optional: user's first attempt
const isEvaluating = ref(false)
const result = ref<{
  corrected: string
  score?: number
} | null>(null)
const error = ref('')

async function handleEvaluate() {
  if (!rawAnswer.value.trim()) {
    error.value = 'Please enter an answer'
    return
  }

  isEvaluating.value = true
  error.value = ''
  result.value = null

  try {
    const response = await evaluateAnswer({
      question: question.value,
      raw_answer: rawAnswer.value,
      baseline_answer: baselineAnswer.value || undefined,
    })

    result.value = {
      corrected: response.corrected_answer,
      score: response.comparison_score?.overall_score,
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to evaluate answer'
  } finally {
    isEvaluating.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto p-6 space-y-6">
    <div>
      <h2 class="text-2xl font-bold mb-4">Answer Evaluation Example</h2>
      
      <div class="space-y-4">
        <!-- Question Display -->
        <div>
          <label class="block text-sm font-medium mb-2">Question:</label>
          <p class="p-3 bg-gray-50 rounded-lg">{{ question }}</p>
        </div>

        <!-- Raw Answer Input -->
        <div>
          <label for="raw-answer" class="block text-sm font-medium mb-2">
            Your Answer:
          </label>
          <textarea
            id="raw-answer"
            v-model="rawAnswer"
            rows="6"
            class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Type your answer here... Don't worry about typos!"
            :disabled="isEvaluating"
          />
        </div>

        <!-- Optional: Baseline Answer -->
        <div>
          <label for="baseline" class="block text-sm font-medium mb-2">
            Baseline Answer (optional - for comparison):
          </label>
          <textarea
            id="baseline"
            v-model="baselineAnswer"
            rows="3"
            class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Your first attempt (optional)"
            :disabled="isEvaluating"
          />
        </div>

        <!-- Evaluate Button -->
        <button
          @click="handleEvaluate"
          :disabled="isEvaluating"
          class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {{ isEvaluating ? 'Evaluating...' : 'Evaluate Answer' }}
        </button>

        <!-- Error Display -->
        <div v-if="error" class="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {{ error }}
        </div>

        <!-- Results Display -->
        <div v-if="result" class="space-y-4">
          <div class="p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 class="font-semibold mb-2">Corrected Answer:</h3>
            <p class="text-gray-800">{{ result.corrected }}</p>
          </div>

          <div v-if="result.score !== undefined" class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 class="font-semibold mb-2">Improvement Score:</h3>
            <div class="flex items-center gap-2">
              <div class="text-3xl font-bold text-blue-600">{{ result.score }}</div>
              <div class="text-sm text-gray-600">/100</div>
            </div>
            <p class="text-sm text-gray-600 mt-1">
              Based on vocabulary improvement and conciseness
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
