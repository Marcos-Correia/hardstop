# Project: HardStop - SRS Interview Trainer

## Overview
A web-based interview preparation tool using Spaced Repetition Systems (SRS) and AI-driven feedback. Users practice answering HR questions under time constraints to build muscle memory and fluency.

## Tech Stack
- **Frontend:** Vue 3 (Vite), Tailwind CSS, Pinia.
- **Backend/Auth:** Supabase (PostgreSQL, Auth, Edge Functions).
- **AI Integration:** OpenAI API (GPT-4o-mini for speed/cost).
- **Internationalization:** vue-i18n.

## Core Logic: The Session Engine
- **Session Size:** 5-10 questions.
- **Selection Rule:** At least one question from each category must be present.
- **SRS Algorithm:** Simplified SM-2 (intervals: 1d, 3d, 7d, 15d, 30d).
- **Adaptive Timer:** - User feedback "Too Short" -> Add 15s to `base_time_seconds`.
  - User feedback "Too Long" -> Subtract 10s from `base_time_seconds`.

## AI Workflow (Edge Functions)
1. **Pre-processing:** Clean grammar/typos before saving to DB.
2. **Evaluation:** Compare current answer with the user's earliest answer for the same question.
3. **Objective Metrics:** Fluency, STAR method alignment, and Conciseness.