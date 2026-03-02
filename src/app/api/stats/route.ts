/**
 * API Route: /api/stats
 *
 * Returns live stats from the Pinecone index:
 * - Total vector count
 * - Index dimension
 * - Namespace info
 * - Index fullness
 */

import { NextResponse } from "next/server";
import { getPineconeClient } from "@/lib/pinecone";

export async function GET() {
  try {
    const client = getPineconeClient();
    const indexName = process.env.PINECONE_INDEX || "cobol-academy";
    const index = client.index(indexName);

    // Get index stats
    const stats = await index.describeIndexStats();

    // Get index description for dimension/metric info
    const indexList = await client.listIndexes();
    const indexInfo = indexList?.indexes?.find((idx) => idx.name === indexName);

    return NextResponse.json({
      index: {
        name: indexName,
        dimension: indexInfo?.dimension || 1536,
        metric: indexInfo?.metric || "cosine",
        host: indexInfo?.host || "",
        status: indexInfo?.status?.ready ? "ready" : "initializing",
      },
      vectors: {
        total: stats.totalRecordCount || 0,
        namespaces: stats.namespaces || {},
        indexFullness: (stats as any).indexFullness || 0,
      },
      config: {
        embeddingModel: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
        llmModel: process.env.LLM_MODEL || "gpt-4o-mini",
        topK: 5,
        chunkingStrategy: "COBOL paragraph-level + fixed fallback",
      },
    });
  } catch (error: unknown) {
    console.error("Stats error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
