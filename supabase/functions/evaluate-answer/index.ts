import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface RequestBody {
  question: string;
  raw_answer: string;
  baseline_answer?: string;
}

interface EvaluationResponse {
  corrected_answer: string;
  comparison_score?: {
    vocabulary_improvement: number; // 0-100
    conciseness_score: number; // 0-100
    overall_score: number; // 0-100
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { question, raw_answer, baseline_answer }: RequestBody = await req.json();

    // Validate input
    if (!question || !raw_answer) {
      return new Response(
        JSON.stringify({ error: "question and raw_answer are required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    // Step 1: Fix grammar and spelling while preserving intent
    const correctionPrompt = `You are a grammar and spelling corrector. Fix any grammar or spelling errors in the following answer while preserving the user's original intent, tone, and key points. Do not add new information or significantly rephrase ideas.

Question: ${question}

User's Answer: ${raw_answer}

Return ONLY the corrected answer text, without any additional commentary or formatting.`;

    const correctionResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a professional editor who fixes grammar and spelling while preserving the author's voice and intent."
          },
          {
            role: "user",
            content: correctionPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    if (!correctionResponse.ok) {
      throw new Error(`OpenAI API error: ${correctionResponse.status}`);
    }

    const correctionData = await correctionResponse.json();
    const corrected_answer = correctionData.choices[0].message.content.trim();

    const response: EvaluationResponse = {
      corrected_answer,
    };

    // Step 2: Compare with baseline if provided
    if (baseline_answer) {
      const comparisonPrompt = `You are an expert interview coach evaluating improvements between two answers to the same question.

Question: ${question}

Baseline Answer (First Attempt): ${baseline_answer}

Current Answer (Corrected): ${corrected_answer}

Evaluate the current answer compared to the baseline on these dimensions:

1. **Vocabulary Improvement** (0-100): Has the user improved their word choice, used more professional terminology, or demonstrated better communication skills? Consider:
   - Use of more precise or impactful words
   - Professional terminology
   - Reduced filler words or verbal crutches
   
2. **Conciseness Score** (0-100): Is the current answer more focused and to-the-point? Consider:
   - Elimination of unnecessary details
   - Better structure and organization
   - Clearer main points
   - Appropriate length (not too verbose, not too brief)

Return ONLY a JSON object in this exact format (no markdown formatting):
{
  "vocabulary_improvement": <number 0-100>,
  "conciseness_score": <number 0-100>,
  "reasoning": "<brief explanation>"
}`;

      const comparisonResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are an expert interview coach. Respond only with valid JSON."
            },
            {
              role: "user",
              content: comparisonPrompt
            }
          ],
          temperature: 0.2,
          max_tokens: 500,
          response_format: { type: "json_object" },
        }),
      });

      if (!comparisonResponse.ok) {
        throw new Error(`OpenAI comparison API error: ${comparisonResponse.status}`);
      }

      const comparisonData = await comparisonResponse.json();
      const comparisonResult = JSON.parse(comparisonData.choices[0].message.content);

      // Calculate overall score as weighted average
      const vocabulary_improvement = comparisonResult.vocabulary_improvement;
      const conciseness_score = comparisonResult.conciseness_score;
      const overall_score = Math.round((vocabulary_improvement * 0.6) + (conciseness_score * 0.4));

      response.comparison_score = {
        vocabulary_improvement,
        conciseness_score,
        overall_score,
      };
    }

    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error("Error in evaluate-answer function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
