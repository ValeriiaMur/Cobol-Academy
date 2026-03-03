/**
 * Pinecone Vector Database Client
 *
 * Handles connection, upserting embeddings, and querying
 * the COBOL codebase index.
 */

import { Pinecone } from "@pinecone-database/pinecone";
import { getPineconeKey, pinecone as pineconeConfig } from "./config";

let pineconeClient: Pinecone | null = null;

export function getPineconeClient(): Pinecone {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: getPineconeKey(),
    });
  }
  return pineconeClient;
}

export function getIndex() {
  const client = getPineconeClient();
  return client.index(pineconeConfig.indexName);
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
