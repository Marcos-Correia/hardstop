# Supabase Edge Functions & Migrations
(read more on [Supabase Edge Functions](https://supabase.com/docs/guides/functions) and [Database Migrations](https://supabase.com/docs/guides/deployment/database-migrations))

## Database Migrations

Migrations are stored in `supabase/migrations/` and define schema changes (tables, columns, constraints, indexes, RLS policies).


### Applying Migrations Locally

```bash
supabase start        # Start local Postgres, Auth, etc.
supabase db reset     # Apply all migrations from scratch (idempotent)
```

### Applying Migrations Locally without reset (non-destructive)
```bash
supabase db up      # Apply only pending migrations (non-destructive)
```

`db reset` drops the entire local `public` schema and replays migrations in order. Use this after creating or modifying a migration file.

### Deploying Migrations to Production

```bash
supabase db push      # Apply all pending migrations to the remote project
```

**Before pushing:**
1. Test locally with `supabase db reset`
2. Verify no data loss (especially for `ALTER TABLE ... DROP COLUMN`)
3. Run `npm run type-check && npm run build` to ensure the schema matches TS types

---

## evaluate-answer

Corrects grammar/spelling in user answers and compares against baseline answers if provided.

### Endpoint
`POST /functions/v1/evaluate-answer`

### Request Body
```json
{
  "question": "Tell me about a time you faced a challenge.",
  "raw_answer": "i had to led a projct...",
  "baseline_answer": "optional"
}
```

### Response
```json
{
  "corrected_answer": "...",
  "comparison_score": { "vocabulary_improvement": 75, "conciseness_score": 82, "overall_score": 78 }
}
```

**Note:** `comparison_score` included only if `baseline_answer` provided.

### Environment Variables
- `OPENAI_API_KEY`: Required in Supabase Dashboard > Project Settings > Edge Functions

### Local Development
```bash
supabase start
supabase functions serve --env-file ./supabase/.env.local
```

### Deployment
```bash
supabase functions deploy evaluate-answer
supabase secrets set OPENAI_API_KEY=sk-...
```

### Frontend Usage
```typescript
const { data, error } = await supabase.functions.invoke('evaluate-answer', {
  body: { question, raw_answer, baseline_answer }
})
```

### Technical Details
- **Model:** GPT-4o-mini
- **Scoring:** Vocabulary improvement (60%), Conciseness (40%)
- Preserves original intent and tone
