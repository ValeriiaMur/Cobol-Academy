/**
 * Query Logger — Structured JSON logging for RAG pipeline metrics
 *
 * Captures detailed telemetry for every search and answer request:
 * - Query text and parameters
 * - Retrieval metrics (result count, top score, unique files, divisions)
 * - Latency breakdown (embedding, search, LLM, total)
 * - Answer quality signals (sources referenced, token estimates)
 *
 * Logs are stored in-memory for the session and emitted to console as JSON.
 * In production, these would pipe to a log aggregation service (Datadog, etc.)
 */

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

// In-memory session log (most recent 100 queries)
const SESSION_LOG: QueryLogEntry[] = [];
const MAX_LOG_SIZE = 100;

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Log a query event with full metrics
 */
export function logQuery(entry: Partial<QueryLogEntry> & { query: string; type: "search" | "answer" }): QueryLogEntry {
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
  console.log(JSON.stringify({
    level: "info",
    service: "cobol-academy",
    ...fullEntry,
  }));

  // Store in session log
  SESSION_LOG.push(fullEntry);
  if (SESSION_LOG.length > MAX_LOG_SIZE) {
    SESSION_LOG.shift();
  }

  return fullEntry;
}

/**
 * Log an error event
 */
export function logError(type: "search" | "answer", query: string, error: unknown, latencyMs: number): void {
  const message = error instanceof Error ? error.message : String(error);

  console.log(JSON.stringify({
    level: "error",
    service: "cobol-academy",
    timestamp: new Date().toISOString(),
    requestId: generateRequestId(),
    type,
    query,
    error: message,
    totalLatencyMs: latencyMs,
    success: false,
  }));
}

/**
 * Get the session query log (for analytics endpoint)
 */
export function getSessionLog(): QueryLogEntry[] {
  return [...SESSION_LOG];
}

/**
 * Get aggregate session metrics
 */
export function getSessionMetrics() {
  if (SESSION_LOG.length === 0) {
    return {
      totalQueries: 0,
      avgLatencyMs: 0,
      avgTopScore: 0,
      avgResultsCount: 0,
      errorRate: 0,
      p50LatencyMs: 0,
      p95LatencyMs: 0,
      queriesPerMinute: 0,
    };
  }

  const sorted = [...SESSION_LOG].sort((a, b) => a.totalLatencyMs - b.totalLatencyMs);
  const successfulQueries = SESSION_LOG.filter((q) => q.success);
  const errors = SESSION_LOG.filter((q) => !q.success);

  // Calculate time span for QPM
  const firstTs = new Date(SESSION_LOG[0].timestamp).getTime();
  const lastTs = new Date(SESSION_LOG[SESSION_LOG.length - 1].timestamp).getTime();
  const spanMinutes = Math.max((lastTs - firstTs) / 60000, 1);

  return {
    totalQueries: SESSION_LOG.length,
    successfulQueries: successfulQueries.length,
    errorCount: errors.length,
    errorRate: errors.length / SESSION_LOG.length,
    avgLatencyMs: Math.round(
      successfulQueries.reduce((s, q) => s + q.totalLatencyMs, 0) / successfulQueries.length
    ),
    avgTopScore: +(
      successfulQueries.reduce((s, q) => s + q.topScore, 0) / successfulQueries.length
    ).toFixed(3),
    avgResultsCount: +(
      successfulQueries.reduce((s, q) => s + q.resultsCount, 0) / successfulQueries.length
    ).toFixed(1),
    p50LatencyMs: sorted[Math.floor(sorted.length * 0.5)]?.totalLatencyMs || 0,
    p95LatencyMs: sorted[Math.floor(sorted.length * 0.95)]?.totalLatencyMs || 0,
    queriesPerMinute: +(SESSION_LOG.length / spanMinutes).toFixed(1),
  };
}
