/**
 * Re-Ranker Module
 *
 * Provides two re-ranking strategies:
 * 1. Cohere re-ranker (production) — uses Cohere's rerank API for high-quality semantic re-ranking
 * 2. Cross-encoder style LLM re-ranker (fallback) — uses GPT-4o-mini to score relevance
 *
 * The re-ranker sits between retrieval and answer generation to improve precision.
 */

import OpenAI from "openai";
import { SearchResult } from "./rag-pipeline";
import { getOpenAIKey, models, reranker as rerankerConfig } from "./config";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: getOpenAIKey() });
  }
  return openaiClient;
}

export interface RerankedResult extends SearchResult {
  originalScore: number;
  rerankerScore: number;
  relevanceLabel: "highly_relevant" | "relevant" | "partially_relevant" | "not_relevant";
}

/**
 * Cohere Re-Ranker: calls the Cohere rerank endpoint.
 * Falls back to LLM re-ranker if COHERE_API_KEY is not set.
 */
export async function cohereRerank(
  query: string,
  results: SearchResult[],
  topN?: number
): Promise<RerankedResult[]> {
  const apiKey = process.env.COHERE_API_KEY;

  if (!apiKey) {
    console.log("COHERE_API_KEY not set — falling back to LLM re-ranker");
    return llmRerank(query, results, topN);
  }

  const finalTopN = topN ?? rerankerConfig.topN;

  try {
    const response = await fetch("https://api.cohere.com/v2/rerank", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: rerankerConfig.cohereModel,
        query,
        documents: results.map((r) => ({
          text: `File: ${r.filePath} (Lines ${r.lineStart}-${r.lineEnd})\n${r.division}${r.section ? ` > ${r.section}` : ""}${r.paragraphName ? ` > ${r.paragraphName}` : ""}\n${r.content}`,
        })),
        top_n: finalTopN,
        return_documents: false,
      }),
    });

    if (!response.ok) {
      console.error(`Cohere rerank failed (${response.status}) — falling back to LLM re-ranker`);
      return llmRerank(query, results, topN);
    }

    const data = await response.json();
    const reranked: RerankedResult[] = data.results.map(
      (item: { index: number; relevance_score: number }) => {
        const original = results[item.index];
        return {
          ...original,
          originalScore: original.score,
          rerankerScore: item.relevance_score,
          score: item.relevance_score,
          relevanceLabel: scoreToLabel(item.relevance_score),
        };
      }
    );

    return reranked.sort((a, b) => b.rerankerScore - a.rerankerScore);
  } catch (error) {
    console.error("Cohere rerank error — falling back to LLM re-ranker:", error);
    return llmRerank(query, results, topN);
  }
}

/**
 * LLM-based re-ranker: uses GPT-4o-mini to score query-document relevance.
 * This is the fallback when Cohere is not available.
 */
export async function llmRerank(
  query: string,
  results: SearchResult[],
  topN?: number
): Promise<RerankedResult[]> {
  const openai = getOpenAI();
  const finalTopN = topN ?? rerankerConfig.topN;

  // Build a single prompt that asks the LLM to score all results
  const documentsText = results
    .map(
      (r, i) =>
        `[Document ${i}]
File: ${r.filePath} (Lines ${r.lineStart}-${r.lineEnd})
${r.division}${r.section ? ` > ${r.section}` : ""}
${r.content.slice(0, rerankerConfig.maxChunkChars)}`
    )
    .join("\n\n");

  const response = await openai.chat.completions.create({
    model: models.llm,
    messages: [
      {
        role: "system",
        content: `You are a relevance scoring assistant for a COBOL codebase search engine. Given a user query and a set of retrieved code documents, score each document's relevance to the query on a scale of 0.0 to 1.0.

Return ONLY a JSON array of objects with "index" (document number) and "score" (0.0-1.0).
Example: [{"index": 0, "score": 0.95}, {"index": 1, "score": 0.3}]

Scoring guidelines:
- 0.9-1.0: Directly answers the query with exact code/logic requested
- 0.7-0.89: Highly relevant, contains key information
- 0.4-0.69: Partially relevant, related but incomplete
- 0.0-0.39: Not relevant to the query`,
      },
      {
        role: "user",
        content: `Query: "${query}"

${documentsText}

Score each document's relevance to the query. Return ONLY the JSON array.`,
      },
    ],
    temperature: 0.1,
    max_tokens: 500,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content || "{}";
  let scores: { index: number; score: number }[] = [];

  try {
    const parsed = JSON.parse(content);
    // Handle both {scores: [...]} and direct array formats
    scores = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.scores)
        ? parsed.scores
        : Array.isArray(parsed.results)
          ? parsed.results
          : [];
  } catch {
    console.error("Failed to parse LLM reranker scores, returning original order");
    return results.slice(0, finalTopN).map((r) => ({
      ...r,
      originalScore: r.score,
      rerankerScore: r.score,
      relevanceLabel: scoreToLabel(r.score) as RerankedResult["relevanceLabel"],
    }));
  }

  // Build a map of index → score
  const scoreMap = new Map(scores.map((s) => [s.index, s.score]));

  const reranked: RerankedResult[] = results.map((r, i) => {
    const rerankScore = scoreMap.get(i) ?? 0.5; // default to middle if LLM missed it
    return {
      ...r,
      originalScore: r.score,
      rerankerScore: rerankScore,
      score: rerankScore,
      relevanceLabel: scoreToLabel(rerankScore),
    };
  });

  return reranked
    .sort((a, b) => b.rerankerScore - a.rerankerScore)
    .slice(0, finalTopN);
}

/**
 * Main re-rank function — picks the best available strategy.
 */
export async function rerank(
  query: string,
  results: SearchResult[],
  topN?: number
): Promise<RerankedResult[]> {
  if (!rerankerConfig.enabled || results.length <= 1) {
    // No re-ranking needed
    return results.map((r) => ({
      ...r,
      originalScore: r.score,
      rerankerScore: r.score,
      relevanceLabel: scoreToLabel(r.score),
    }));
  }

  // Fetch more results than topN so the re-ranker has a wider pool
  return cohereRerank(query, results, topN);
}

function scoreToLabel(score: number): RerankedResult["relevanceLabel"] {
  if (score >= 0.8) return "highly_relevant";
  if (score >= 0.6) return "relevant";
  if (score >= 0.4) return "partially_relevant";
  return "not_relevant";
}
