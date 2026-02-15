# Supabase Edge Functions

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
