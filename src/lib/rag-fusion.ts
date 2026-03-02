/**
 * RAG Fusion - Multi-query search with Reciprocal Rank Fusion
 *
 * Flow: Query → LLM generates variants → Parallel search → RRF merge → Top-K results
 */

import OpenAI from "openai";
import { searchCodebase, SearchResult } from "./rag-pipeline";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

const LLM_MODEL = process.env.LLM_MODEL || "gpt-4o-mini";
const FUSION_VARIANT_COUNT = 3;
const RRF_K = 60; // Standard RRF constant

/**
 * Generate query variants using the LLM.
 */
async function generateQueryVariants(
  query: string,
  count: number = FUSION_VARIANT_COUNT
): Promise<string[]> {
  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model: LLM_MODEL,
    messages: [
      {
        role: "system",
        content: `You are a search query reformulation assistant for a COBOL codebase. Given a user query, generate ${count} alternative search queries that approach the same topic from different angles. Each variant should help find relevant COBOL code chunks.

Return ONLY the queries, one per line, without numbering or extra text.`,
      },
      {
        role: "user",
        content: query,
      },
    ],
    temperature: 0.7,
    max_tokens: 300,
  });

  const text = response.choices[0]?.message?.content || "";
  const variants = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, count);

  return [query, ...variants];
}

/**
 * Reciprocal Rank Fusion: merge multiple ranked result lists.
 * Score = sum(1 / (k + rank)) across all lists where the item appears.
 */
function reciprocalRankFusion(
  resultSets: SearchResult[][],
  topK: number
): SearchResult[] {
  const scoreMap = new Map<string, { score: number; result: SearchResult }>();

  for (const results of resultSets) {
    for (let rank = 0; rank < results.length; rank++) {
      const result = results[rank];
      const rrfScore = 1 / (RRF_K + rank + 1);
      const existing = scoreMap.get(result.id);
      if (existing) {
        existing.score += rrfScore;
      } else {
        scoreMap.set(result.id, { score: rrfScore, result });
      }
    }
  }

  return Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ score, result }) => ({ ...result, score }));
}

export interface FusionSearchResult {
  results: SearchResult[];
  queryVariants: string[];
  perQueryResults: number[];
}

/**
 * RAG Fusion search: generate query variants, search in parallel, merge with RRF.
 */
export async function fusionSearch(
  query: string,
  topK: number = 5
): Promise<FusionSearchResult> {
  const queryVariants = await generateQueryVariants(query);

  // Search all variants in parallel, fetch more per query for better fusion
  const perQueryTopK = Math.max(topK, 10);
  const resultSets = await Promise.all(
    queryVariants.map((variant) => searchCodebase(variant, perQueryTopK))
  );

  const perQueryResults = resultSets.map((r) => r.length);
  const results = reciprocalRankFusion(resultSets, topK);

  return { results, queryVariants, perQueryResults };
}
