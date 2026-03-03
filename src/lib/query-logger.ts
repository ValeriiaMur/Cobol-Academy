/**
 * Query Logger — Structured JSON logging for RAG pipeline metrics
 *
 * Captures detailed telemetry for every search and answer request:
 * - Query text and parameters
 * - Retrieval metrics (result count, top score, unique files, divisions)
 * - Latency breakdown (embedding, search, LLM, total)
 * - Answer quality signals (sources referenced, token estimates)
 *
 * Uses a bounded circular buffer to prevent unbounded memory growth.
 * In production, these would pipe to a log aggregation service (Datadog, etc.)
 */

import { logging } from "./config";

export interface QueryLogEntry {
  timestamp: string;
  requestId: string;
  type: "search" | "answer";
  query: string;
  topK: number;

  // Retrieval metrics
  resultsCount: number;
  topScore: number;
  avgScore: number;
  uniqueFiles: number;
  divisionsHit: string[];
  chunkTypes: string[];

  // Latency breakdown (ms)
  embeddingLatencyMs?: number;
  searchLatencyMs?: number;
  llmLatencyMs?: number;
  totalLatencyMs: number;

  // Quality signals
  hasAnswer?: boolean;
  estimatedTokens?: number;

  // Error tracking
  error?: string;
  success: boolean;
}

/**
 * Circular buffer for bounded session logging.
 * Prevents memory leaks by overwriting oldest entries when full.
 */
class CircularLogBuffer {
  private buffer: (QueryLogEntry | null)[];
  private head = 0;   // Next write position
  private count = 0;  // Current number of entries

  constructor(private readonly capacity: number) {
    this.buffer = new Array(capacity).fill(null);
  }

  push(entry: QueryLogEntry): void {
    this.buffer[this.head] = entry;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
  }

  /**
   * Returns entries in insertion order (oldest first).
   */
  toArray(): QueryLogEntry[] {
    if (this.count === 0) return [];

    const result: QueryLogEntry[] = [];
    const start = this.count < this.capacity ? 0 : this.head;

    for (let i = 0; i < this.count; i++) {
      const idx = (start + i) % this.capacity;
      const entry = this.buffer[idx];
      if (entry) result.push(entry);
    }

    return result;
  }

  get size(): number {
    return this.count;
  }

  clear(): void {
    this.buffer = new Array(this.capacity).fill(null);
    this.head = 0;
    this.count = 0;
  }
}

// Bounded session log — replaces the old unbounded array
const sessionLog = new CircularLogBuffer(logging.maxSessionLogSize);

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Log a query event with full metrics
 */
export function logQuery(
  entry: Partial<QueryLogEntry> & { query: string; type: "search" | "answer" }
): QueryLogEntry {
  const fullEntry: QueryLogEntry = {
    timestamp: new Date().toISOString(),
    requestId: generateRequestId(),
    topK: 5,
    resultsCount: 0,
    topScore: 0,
    avgScore: 0,
    uniqueFiles: 0,
    divisionsHit: [],
    chunkTypes: [],
    totalLatencyMs: 0,
    success: true,
    ...entry,
  };

  // Structured JSON log to console
  console.log(
    JSON.stringify({
      level: "info",
      service: logging.serviceName,
      ...fullEntry,
    })
  );

  // Store in bounded session log
  sessionLog.push(fullEntry);

  return fullEntry;
}

/**
 * Log an error event
 */
export function logError(
  type: "search" | "answer",
  query: string,
  error: unknown,
  latencyMs: number
): void {
  const message = error instanceof Error ? error.message : String(error);

  console.log(
    JSON.stringify({
      level: "error",
      service: logging.serviceName,
      timestamp: new Date().toISOString(),
      requestId: generateRequestId(),
      type,
      query,
      error: message,
      totalLatencyMs: latencyMs,
      success: false,
    })
  );
}

/**
 * Get the session query log (for analytics endpoint).
 * Returns a copy to prevent external mutation.
 */
export function getSessionLog(): QueryLogEntry[] {
  return sessionLog.toArray();
}

/**
 * Clear the session log (useful for testing or manual reset).
 */
export function clearSessionLog(): void {
  sessionLog.clear();
}

/**
 * Get aggregate session metrics
 */
export function getSessionMetrics() {
  const entries = sessionLog.toArray();

  if (entries.length === 0) {
    return {
      totalQueries: 0,
      successfulQueries: 0,
      errorCount: 0,
      errorRate: 0,
      avgLatencyMs: 0,
      avgTopScore: 0,
      avgResultsCount: 0,
      p50LatencyMs: 0,
      p95LatencyMs: 0,
      queriesPerMinute: 0,
    };
  }

  const sorted = [...entries].sort((a, b) => a.totalLatencyMs - b.totalLatencyMs);
  const successfulQueries = entries.filter((q) => q.success);
  const errors = entries.filter((q) => !q.success);

  // Calculate time span for QPM
  const firstTs = new Date(entries[0].timestamp).getTime();
  const lastTs = new Date(entries[entries.length - 1].timestamp).getTime();
  const spanMinutes = Math.max((lastTs - firstTs) / 60000, 1);

  // Guard against division by zero when all queries are errors
  const successCount = successfulQueries.length || 1;

  return {
    totalQueries: entries.length,
    successfulQueries: successfulQueries.length,
    errorCount: errors.length,
    errorRate: errors.length / entries.length,
    avgLatencyMs: Math.round(
      successfulQueries.reduce((s, q) => s + q.totalLatencyMs, 0) / successCount
    ),
    avgTopScore: +(
      successfulQueries.reduce((s, q) => s + q.topScore, 0) / successCount
    ).toFixed(3),
    avgResultsCount: +(
      successfulQueries.reduce((s, q) => s + q.resultsCount, 0) / successCount
    ).toFixed(1),
    p50LatencyMs: sorted[Math.floor(sorted.length * 0.5)]?.totalLatencyMs || 0,
    p95LatencyMs: sorted[Math.floor(sorted.length * 0.95)]?.totalLatencyMs || 0,
    queriesPerMinute: +(entries.length / spanMinutes).toFixed(1),
  };
}
