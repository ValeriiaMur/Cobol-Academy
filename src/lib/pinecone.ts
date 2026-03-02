/**
 * Pinecone Vector Database Client
 *
 * Handles connection, upserting embeddings, and querying
 * the COBOL codebase index.
 */

import { Pinecone } from "@pinecone-database/pinecone";

let pineconeClient: Pinecone | null = null;

export function getPineconeClient(): Pinecone {
  if (!pineconeClient) {
    if (!process.env.PINECONE_API_KEY) {
      throw new Error("PINECONE_API_KEY environment variable is required");
    }
    pineconeClient = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
  }
  return pineconeClient;
}

export function getIndex() {
  const client = getPineconeClient();
  const indexName = process.env.PINECONE_INDEX || "cobol-academy";
  return client.index(indexName);
}

export interface VectorMetadata {
  filePath: string;
  lineStart: number;
  lineEnd: number;
  division: string;
  section: string;
  paragraphName: string;
  chunkType: string;
  dependencies: string;
  content: string;
}

export async function upsertVectors(
  vectors: {
    id: string;
    values: number[];
    metadata: VectorMetadata;
  }[]
) {
  const index = getIndex();
  // Pinecone v7 expects { records: [...] } instead of a plain array
  const batchSize = 100;
  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize);
    if (batch.length === 0) continue;
    await index.upsert({ records: batch } as any);
    console.log(`Upserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(vectors.length / batchSize)}`);
  }
}

export async function queryVectors(
  queryEmbedding: number[],
  topK: number = 5,
  filter?: Record<string, unknown>
) {
  const index = getIndex();
  const results = await index.query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
    filter,
  });
  return results.matches || [];
}
