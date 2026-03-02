/**
 * API Route: /api/search
 *
 * Semantic search across the COBOL codebase.
 * Returns top-k relevant code chunks with metadata.
 */

import { NextRequest, NextResponse } from "next/server";
import { searchCodebase } from "@/lib/rag-pipeline";
import { logQuery, logError } from "@/lib/query-logger";

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { query, topK = 5 } = await request.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query string is required" },
        { status: 400 }
      );
    }

    const results = await searchCodebase(query, topK);
    const latencyMs = Date.now() - startTime;

    // Structured logging with full metrics
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
    });
  } catch (error: unknown) {
    const latencyMs = Date.now() - startTime;
    logError("search", "unknown", error, latencyMs);
    const message = error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
