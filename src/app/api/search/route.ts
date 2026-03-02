/**
 * API Route: /api/search
 *
 * Semantic search across the COBOL codebase.
 * Supports standard search and RAG Fusion mode.
 *
 * Body params:
 *   query: string (required)
 *   topK: number (default 5)
 *   fusion: boolean (default false) — enables RAG Fusion multi-query search
 */

import { NextRequest, NextResponse } from "next/server";
import { searchCodebase } from "@/lib/rag-pipeline";
import { fusionSearch } from "@/lib/rag-fusion";
import { logQuery, logError } from "@/lib/query-logger";

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { query, topK = 5, fusion = false } = await request.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query string is required" },
        { status: 400 }
      );
    }

    let results;
    let queryVariants: string[] | undefined;
    let perQueryResults: number[] | undefined;

    if (fusion) {
      // RAG Fusion: multi-query + RRF
      const fusionResult = await fusionSearch(query, topK);
      results = fusionResult.results;
      queryVariants = fusionResult.queryVariants;
      perQueryResults = fusionResult.perQueryResults;
    } else {
      // Standard single-query search
      results = await searchCodebase(query, topK);
    }

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
    const message = error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
