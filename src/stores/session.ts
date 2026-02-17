import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { supabase } from '@/lib/supabase'
import type { Question } from '@/types/database'

const MIN_SESSION_SIZE = 5
const MAX_SESSION_SIZE = 10
const STORAGE_KEY = 'hardstop_active_session'

/** Persisted session snapshot for mobile resume */
interface SessionSnapshot {
  questionIds: string[]
  currentIndex: number
  savedAt: number
}

/** Max age before a snapshot is considered stale (2 hours) */
const MAX_SNAPSHOT_AGE_MS = 2 * 60 * 60 * 1000

/**
 * Fisher-Yates (Durstenfeld) in-place shuffle.
 */
function shuffle<T>(array: T[]): T[] {
  const a = [...array]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const useSessionStore = defineStore('session', () => {
  const questions = ref<Question[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const isRestoredSession = ref(false)

  // ── Persistence ────────────────────────────────────────────

  /**
   * Attempt to restore a session interrupted by app switch / tab close.
   * Returns true if a valid snapshot was restored.
   */
  async function tryRestore(): Promise<boolean> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return false

      const snapshot: SessionSnapshot = JSON.parse(raw)

      // Discard stale snapshots
      if (Date.now() - snapshot.savedAt > MAX_SNAPSHOT_AGE_MS) {
        localStorage.removeItem(STORAGE_KEY)
        return false
      }

      // Re-fetch questions by IDs to get fresh data
      const { data, error: fetchErr } = await supabase
        .from('questions')
        .select('*')
        .in('id', snapshot.questionIds)

      if (fetchErr || !data || data.length === 0) {
        localStorage.removeItem(STORAGE_KEY)
        return false
      }

      // Restore original order
      const byId = new Map(data.map((q) => [q.id, q as Question]))
      const ordered = snapshot.questionIds
        .map((id) => byId.get(id))
        .filter((q): q is Question => q !== undefined)

      questions.value = ordered
      isRestoredSession.value = true
      return true
    } catch {
      localStorage.removeItem(STORAGE_KEY)
      return false
    }
  }

  /** Save progress so the session can resume after interruption */
  function persistProgress(currentIndex: number) {
    if (questions.value.length === 0) return
    const snapshot: SessionSnapshot = {
      questionIds: questions.value.map((q) => q.id),
      currentIndex,
      savedAt: Date.now(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  }

  /** Clear persisted session (call on session complete or explicit abandon) */
  function clearPersistedSession() {
    localStorage.removeItem(STORAGE_KEY)
    isRestoredSession.value = false
  }

  /**
   * Select questions for a daily practice session.
   *
   * The session size is **dynamic**: at least one question from every
   * category is always included (hard guarantee). The target size is
   * then clamped between {@link MIN_SESSION_SIZE} and
   * {@link MAX_SESSION_SIZE}, but will exceed the max when the user
   * has more categories than {@link MAX_SESSION_SIZE}.
   *
   * Rules:
   *  1. At least one question from every category (non-negotiable).
   *  2. Prioritise questions whose `next_review` <= today.
   *  3. Fill remaining slots with the oldest `next_review` first.
   *  4. Return the set shuffled.
   */
  async function buildSession(): Promise<Question[]> {
    isLoading.value = true
    error.value = null

    try {
      // ── 1. Fetch all user questions ordered by next_review ASC ────────
      const { data: allQuestions, error: fetchError } = await supabase
        .from('questions')
        .select('*')
        .order('next_review', { ascending: true })

      if (fetchError) throw fetchError
      if (!allQuestions || allQuestions.length === 0) {
        questions.value = []
        return []
      }

      const today = new Date().toISOString()

      // ── 2. Group by category ─────────────────────────────────────────
      const byCategory = new Map<string, Question[]>()
      for (const q of allQuestions as Question[]) {
        const bucket = byCategory.get(q.category_id) ?? []
        bucket.push(q)
        byCategory.set(q.category_id, bucket)
      }

      const selected = new Map<string, Question>()  // id → Question (dedup)
      const categoryCount = byCategory.size

      // ── 3. Dynamic session size ──────────────────────────────────────
      //    Always >= categoryCount so every category is represented.
      //    Clamped to [MIN, MAX] unless categories exceed MAX.
      const sessionSize = Math.max(
        MIN_SESSION_SIZE,
        Math.min(MAX_SESSION_SIZE, categoryCount),
        categoryCount,               // hard floor: never drop a category
      )

      // ── 4. Guarantee one question per category ───────────────────────
      //    Prefer due questions; fall back to the one with the oldest next_review.
      for (const [, bucket] of byCategory) {
        const due = bucket.find((q) => q.next_review <= today)
        const pick = due ?? bucket[0]             // bucket is already sorted oldest-first
        selected.set(pick.id, pick)
      }

      // ── 5. Fill remaining slots ──────────────────────────────────────
      //    Priority: due questions first, then oldest next_review.
      if (selected.size < sessionSize) {
        const remaining = (allQuestions as Question[]).filter(
          (q) => !selected.has(q.id),
        )

        // Partition into due / not-yet-due
        const due = remaining.filter((q) => q.next_review <= today)
        const notDue = remaining.filter((q) => q.next_review > today)

        // Both sub-lists are already ordered by next_review ASC from the query.
        const filler = [...due, ...notDue]

        let slotsLeft = sessionSize - selected.size
        for (const q of filler) {
          if (slotsLeft <= 0) break
          selected.set(q.id, q)
          slotsLeft--
        }
      }

      // ── 6. Shuffle & store ───────────────────────────────────────────
      const session = shuffle([...selected.values()])
      questions.value = session

      // Persist immediately so a crash/switch doesn't lose the session
      persistProgress(0)

      return session
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to build session'
      questions.value = []
      return []
    } finally {
      isLoading.value = false
    }
  }

  return {
    questions,
    isLoading,
    isRestoredSession,
    error,
    buildSession,
    tryRestore,
    persistProgress,
    clearPersistedSession,
  }
})
