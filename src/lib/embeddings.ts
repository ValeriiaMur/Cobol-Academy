/**
 * OpenAI Embeddings Client
 *
 * Uses text-embedding-3-small (1536 dimensions) for both
 * ingestion and query embedding. Critical: same model for both!
 */

import OpenAI from "openai";
import { getOpenAIKey, models, embedding as embeddingConfig } from "./config";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: getOpenAIKey() });
  }
  return openaiClient;
}

/**
 * Generate embeddings for a batch of texts.
 * Uses OpenAI batch API for efficiency.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const openai = getOpenAI();

  const batchSize = embeddingConfig.batchSize;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const response = await openai.embeddings.create({
      model: models.embedding,
      input: batch,
    });

    const embeddings = response.data
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);

    allEmbeddings.push(...embeddings);
    console.log(
      `Embedded batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)} (${allEmbeddings.length}/${texts.length})`
    );
  }

  return allEmbeddings;
}

/**
 * Generate a single embedding for a query string.
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const openai = getOpenAI();
  const response = await openai.embeddings.create({
    model: models.embedding,
    input: query,
  });
  return response.data[0].embedding;
}
