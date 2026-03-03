/**
 * API Route: /api/search
 *
 * Semantic search across the COBOL codebase.
 * Supports standard search and RAG Fusion mode.
 */

import { NextRequest, NextResponse } from "next/server";
import { searchCodebase } from "@/lib/rag-pipeline";
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
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    // Validate and sanitize input
    const input = validateSearchInput(body);
    if (!input.valid) {
      return NextResponse.json(
        { error: input.errors[0].message, errors: input.errors },
        { status: 400 }
      );
    }

    const { query, topK, fusion } = input.data;

    let results;
    let queryVariants: string[] | undefined;
    let perQueryResults: number[] | undefined;

    if (fusion) {
      const fusionResult = await fusionSearch(query, topK);
      results = fusionResult.results;
      queryVariants = fusionResult.queryVariants;
      perQueryResults = fusionResult.perQueryResults;
    } else {
      results = await searchCodebase(query, topK);
    }

    // Re-rank results for improved precision
    const reranked = await rerank(query, results, topK);
    results = reranked;

    const latencyMs = Date.now() - startTime;

    // Structured logging
    const uniqueFiles = [...new Set(results.map((r) => r.filePath))];
    const divisions = [...new Set(results.map((r) => r.division).filter(Boolean))];
    const chunkTypes = [...new Set(results.map((r) => r.chunkType).filter(Boolean))];
    const avgScore = results.length
      ? results.reduce((s, r) => s + r.score, 0) / results.length
      : 0;

    logQuery({
      type: "search",
      query,
      topK,
      resultsCount: results.length,
      topScore: results[0]?.score || 0,
      avgScore: +avgScore.toFixed(4),
      uniqueFiles: uniqueFiles.length,
      divisionsHit: divisions,
      chunkTypes,
      totalLatencyMs: latencyMs,
    });

    return NextResponse.json({
      results,
      query,
      latencyMs,
      fusion: fusion
        ? { enabled: true, queryVariants, perQueryResults }
        : { enabled: false },
    });
  } catch (error: unknown) {
    const latencyMs = Date.now() - startTime;
    logError("search", "unknown", error, latencyMs);
    console.error("Search API error:", error);
    return NextResponse.json(
      { error: "An internal error occurred. Please try again." },
      { status: 500 }
    );
  }
}
