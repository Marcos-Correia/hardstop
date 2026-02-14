/**
 * Branded types prevent accidental parameter swapping of string IDs.
 *
 * Example: `updateQuestion(userId, questionId)` cannot be called as
 * `updateQuestion(questionId, userId)` when both params are branded.
 *
 * Zero runtime cost — the brand exists only at the type level.
 */

declare const __brand: unique symbol

type Brand<T, B extends string> = T & { readonly [__brand]: B }

// ── Branded ID types ──────────────────────────────────────
export type UserId = Brand<string, 'UserId'>
export type QuestionId = Brand<string, 'QuestionId'>
export type CategoryId = Brand<string, 'CategoryId'>
export type AttemptId = Brand<string, 'AttemptId'>
export type ProfileId = Brand<string, 'ProfileId'>

// ── Runtime boundary helpers ──────────────────────────────
// Use these when receiving raw strings from DB / API responses.
export const asUserId = (id: string) => id as UserId
export const asQuestionId = (id: string) => id as QuestionId
export const asCategoryId = (id: string) => id as CategoryId
export const asAttemptId = (id: string) => id as AttemptId
export const asProfileId = (id: string) => id as ProfileId
