/**
 * API Route: /api/search
 *
 * Semantic search across the COBOL codebase.
 * Returns top-k relevant code chunks with metadata.
 */

import { NextRequest, NextResponse } from "next/server";
import { searchCodebase } from "@/lib/rag-pipeline";

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

    // Structured logging
    console.log(
      JSON.stringify({
        type: "search",
        query,
        topK,
        resultsCount: results.length,
        latencyMs,
        topScore: results[0]?.score || 0,
      })
    );

    return NextResponse.json({
      results,
      query,
      latencyMs,
    });
  } catch (error: unknown) {
    console.error("Search error:", error);
    const message = error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
