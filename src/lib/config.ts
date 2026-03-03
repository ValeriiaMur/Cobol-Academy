/**
 * Centralized Configuration
 *
 * All environment variables and hardcoded constants in one place.
 * Validates required env vars at startup and provides typed defaults.
 */

// --- Environment variable helpers ---

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

// --- API Keys (lazy — only validated when accessed) ---

let _openaiKey: string | null = null;
let _pineconeKey: string | null = null;

export function getOpenAIKey(): string {
  if (!_openaiKey) {
    _openaiKey = requireEnv("OPENAI_API_KEY");
  }
  return _openaiKey;
}

export function getPineconeKey(): string {
  if (!_pineconeKey) {
    _pineconeKey = requireEnv("PINECONE_API_KEY");
  }
  return _pineconeKey;
}

// --- Model Configuration ---

export const models = {
  embedding: optionalEnv("EMBEDDING_MODEL", "text-embedding-3-small"),
  llm: optionalEnv("LLM_MODEL", "gpt-4o-mini"),
  embeddingDimensions: 1536,
} as const;

// --- Pinecone Configuration ---

export const pinecone = {
  indexName: optionalEnv("PINECONE_INDEX", "cobol-academy"),
  metric: "cosine" as const,
  upsertBatchSize: 100,
} as const;

// --- RAG Pipeline Configuration ---

export const rag = {
  defaultTopK: 5,
  maxTopK: 20,
  minTopK: 1,
  llmTemperature: 0.3,
  llmMaxTokens: 2000,
  streamingEnabled: true,
} as const;

// --- RAG Fusion Configuration ---

export const fusion = {
  variantCount: 3,
  rrfK: 60,
  temperature: 0.7,
  maxTokens: 300,
  minPerQueryTopK: 10,
} as const;

// --- Input Validation Limits ---

export const validation = {
  maxQueryLength: 1000,
  minQueryLength: 2,
  maxTopK: 20,
  minTopK: 1,
  defaultTopK: 5,
} as const;

// --- Embedding Configuration ---

export const embedding = {
  batchSize: 100,
  maxBatchInputs: 2048, // OpenAI limit
} as const;

// --- Chunking Configuration ---

export const chunking = {
  fixedChunkSize: 40,
  fixedChunkOverlap: 5,
  maxCommentLength: 500,
  strategy: "COBOL paragraph-level + fixed fallback",
} as const;

// --- Re-Ranker Configuration ---

export const reranker = {
  enabled: optionalEnv("RERANKER_ENABLED", "true") === "true",
  cohereModel: optionalEnv("COHERE_RERANK_MODEL", "rerank-v3.5"),
  topN: 5,
  maxChunkChars: 800, // Limit chunk text sent to LLM reranker
} as const;

// --- Evaluation Configuration ---

export const evaluation = {
  relevanceThreshold: 0.7,
  precisionTarget: 0.7,
  latencyTargetMs: 3000,
  topK: 5,
} as const;

// --- Logging Configuration ---

export const logging = {
  maxSessionLogSize: 100,
  serviceName: "cobol-academy",
} as const;
