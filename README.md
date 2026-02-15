# HardStop

A web-based interview preparation platform using Spaced Repetition Systems (SRS) and AI feedback. Practice answering HR questions under time constraints with adaptive timing and AI-driven evaluation.

## Quick Start

### Prerequisites
- **Node.js:** v22+ (tested on v22.14.0)
- **npm:** v11+
- **Supabase CLI:** v1.200+ (for Edge Functions)

### Installation & Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
# Opens http://localhost:5173

# Type checking (run before commits)
npm run type-check

# Linting
npm run lint

# Production build
npm run build

# Preview production build
npm run preview
```

## Technology Stack

### Frontend
- **Framework:** Vue 3 (Composition API + `<script setup>`)
- **Language:** TypeScript
- **Build:** Vite
- **Styling:** Tailwind CSS
- **State:** Pinia
- **i18n:** Vue I18n

### Backend
- **Database:** Supabase PostgreSQL
- **Auth:** Supabase Auth with RLS
- **Functions:** Supabase Edge Functions
- **AI:** OpenAI GPT-4o-mini

## Project Structure

```
src/
  ├── components/
  │   ├── session/          # Session flow (SessionView, Timer, Progress)
  │   ├── questions/        # Question management (Categories, Questions)
  │   └── AuthView.vue      # Authentication
  ├── stores/
  │   ├── session.ts        # Session state + SRS logic (Pinia)
  │   └── questions.ts      # Question management state
  ├── lib/
  │   ├── supabase.ts       # Supabase client
  │   ├── srs.ts            # SM-2 algorithm
  │   └── adaptiveTimer.ts  # Timer adjustment logic
  ├── types/
  │   ├── branded.ts        # Branded types for type safety
  │   └── database.ts       # Database schemas
  └── App.vue, main.ts
supabase/
  ├── migrations/           # Database schema
  ├── functions/            # Edge Functions
  │   ├── evaluate-answer/  # Grammar correction + comparison
  │   └── process-answer/   # Main AI workflow
  └── config.toml
```

## Database Schema

**Tables:**
- **profiles:** User data linked to `auth.users`
- **categories:** Question categories (per user, 5-10 recommended)
- **questions:** Interview questions with SRS fields (`next_review`, `interval`, `ease_factor`, `repetitions`)
- **attempts:** Answer history with AI scores (`fluency_score`, `star_score`, `conciseness_score`, `ai_feedback`)

All tables enforce Row Level Security (RLS) using `user_id = auth.uid()` policies.

See [supabase/migrations/](supabase/migrations/) for complete schema.

## Key Features

### Spaced Repetition System (SRS)
- SM-2 algorithm implementation
- Adaptive review intervals (1d → 30d)
- Grade-based scheduling (HARD: 1d, GOOD: 3d, EASY: 7d)
- Smart question selection with category balancing

### Session Management
- Builds 5-10 question sessions
- Guarantees at least one question per category
- SRS-prioritized question selection
- Persistent session recovery via localStorage

### AI Evaluation
- Two-stage processing: `process-answer` → `evaluate-answer`
- Grammar/spelling correction with GPT-4o-mini
- Vocabulary improvement scoring (60% weight)
- Conciseness scoring (40% weight)
- Tracks processing status (pending → processing → completed/failed)

### Adaptive Timing
- Adjusts `base_time_seconds` based on user feedback
- "Too Short" → +15s, "Too Long" → -10s, "Just Right" → no change
- Bounds: [30s, 600s]

## Supabase Edge Functions

### Local Development

```bash
# Start Supabase stack
supabase start

# Serve functions locally
supabase functions serve --env-file ./supabase/.env.local
```

**Environment:** Create `supabase/.env.local`:
```
OPENAI_API_KEY=sk-...
```

### Deployment

```bash
supabase functions deploy evaluate-answer
supabase secrets set OPENAI_API_KEY=sk-...
```

See [supabase/functions/README.md](supabase/functions/README.md) for API details.

## TypeScript Branded Types

All IDs use branded types for type safety:
```typescript
type UserId = string & { readonly __brand: 'UserId' };
type CategoryId = string & { readonly __brand: 'CategoryId' };
type QuestionId = string & { readonly __brand: 'QuestionId' };
```

Cast Supabase responses:
```typescript
const userId = session.user?.id as UserId;
```

## Pre-Commit Checklist

1. `npm run type-check` (must pass with zero errors)
2. `npm run lint` (fix with `--fix` flag)
3. `npm run build` (verify success)
4. Test locally: `npm run dev`

## Architecture Highlights

- **Session Persistence:** Saves to localStorage on every question advance
- **Timer Drift Prevention:** Uses `Date.now()` delta instead of setInterval
- **CORS Handling:** Edge Functions auto-handle CORS
- **Mobile Responsive:** Tailwind breakpoints (sm/md/lg) + safe-area-inset support

## Known Limitations

- No automated CI/CD pipeline (manual validation only)
- Question creation/editing UI in development
- AI integration not yet fully connected to SessionView

## License

Private project for HardStop interview prep platform.
