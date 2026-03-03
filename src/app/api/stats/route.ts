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
import { pinecone as pineconeConfig, models, chunking } from "@/lib/config";

export async function GET() {
  try {
    const client = getPineconeClient();
    const index = client.index(pineconeConfig.indexName);

    // Get index stats
    const stats = await index.describeIndexStats();

    // Get index description for dimension/metric info
    const indexList = await client.listIndexes();
    const indexInfo = indexList?.indexes?.find(
      (idx) => idx.name === pineconeConfig.indexName
    );

    return NextResponse.json({
      index: {
        name: pineconeConfig.indexName,
        dimension: indexInfo?.dimension || models.embeddingDimensions,
        metric: indexInfo?.metric || pineconeConfig.metric,
        host: indexInfo?.host || "",
        status: indexInfo?.status?.ready ? "ready" : "initializing",
      },
      vectors: {
        total: stats.totalRecordCount || 0,
        namespaces: stats.namespaces || {},
        indexFullness: (stats as any).indexFullness || 0,
      },
      config: {
        embeddingModel: models.embedding,
        llmModel: models.llm,
        topK: 5,
        chunkingStrategy: chunking.strategy,
      },
    });
  } catch (error: unknown) {
    console.error("Stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch index stats. Please try again." },
      { status: 500 }
    );
  }
}
