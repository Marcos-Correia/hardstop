# HardStop - Copilot Coding Agent Instructions

## Repository Overview
**HardStop** is a web-based interview preparation platform using Spaced Repetition Systems (SRS) and AI feedback. Users practice answering HR questions under time constraints with adaptive timing and AI-driven evaluation.

**Repository Stats:**
- **Type:** Full-stack web application
- **Frontend:** Vue 3 (Composition API + `<script setup>`), TypeScript, Vite, Tailwind CSS, Pinia
- **Backend:** Supabase (PostgreSQL, Auth, RLS, Edge Functions)
- **AI:** OpenAI GPT-4o-mini via Edge Functions
- **Languages:** TypeScript (90%), SQL (migrations), JavaScript (config)
- **Size:** ~50 source files, 2 Edge Functions, 1 migration file

## Build & Development Commands

### Prerequisites
- **Node.js:** v18+ (tested on v18.17.0)
- **npm:** v9+ (comes with Node)
- **Supabase CLI:** v1.200+ (for Edge Functions)

### Installation (ALWAYS RUN FIRST)
```bash
npm install
```
**Timing:** ~30-60 seconds on first run, ~5-10 seconds on subsequent runs.

### Development Server
```bash
npm run dev
```
- Starts Vite dev server on `http://localhost:5173`
- Hot Module Replacement (HMR) enabled
- **Timing:** Server starts in 1-2 seconds
- **Common Issue:** Port 5173 already in use → Kill existing process or change port in `vite.config.ts`

### Build for Production
```bash
npm run build
```
- Compiles TypeScript + bundles with Vite
- Output: `dist/` directory
- **Timing:** 10-15 seconds
- **Critical:** ALWAYS run after TypeScript changes to catch type errors before commit

### Type Checking (Run Before Commits)
```bash
npm run type-check
```
- Runs `vue-tsc --noEmit` to validate TypeScript
- **Timing:** 5-10 seconds
- **Common Errors:**
  - Missing imports → Auto-import may not work, manually add imports
  - Branded type mismatches → Use type guards or explicit casts
  - `any` types → Strict mode enabled, must provide explicit types

### Linting
```bash
npm run lint
```
- Runs ESLint with Vue plugin
- **Auto-fix:** Most issues can be fixed with `npm run lint -- --fix`
- **Timing:** 3-5 seconds
- **Common Issues:**
  - Unused variables → Remove or prefix with `_`
  - Missing prop types → Add explicit TypeScript interfaces

### Preview Production Build
```bash
npm run build && npm run preview
```
- **Must build first** → Preview serves static files from `dist/`
- Runs on `http://localhost:4173`

### Supabase Edge Functions (Local Development)
```bash
# Start local Supabase stack (PostgreSQL, Auth, Storage, Edge Functions)
supabase start
# Timing: 30-60 seconds on first run

# Serve Edge Functions locally
supabase functions serve --env-file ./supabase/.env.local
# Timing: 5-10 seconds
# Default port: http://localhost:54321/functions/v1/

# Deploy Edge Functions to production
supabase functions deploy evaluate-answer
supabase functions deploy process-answer
```

**Environment Setup for Edge Functions:**
1. Create `supabase/.env.local`:
   ```
   OPENAI_API_KEY=sk-...
   ```
2. For production, set secrets via dashboard or CLI:
   ```bash
   supabase secrets set OPENAI_API_KEY=sk-...
   ```

### Testing Edge Functions Locally
```bash
# Example: Test evaluate-answer function
curl -i --location --request POST 'http://localhost:54321/functions/v1/evaluate-answer' \
  --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
  --header 'Content-Type: application/json' \
  --data '{"question":"What is your biggest strength?","raw_answer":"i am good at comunication"}'
```

## Project Architecture

### Directory Structure
```
hardstop/
├── src/
│   ├── components/
│   │   ├── session/              # Session flow (SessionView, CircularTimer, SessionProgress)
│   │   ├── AuthView.vue          # Sign in/up UI
│   │   └── AnswerEvaluationExample.vue  # AI feedback demo (not integrated)
│   ├── stores/
│   │   └── session.ts            # Pinia store: session state + SRS logic
│   ├── lib/
│   │   ├── supabase.ts           # Supabase client singleton
│   │   ├── srs.ts                # SM-2 algorithm implementation
│   │   └── adaptiveTimer.ts      # Timer adjustment based on user feedback
│   ├── locales/                  # i18n translation files (en.json only)
│   ├── types.ts                  # TypeScript branded types (UserId, QuestionId, etc.)
│   ├── App.vue                   # Root component with auth + routing
│   └── main.ts                   # Vue app entry point
├── supabase/
│   ├── migrations/
│   │   └── 00001_initial_schema.sql  # Complete DB schema (profiles, categories, questions, attempts)
│   ├── functions/
│   │   ├── evaluate-answer/      # Grammar correction + answer comparison
│   │   └── process-answer/       # Main AI workflow (calls evaluate-answer)
│   └── config.toml               # Supabase project configuration
├── public/                       # Static assets
├── index.html                    # HTML entry point
├── vite.config.ts                # Vite build configuration
├── tailwind.config.js            # Tailwind CSS configuration
├── tsconfig.json                 # TypeScript compiler options
└── package.json                  # Dependencies + npm scripts
```

### Key Configuration Files
- **`vite.config.ts`:** Vite setup, path aliases (`@/` → `src/`)
- **`tsconfig.json`:** Strict TypeScript, Vue JSX support
- **`.eslintrc.cjs`:** ESLint rules for Vue 3 + TypeScript
- **`tailwind.config.js`:** Tailwind theming + safe-area-inset support
- **`supabase/config.toml`:** Supabase project settings (API URL, keys)

### Database Schema (Read `supabase/migrations/00001_initial_schema.sql`)
**Tables:**
1. **`profiles`:** User data (full_name, avatar_url, locale) - linked to `auth.users`
2. **`categories`:** Question categories (user must create 5-10)
   - Fields: `id`, `user_id`, `name`, `created_at`
3. **`questions`:** Interview questions with SRS fields
   - Fields: `id`, `user_id`, `category_id`, `question_text`, `base_time_seconds` (30-600s)
   - SRS: `next_review`, `interval`, `ease_factor`, `repetitions`
4. **`attempts`:** Answer history with AI evaluation
   - Fields: `id`, `user_id`, `question_id`, `answer_raw`, `answer_corrected`, `time_feedback`
   - AI scores: `fluency_score`, `star_score`, `conciseness_score`, `ai_feedback`
   - Status: `processing_status` (pending/processing/completed/failed)

**Row Level Security (RLS):** All tables enforce `user_id = auth.uid()` policies.

### State Management (Pinia)
**`session.ts` store:**
- **Core Methods:**
  - `buildSession()`: Selects 5-10 questions using SRS + category balancing
  - `submitAnswer()`: Saves attempt to DB, triggers timer adjustment
  - `nextQuestion()`: Advances session, persists to LocalStorage
- **Selection Algorithm:**
  1. Filter due questions (`next_review <= NOW()`)
  2. **Hard guarantee:** At least one question per category
  3. Fill remaining slots with SRS-prioritized questions
  4. Fisher-Yates shuffle for randomness

### TypeScript Branded Types (CRITICAL)
**Defined in `src/types.ts`:**
```typescript
type UserId = string & { readonly __brand: 'UserId' };
type CategoryId = string & { readonly __brand: 'CategoryId' };
type QuestionId = string & { readonly __brand: 'QuestionId' };
type AttemptId = string & { readonly __brand: 'AttemptId' };
```
**Why:** Prevents accidental ID misuse (e.g., passing `CategoryId` where `QuestionId` expected).

**Usage Pattern:**
```typescript
// Cast from Supabase response
const userId = session.user?.id as UserId;

// Type guard for safety
function isUserId(id: string): id is UserId {
  return id.startsWith('user_'); // Adjust based on ID format
}
```

### AI Workflow (Edge Functions)
**Two-phase processing:**
1. **`process-answer`** (Main endpoint):
   - Input: `attemptId`, `questionTitle`, `answerRaw`, `userId`, `questionId`
   - Calls `evaluate-answer` internally
   - Updates `attempts` table with corrected answer + scores
2. **`evaluate-answer`** (Internal):
   - Grammar correction with GPT-4o-mini
   - Compares to user's first attempt (if exists)
   - Returns: `corrected_answer`, `fluency_score`, `star_score`, `conciseness_score`, `ai_feedback`

**Status Tracking:** `processing_status` field in `attempts` table.

### SRS Algorithm (`src/lib/srs.ts`)
- **Based on:** Simplified SM-2
- **Intervals:** 1d, 3d, 7d, 15d, 30d
- **Grade Mapping:**
  - 0-59% → HARD (Grade 1)
  - 60-84% → GOOD (Grade 3)
  - 85-100% → EASY (Grade 5)
- **Function:** `computeSrsUpdate(question, grade)` returns `{ next_review, interval, ease_factor, repetitions }`

### Adaptive Timer (`src/lib/adaptiveTimer.ts`)
**User feedback adjustments:**
- "Too Short" → `base_time_seconds + 15`
- "Too Long" → `base_time_seconds - 10`
- "Just Right" → No change
- **Bounds:** [30s, 600s]

## Validation & CI/CD

**Pre-Commit Checklist (Manual - No GitHub Actions Yet):**
1. `npm install` (if `package.json` changed)
2. `npm run type-check` (must pass with zero errors)
3. `npm run lint` (fix issues with `--fix` flag)
4. `npm run build` (must succeed without warnings)
5. Test locally: `npm run dev` → Verify changes in browser

**No automated CI/CD pipeline exists yet.** All validation is manual.

## Common Gotchas & Workarounds

### 1. Supabase Client Initialization
**Issue:** `createClient` requires valid URL/key even in dev.
**Solution:** `src/lib/supabase.ts` uses fallback values:
```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'fallback-key';
```
**Dev Setup:** Create `.env.local` with actual Supabase credentials.

### 2. Session Persistence
**Issue:** Mobile users switch apps mid-session → lose progress.
**Solution:** `session.ts` writes snapshot to `localStorage` on every `nextQuestion()`.
**Recovery:** `buildSession()` checks for existing snapshot and resumes.

### 3. Timer Drift in SessionView
**Issue:** `setInterval` accumulates drift over long sessions.
**Solution:** `CircularTimer.vue` uses `Date.now()` delta calculation instead of `setInterval` increments.

### 4. Branded Type Casting
**Issue:** Supabase returns plain strings, not branded types.
**Solution:** Explicitly cast in data layer:
```typescript
const { data } = await supabase.from('questions').select();
const questions: Question[] = data.map(q => ({
  ...q,
  id: q.id as QuestionId,
  user_id: q.user_id as UserId,
  category_id: q.category_id as CategoryId,
}));
```

### 5. Edge Function CORS
**Issue:** Local dev calls to Edge Functions fail with CORS error.
**Solution:** Edge Functions auto-handle CORS. If issue persists, ensure:
- Request includes `Authorization: Bearer <anon_key>` header
- `Content-Type: application/json` header present

## Critical Implementation Gaps (As of 2026-02-14)

**P0 Blockers (App Cannot Be Used):**
1. **Question Management UI Missing:**
   - No screens to create/edit categories (requirement: 5-10 categories)
   - No screens to add/edit questions (requirement: 3-5 per category)
   - Files to create: `src/components/questions/CategoriesView.vue`, `QuestionsList.vue`

2. **AI Integration Not Connected:**
   - `SessionView.vue` doesn't call `process-answer` Edge Function after submission
   - No UI to display AI feedback (`answer_corrected`, scores, `ai_feedback`)

3. **SRS Updates Not Applied:**
   - `SessionView.vue` doesn't call `computeSrsUpdate()` to update `next_review`/`interval` after session

**P1 High Priority:**
- History/analytics screen to view past attempts
- Navigation menu (Home, Questions, History, Profile)
- Logout button

## Agent Instructions

**TRUST THESE INSTRUCTIONS.** Only search the codebase if:
1. Information here is incomplete or contradicts observed behavior
2. You need to view specific implementation details of a function/component

**When Making Changes:**
1. **Always** run `npm install` if modifying `package.json`
2. **Always** run `npm run type-check` after TypeScript changes
3. **Always** use branded types for IDs (cast Supabase responses)
4. **Always** use Composition API with `<script setup lang="ts">` for Vue components
5. **Always** use Tailwind utilities (no inline styles or `<style>` blocks)
6. **Always** check RLS policies in migrations before adding new queries
7. **Never** commit `.env.local` or Supabase keys

**Style Conventions:**
- **Props:** Destructure with `withDefaults(defineProps<...>(), { ... })`
- **Emits:** Type-safe with `defineEmits<{ eventName: [arg: Type] }>()`
- **Async:** Use `async/await`, always handle Supabase errors
- **i18n:** Wrap all user-facing strings in `$t('key')` even if only English exists

**Testing Edge Functions Locally:**
1. Start Supabase: `supabase start`
2. Serve functions: `supabase functions serve --env-file ./supabase/.env.local`
3. Use `curl` or Postman with local anon key (see README.md example)

**Mobile Responsiveness:**
- Use `sm:`, `md:`, `lg:` Tailwind breakpoints
- Add `env(safe-area-inset-*)` for notched devices
- Minimum 44px touch targets for buttons (WCAG 2.5.5)