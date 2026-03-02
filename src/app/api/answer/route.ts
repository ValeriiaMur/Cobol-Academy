/**
 * API Route: /api/answer
 *
 * Full RAG pipeline: search + LLM answer generation with streaming.
 * Uses Server-Sent Events (SSE) for real-time streaming.
 */

import { NextRequest } from "next/server";
import { searchCodebase, generateStreamingAnswer } from "@/lib/rag-pipeline";

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { query, topK = 5 } = await request.json();

    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "Query string is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Step 1: Retrieve relevant chunks
    const results = await searchCodebase(query, topK);

    if (results.length === 0) {
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
    const stream = await generateStreamingAnswer(query, results);

    const latencyMs = Date.now() - startTime;
    console.log(
      JSON.stringify({
        type: "answer",
        query,
        sourcesCount: results.length,
        searchLatencyMs: latencyMs,
      })
    );

    // Return SSE stream with sources in header
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Sources": Buffer.from(JSON.stringify(results)).toString("base64"),
        "X-Latency-Ms": String(latencyMs),
      },
    });
  } catch (error: unknown) {
    console.error("Answer error:", error);
    const message = error instanceof Error ? error.message : "Answer generation failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export const runtime = "nodejs";
export const maxDuration = 30;
