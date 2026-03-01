import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { Category, Question, UserId, CategoryId, QuestionId } from '@/types/database'
import { asCategoryId, asQuestionId, asUserId } from '@/types/branded'

// ── Validation constants ────────────────────────────────────
export const MIN_CATEGORIES = 5
export const MAX_CATEGORIES = 10
export const MIN_QUESTIONS_PER_CATEGORY = 3
export const MAX_QUESTIONS_PER_CATEGORY = 5

// ── Metric types ────────────────────────────────────────────

/** Aggregated metrics for a single question */
export interface QuestionMetric {
  questionId: QuestionId
  questionText: string
  categoryId: CategoryId
  categoryName: string
  lastScore: number           // 0-100, from most recent attempt
  attemptCount: number
  lastAttemptDate: Date | null
  nextReviewDate: Date | null // From questions.next_review
  isMastered: boolean         // avg score >= 85% over last 3 attempts
}

/** Aggregated metrics for a category */
export interface CategoryMetric {
  categoryId: CategoryId
  categoryName: string
  questionCount: number
  masteredCount: number       // Questions with isMastered = true
  masteryPercentage: number   // (masteredCount / questionCount) * 100
  averageScore: number        // Avg across all questions in category (0-100)
  nextReviewCountdown: number // Days until oldest question is due (negative = overdue)
}

/** Shape returned by the Supabase join: attempts → questions → categories */
interface AttemptJoinedCategory {
  id: string
  name: string
}

interface AttemptJoinedQuestion {
  title: string
  category_id: string
  next_review: string | null
  categories: AttemptJoinedCategory | AttemptJoinedCategory[] | null
}

// Cache TTL: 5 minutes
const METRICS_CACHE_TTL = 5 * 60 * 1000

export const useQuestionsStore = defineStore('questions', () => {
  // ── State ─────────────────────────────────────────────────
  const categories = ref<Category[]>([])
  const questionsByCategory = ref<Map<CategoryId, Question[]>>(new Map())
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // ── Metrics state ─────────────────────────────────────────
  const questionMetrics = ref<Map<QuestionId, QuestionMetric>>(new Map())
  const categoryMetrics = ref<Map<CategoryId, CategoryMetric>>(new Map())
  const metricsLoading = ref(false)
  const metricsError = ref<string | null>(null)
  const lastMetricsUpdateTime = ref(0)

  // ── Getters ───────────────────────────────────────────────
  const categoryCount = computed(() => categories.value.length)
  const canAddCategory = computed(() => categories.value.length < MAX_CATEGORIES)
  const canDeleteCategory = computed(() => categories.value.length > 0)

  function questionCount(categoryId: CategoryId): number {
    return questionsByCategory.value.get(categoryId)?.length ?? 0
  }

  function canAddQuestion(categoryId: CategoryId): boolean {
    return questionCount(categoryId) < MAX_QUESTIONS_PER_CATEGORY
  }

  function canDeleteQuestion(categoryId: CategoryId): boolean {
    return questionCount(categoryId) > 0
  }

  /** True when every category has 3-5 questions and there are 5-10 categories */
  const isReadyForSession = computed(() => {
    if (categories.value.length < MIN_CATEGORIES) return false
    return categories.value.every((cat) => {
      const count = questionCount(cat.id)
      return count >= MIN_QUESTIONS_PER_CATEGORY && count <= MAX_QUESTIONS_PER_CATEGORY
    })
  })

  /** Summary of what's missing for the session to be ready */
  const readinessErrors = computed<string[]>(() => {
    const errors: string[] = []
    const catCount = categories.value.length
    if (catCount < MIN_CATEGORIES) {
      errors.push(`Need at least ${MIN_CATEGORIES} categories (have ${catCount})`)
    }
    for (const cat of categories.value) {
      const qCount = questionCount(cat.id)
      if (qCount < MIN_QUESTIONS_PER_CATEGORY) {
        errors.push(`"${cat.name}" needs at least ${MIN_QUESTIONS_PER_CATEGORY} questions (has ${qCount})`)
      }
    }
    return errors
  })

  // ── Helpers ───────────────────────────────────────────────

  async function getCurrentUserId(): Promise<UserId> {
    const { data } = await supabase.auth.getUser()
    if (!data.user) throw new Error('Not authenticated')
    return asUserId(data.user.id)
  }

  function castCategory(raw: Record<string, unknown>): Category {
    return {
      ...raw,
      id: asCategoryId(raw.id as string),
      user_id: asUserId(raw.user_id as string),
    } as Category
  }

  function castQuestion(raw: Record<string, unknown>): Question {
    return {
      ...raw,
      id: asQuestionId(raw.id as string),
      category_id: asCategoryId(raw.category_id as string),
      user_id: asUserId(raw.user_id as string),
    } as Question
  }

  // ── Category CRUD ─────────────────────────────────────────

  async function fetchCategories(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const { data, error: fetchErr } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true })

      if (fetchErr) throw fetchErr
      categories.value = (data ?? []).map(castCategory)

      // Fetch question counts for all categories in parallel
      await Promise.all(categories.value.map((cat) => fetchQuestions(cat.id)))
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch categories'
    } finally {
      isLoading.value = false
    }
  }

  async function addCategory(name: string, description?: string): Promise<Category | null> {
    error.value = null
    if (!canAddCategory.value) {
      error.value = `Maximum of ${MAX_CATEGORIES} categories allowed`
      return null
    }
    try {
      const userId = await getCurrentUserId()
      const sortOrder = categories.value.length

      const { data, error: insertErr } = await supabase
        .from('categories')
        .insert({
          user_id: userId,
          name: name.trim(),
          description: description?.trim() || null,
          sort_order: sortOrder,
        })
        .select()
        .single()

      if (insertErr) throw insertErr
      const category = castCategory(data)
      categories.value.push(category)
      questionsByCategory.value.set(category.id, [])
      return category
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to add category'
      return null
    }
  }

  async function updateCategory(
    id: CategoryId,
    updates: { name?: string; description?: string },
  ): Promise<boolean> {
    error.value = null
    try {
      const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (updates.name !== undefined) payload.name = updates.name.trim()
      if (updates.description !== undefined) payload.description = updates.description.trim() || null

      const { error: updateErr } = await supabase
        .from('categories')
        .update(payload)
        .eq('id', id)

      if (updateErr) throw updateErr

      const idx = categories.value.findIndex((c) => c.id === id)
      if (idx !== -1) {
        categories.value[idx] = { ...categories.value[idx], ...payload } as Category
      }
      return true
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to update category'
      return false
    }
  }

  async function deleteCategory(id: CategoryId): Promise<boolean> {
    error.value = null
    try {
      const { error: deleteErr } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)

      if (deleteErr) throw deleteErr

      categories.value = categories.value.filter((c) => c.id !== id)
      questionsByCategory.value.delete(id)
      return true
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to delete category'
      return false
    }
  }

  // ── Question CRUD ─────────────────────────────────────────

  async function fetchQuestions(categoryId: CategoryId): Promise<void> {
    try {
      const { data, error: fetchErr } = await supabase
        .from('questions')
        .select('*')
        .eq('category_id', categoryId)
        .order('created_at', { ascending: true })

      if (fetchErr) throw fetchErr
      questionsByCategory.value.set(
        categoryId,
        (data ?? []).map(castQuestion),
      )
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch questions'
    }
  }

  async function addQuestion(
    categoryId: CategoryId,
    title: string,
    hint?: string,
    baseTimeSeconds = 120,
    questionType: 'behavioral' | 'general' = 'behavioral',
  ): Promise<Question | null> {
    error.value = null
    if (!canAddQuestion(categoryId)) {
      error.value = `Maximum of ${MAX_QUESTIONS_PER_CATEGORY} questions per category`
      return null
    }
    try {
      const userId = await getCurrentUserId()
      const clampedTime = Math.max(30, Math.min(600, baseTimeSeconds))

      const { data, error: insertErr } = await supabase
        .from('questions')
        .insert({
          user_id: userId,
          category_id: categoryId,
          title: title.trim(),
          hint: hint?.trim() || null,
          base_time_seconds: clampedTime,
          question_type: questionType,
        })
        .select()
        .single()

      if (insertErr) throw insertErr
      const question = castQuestion(data)
      const bucket = questionsByCategory.value.get(categoryId) ?? []
      bucket.push(question)
      questionsByCategory.value.set(categoryId, bucket)
      return question
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to add question'
      return null
    }
  }

  async function bulkAddQuestions(
    categoryId: CategoryId,
    titles: string[],
    hints: string[] = [],
    baseTimeSeconds = 120,
    questionType: 'behavioral' | 'general' = 'behavioral',
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    error.value = null
    const result = { success: 0, failed: 0, errors: [] as string[] }
    
    const currentCount = questionCount(categoryId)
    const availableSlots = MAX_QUESTIONS_PER_CATEGORY - currentCount
    
    if (titles.length > availableSlots) {
      error.value = `Can only add ${availableSlots} more question(s) to this category`
      return result
    }

    try {
      const userId = await getCurrentUserId()
      const clampedTime = Math.max(30, Math.min(600, baseTimeSeconds))

      const inserts = titles.map((title, index) => ({
        user_id: userId,
        category_id: categoryId,
        title: title.trim(),
        hint: hints[index]?.trim() || null,
        base_time_seconds: clampedTime,
        question_type: questionType,
      }))

      const { data, error: insertErr } = await supabase
        .from('questions')
        .insert(inserts)
        .select()

      if (insertErr) throw insertErr
      
      const questions = (data ?? []).map(castQuestion)
      const bucket = questionsByCategory.value.get(categoryId) ?? []
      bucket.push(...questions)
      questionsByCategory.value.set(categoryId, bucket)
      
      result.success = questions.length
      return result
    } catch (e: unknown) {
      result.failed = titles.length
      result.errors.push(e instanceof Error ? e.message : 'Failed to bulk add questions')
      error.value = result.errors[0]
      return result
    }
  }

  async function updateQuestion(
    id: QuestionId,
    categoryId: CategoryId,
    updates: { title?: string; hint?: string; base_time_seconds?: number; question_type?: 'behavioral' | 'general' },
  ): Promise<boolean> {
    error.value = null
    try {
      const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (updates.title !== undefined) payload.title = updates.title.trim()
      if (updates.hint !== undefined) payload.hint = updates.hint.trim() || null
      if (updates.base_time_seconds !== undefined) {
        payload.base_time_seconds = Math.max(30, Math.min(600, updates.base_time_seconds))
      }
      if (updates.question_type !== undefined) payload.question_type = updates.question_type

      const { error: updateErr } = await supabase
        .from('questions')
        .update(payload)
        .eq('id', id)

      if (updateErr) throw updateErr

      const bucket = questionsByCategory.value.get(categoryId) ?? []
      const idx = bucket.findIndex((q) => q.id === id)
      if (idx !== -1) {
        bucket[idx] = { ...bucket[idx], ...payload } as Question
      }
      return true
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to update question'
      return false
    }
  }

  async function deleteQuestion(id: QuestionId, categoryId: CategoryId): Promise<boolean> {
    error.value = null
    try {
      const { error: deleteErr } = await supabase
        .from('questions')
        .delete()
        .eq('id', id)

      if (deleteErr) throw deleteErr

      const bucket = questionsByCategory.value.get(categoryId) ?? []
      questionsByCategory.value.set(
        categoryId,
        bucket.filter((q) => q.id !== id),
      )
      return true
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to delete question'
      return false
    }
  }

  // ── Metrics computed ───────────────────────────────────────

  /** Sorted array of question metrics (most recent attempt first) */
  const questionMetricsArray = computed<QuestionMetric[]>(() => {
    return Array.from(questionMetrics.value.values()).sort((a, b) => {
      const aTime = a.lastAttemptDate?.getTime() ?? 0
      const bTime = b.lastAttemptDate?.getTime() ?? 0
      return bTime - aTime
    })
  })

  /** Sorted array of category metrics (weakest mastery first) */
  const categoryMetricsArray = computed<CategoryMetric[]>(() => {
    return Array.from(categoryMetrics.value.values()).sort(
      (a, b) => a.masteryPercentage - b.masteryPercentage,
    )
  })

  /** Composite interview readiness score (0-100): weighted avg of all category mastery */
  const readinessScore = computed(() => {
    const arr = categoryMetricsArray.value
    if (arr.length === 0) return 0
    const totalScore = arr.reduce((sum, c) => sum + c.averageScore, 0)
    return Math.round(totalScore / arr.length)
  })

  /** True if user has at least 1 attempt recorded in metrics */
  const hasAttempts = computed(() => questionMetrics.value.size > 0)

  // ── Metrics calculation ───────────────────────────────────

  async function calculateMetrics(force = false): Promise<void> {
    // Skip if cache is fresh (unless forced)
    if (
      !force &&
      lastMetricsUpdateTime.value > 0 &&
      Date.now() - lastMetricsUpdateTime.value < METRICS_CACHE_TTL
    ) {
      return
    }

    metricsLoading.value = true
    metricsError.value = null

    try {
      const userId = await getCurrentUserId()

      // Single query with joins to fetch all data at once
      const { data, error: fetchErr } = await supabase
        .from('attempts')
        .select(`
          id,
          question_id,
          fluency_score,
          star_score,
          conciseness_score,
          created_at,
          questions:question_id(
            id,
            title,
            next_review,
            category_id,
            categories:category_id(
              id,
              name
            )
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (fetchErr) throw fetchErr

      // ── Group attempts by question_id ───────────────────
      const attemptsByQuestion = new Map<string, {
        questionId: QuestionId
        questionText: string
        categoryId: CategoryId
        categoryName: string
        nextReview: string | null
        scores: number[]      // average of 3 scores per attempt, 0-100
        lastAttemptDate: Date | null
        attemptCount: number
      }>()

      for (const raw of data ?? []) {
        const qid = raw.question_id as string
        const joined = raw.questions as AttemptJoinedQuestion[] | AttemptJoinedQuestion | null
        const questionData = Array.isArray(joined) ? joined[0] ?? null : joined
        if (!questionData) continue

        const categoryData = Array.isArray(questionData.categories)
          ? questionData.categories[0] ?? null
          : questionData.categories

        const avgScore = averageAttemptScore(
          raw.fluency_score,
          raw.star_score,
          raw.conciseness_score,
        )

        if (!attemptsByQuestion.has(qid)) {
          attemptsByQuestion.set(qid, {
            questionId: asQuestionId(qid),
            questionText: questionData.title ?? 'Unknown',
            categoryId: asCategoryId(questionData.category_id ?? ''),
            categoryName: categoryData?.name ?? 'Unknown',
            nextReview: questionData.next_review ?? null,
            scores: [],
            lastAttemptDate: null,
            attemptCount: 0,
          })
        }

        const entry = attemptsByQuestion.get(qid)!
        entry.scores.push(avgScore)
        entry.attemptCount++
        const attemptDate = new Date(raw.created_at)
        if (!entry.lastAttemptDate || attemptDate > entry.lastAttemptDate) {
          entry.lastAttemptDate = attemptDate
        }
      }

      // ── Build question metrics ──────────────────────────
      const newQuestionMetrics = new Map<QuestionId, QuestionMetric>()
      const categoryAccum = new Map<string, {
        categoryId: CategoryId
        categoryName: string
        totalScore: number
        questionCount: number
        masteredCount: number
        earliestNextReview: Date | null
      }>()

      for (const entry of attemptsByQuestion.values()) {
        // Scores are sorted newest first (from query ORDER BY)
        const lastScore = entry.scores.length > 0 ? Math.round(entry.scores[0]) : 0
        const last3 = entry.scores.slice(0, 3)
        const isMastered =
          last3.length >= 3 && last3.reduce((acc, s) => acc+s, 0) / last3.length >= 85

        const metric: QuestionMetric = {
          questionId: entry.questionId,
          questionText: entry.questionText,
          categoryId: entry.categoryId,
          categoryName: entry.categoryName,
          lastScore,
          attemptCount: entry.attemptCount,
          lastAttemptDate: entry.lastAttemptDate,
          nextReviewDate: entry.nextReview ? new Date(entry.nextReview) : null,
          isMastered,
        }

        newQuestionMetrics.set(entry.questionId, metric)

        // Accumulate for category metrics
        const catKey = entry.categoryId as string
        if (!categoryAccum.has(catKey)) {
          categoryAccum.set(catKey, {
            categoryId: entry.categoryId,
            categoryName: entry.categoryName,
            totalScore: 0,
            questionCount: 0,
            masteredCount: 0,
            earliestNextReview: null,
          })
        }
        const cat = categoryAccum.get(catKey)!
        cat.totalScore += lastScore
        cat.questionCount++
        if (isMastered) cat.masteredCount++

        if (metric.nextReviewDate) {
          if (!cat.earliestNextReview || metric.nextReviewDate < cat.earliestNextReview) {
            cat.earliestNextReview = metric.nextReviewDate
          }
        }
      }

      // ── Build category metrics ──────────────────────────
      const newCategoryMetrics = new Map<CategoryId, CategoryMetric>()

      for (const cat of categoryAccum.values()) {
        const now = new Date()
        const nextReviewCountdown = cat.earliestNextReview
          ? Math.ceil((cat.earliestNextReview.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : -1

        newCategoryMetrics.set(cat.categoryId, {
          categoryId: cat.categoryId,
          categoryName: cat.categoryName,
          questionCount: cat.questionCount,
          masteredCount: cat.masteredCount,
          masteryPercentage:
            cat.questionCount > 0
              ? Math.round((cat.masteredCount / cat.questionCount) * 100)
              : 0,
          averageScore:
            cat.questionCount > 0
              ? Math.round(cat.totalScore / cat.questionCount)
              : 0,
          nextReviewCountdown,
        })
      }

      // ── Commit to state ─────────────────────────────────
      questionMetrics.value = newQuestionMetrics
      categoryMetrics.value = newCategoryMetrics
      lastMetricsUpdateTime.value = Date.now()
    } catch (e: unknown) {
      metricsError.value = e instanceof Error ? e.message : 'Failed to load metrics'
    } finally {
      metricsLoading.value = false
    }
  }

  /** Compute average score from three 0-1 range scores → 0-100 */
  function averageAttemptScore(
    fluency: number | null,
    star: number | null,
    conciseness: number | null,
  ): number {
    const scores = [fluency, star, conciseness].filter(
      (s): s is number => s !== null && s !== undefined,
    )
    if (scores.length === 0) return 0
    return (scores.reduce((a, b) => a + b, 0) / scores.length) * 100
  }

  /** Force refresh on next calculateMetrics() call */
  function clearMetricsCache(): void {
    lastMetricsUpdateTime.value = 0
  }

  // ── Reset ─────────────────────────────────────────────────

  function $reset() {
    categories.value = []
    questionsByCategory.value = new Map()
    isLoading.value = false
    error.value = null
    questionMetrics.value = new Map()
    categoryMetrics.value = new Map()
    metricsLoading.value = false
    metricsError.value = null
    lastMetricsUpdateTime.value = 0
  }

  return {
    // State
    categories,
    questionsByCategory,
    isLoading,
    error,
    // Metrics state
    questionMetrics,
    categoryMetrics,
    metricsLoading,
    metricsError,
    // Getters
    categoryCount,
    canAddCategory,
    canDeleteCategory,
    isReadyForSession,
    readinessErrors,
    // Metrics getters
    questionMetricsArray,
    categoryMetricsArray,
    readinessScore,
    hasAttempts,
    // Category methods
    fetchCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    // Question helpers
    questionCount,
    canAddQuestion,
    canDeleteQuestion,
    // Question methods
    fetchQuestions,
    addQuestion,
    bulkAddQuestions,
    updateQuestion,
    deleteQuestion,
    // Metrics methods
    calculateMetrics,
    clearMetricsCache,
    // Misc
    $reset,
  }
})
