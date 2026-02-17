import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { Attempt } from '@/types/database'
import { asAttemptId } from '@/types/branded'

export interface AttemptWithQuestion extends Attempt {
  question_title: string
  category_name: string
}

export interface AttemptsStats {
  totalAttempts: number
  averageFluency: number
  averageStar: number
  averageConciseness: number
  lastAttemptDate: string | null
  completedCount: number
}

export const useAttemptsStore = defineStore('attempts', () => {
  // ── State ─────────────────────────────────────────────────
  const attempts = ref<AttemptWithQuestion[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // ── Filters ───────────────────────────────────────────────
  const selectedQuestionFilter = ref<string | null>(null) // question_id or null for all
  const selectedCategoryFilter = ref<string | null>(null) // category_name or null for all
  const sortBy = ref<'date_desc' | 'date_asc' | 'score_desc'>('date_desc')

  // ── Getters ───────────────────────────────────────────────

  const filteredAttempts = computed(() => {
    let filtered = [...attempts.value]

    // Filter by question
    if (selectedQuestionFilter.value) {
      filtered = filtered.filter((a) => a.question_id === selectedQuestionFilter.value)
    }

    // Filter by category
    if (selectedCategoryFilter.value) {
      filtered = filtered.filter((a) => a.category_name === selectedCategoryFilter.value)
    }

    // Sort
    if (sortBy.value === 'date_desc') {
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    } else if (sortBy.value === 'date_asc') {
      filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    } else if (sortBy.value === 'score_desc') {
      filtered.sort((a, b) => {
        const aScore = ((a.fluency_score ?? 0) + (a.star_score ?? 0) + (a.conciseness_score ?? 0)) / 3
        const bScore = ((b.fluency_score ?? 0) + (b.star_score ?? 0) + (b.conciseness_score ?? 0)) / 3
        return bScore - aScore
      })
    }

    return filtered
  })

  const uniqueCategories = computed(() => {
    const cats = new Set<string>()
    for (const attempt of attempts.value) {
      cats.add(attempt.category_name)
    }
    return Array.from(cats).sort()
  })

  const uniqueQuestions = computed(() => {
    const questions = new Map<string, string>() // id -> title
    for (const attempt of attempts.value) {
      // If a category is selected, only include questions from that category
      if (selectedCategoryFilter.value && attempt.category_name !== selectedCategoryFilter.value) {
        continue
      }
      questions.set(attempt.question_id, attempt.question_title)
    }
    return Array.from(questions.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  })

  const stats = computed<AttemptsStats>(() => {
    if (attempts.value.length === 0) {
      return {
        totalAttempts: 0,
        averageFluency: 0,
        averageStar: 0,
        averageConciseness: 0,
        lastAttemptDate: null,
        completedCount: 0,
      }
    }

    let totalFluency = 0
    let totalStar = 0
    let totalConciseness = 0
    let completedCount = 0

    for (const attempt of attempts.value) {
      if (attempt.processing_status === 'complete' && attempt.fluency_score !== null) {
        totalFluency += attempt.fluency_score
        totalStar += attempt.star_score ?? 0
        totalConciseness += attempt.conciseness_score ?? 0
        completedCount++
      }
    }

    const sorted = [...attempts.value].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    return {
      totalAttempts: attempts.value.length,
      averageFluency: completedCount > 0 ? totalFluency / completedCount : 0,
      averageStar: completedCount > 0 ? totalStar / completedCount : 0,
      averageConciseness: completedCount > 0 ? totalConciseness / completedCount : 0,
      lastAttemptDate: sorted[0]?.created_at ?? null,
      completedCount,
    }
  })

  // ── Methods ───────────────────────────────────────────────

  async function fetchAttempts(): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      // Fetch attempts with joined question and category info
      const { data, error: fetchErr } = await supabase
        .from('attempts')
        .select(
          `
          *,
          questions:question_id(title, category_id, categories:category_id(name))
        `
        )
        .order('created_at', { ascending: false })

      if (fetchErr) throw fetchErr

      // Transform data to include question title and category name
      attempts.value = (data ?? []).map((raw: any) => ({
        ...raw,
        id: asAttemptId(raw.id),
        question_title: raw.questions?.title ?? 'Unknown',
        category_name: raw.questions?.categories?.name ?? 'Unknown',
      }))
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch attempts'
    } finally {
      isLoading.value = false
    }
  }

  function setQuestionFilter(questionId: string | null) {
    selectedQuestionFilter.value = questionId
  }

  function setCategoryFilter(categoryName: string | null) {
    selectedCategoryFilter.value = categoryName
    // Always clear question filter when category changes to avoid stale selection
    selectedQuestionFilter.value = null
  }

  function setSortBy(sort: 'date_desc' | 'date_asc' | 'score_desc') {
    sortBy.value = sort
  }

  function clearFilters() {
    selectedQuestionFilter.value = null
    selectedCategoryFilter.value = null
    sortBy.value = 'date_desc'
  }

  return {
    attempts,
    filteredAttempts,
    uniqueCategories,
    uniqueQuestions,
    stats,
    isLoading,
    error,
    sortBy,
    selectedQuestionFilter,
    selectedCategoryFilter,
    fetchAttempts,
    setQuestionFilter,
    setCategoryFilter,
    setSortBy,
    clearFilters,
  }
})
