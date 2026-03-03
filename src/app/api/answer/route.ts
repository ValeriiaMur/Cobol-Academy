/**
 * API Route: /api/answer
 *
 * Full RAG pipeline: search + LLM answer generation with streaming.
 * Uses Server-Sent Events (SSE) for real-time streaming.
 */

import { NextRequest } from "next/server";
import { searchCodebase, generateStreamingAnswer } from "@/lib/rag-pipeline";
import { fusionSearch } from "@/lib/rag-fusion";
import { rerank } from "@/lib/reranker";
import { logQuery, logError } from "@/lib/query-logger";
import { validateSearchInput } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse body safely
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate and sanitize input
    const input = validateSearchInput(body);
    if (!input.valid) {
      return new Response(
        JSON.stringify({ error: input.errors[0].message, errors: input.errors }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { query, topK, fusion, rerank: useRerank } = input.data;

    // Step 1: Retrieve relevant chunks (standard or fusion)
    const searchStart = Date.now();
    let results;
    if (fusion) {
      const fusionResult = await fusionSearch(query, topK);
      results = fusionResult.results;
    } else {
      results = await searchCodebase(query, topK);
    }

    // Re-rank only when explicitly requested (adds ~1-2s latency)
    if (useRerank) {
      const reranked = await rerank(query, results, topK);
      results = reranked;
    }

    const searchLatencyMs = Date.now() - searchStart;

    if (results.length === 0) {
      logQuery({
        type: "answer",
        query,
        topK,
        resultsCount: 0,
        topScore: 0,
        searchLatencyMs,
        totalLatencyMs: Date.now() - startTime,
        hasAnswer: false,
      });

      return new Response(
        JSON.stringify({
          error: "No relevant code found. Try rephrasing your question.",
          suggestions: [
            "Where is the main entry point?",
            "Show me file I/O operations",
            "Explain the PROCEDURE DIVISION",
          ],
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Step 2: Generate streaming answer
    const llmStart = Date.now();
    const stream = await generateStreamingAnswer(query, results);

    const uniqueFiles = [...new Set(results.map((r) => r.filePath))];
    const divisions = [...new Set(results.map((r) => r.division).filter(Boolean))];
    const chunkTypes = [...new Set(results.map((r) => r.chunkType).filter(Boolean))];
    const avgScore = results.reduce((s, r) => s + r.score, 0) / results.length;

    logQuery({
      type: "answer",
      query,
      topK,
      resultsCount: results.length,
      topScore: results[0]?.score || 0,
      avgScore: +avgScore.toFixed(4),
      uniqueFiles: uniqueFiles.length,
      divisionsHit: divisions,
      chunkTypes,
      searchLatencyMs,
      llmLatencyMs: Date.now() - llmStart,
      totalLatencyMs: Date.now() - startTime,
      hasAnswer: true,
    });

    // Return SSE stream with sources in header
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Sources": Buffer.from(JSON.stringify(results)).toString("base64"),
        "X-Latency-Ms": String(Date.now() - startTime),
      },
    });
  } catch (error: unknown) {
    const latencyMs = Date.now() - startTime;
    logError("answer", "unknown", error, latencyMs);
    console.error("Answer API error:", error);
    return new Response(
      JSON.stringify({ error: "An internal error occurred. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export const runtime = "nodejs";
export const maxDuration = 30;
