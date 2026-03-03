/**
 * RAG Evaluation Framework
 *
 * RAGAS-inspired metrics for measuring retrieval and generation quality:
 *
 * 1. Context Precision — Are the retrieved chunks relevant to the query?
 * 2. Context Recall — Does the retrieved context cover the expected answer?
 * 3. Faithfulness — Is the generated answer grounded in the retrieved context?
 * 4. Answer Relevancy — Does the answer actually address the query?
 * 5. Latency — Is the end-to-end response within target?
 *
 * Each metric is scored 0.0–1.0, and we compute an aggregate RAGAS score.
 */

import OpenAI from "openai";
import { SearchResult } from "./rag-pipeline";
import { getOpenAIKey, models, evaluation as evalConfig } from "./config";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: getOpenAIKey() });
  }
  return openaiClient;
}

// --- Types ---

export interface EvalTestCase {
  id: string;
  query: string;
  expectedKeywords: string[];       // Keywords that should appear in retrieved context
  expectedFiles?: string[];          // File paths/patterns expected in results
  expectedDivisions?: string[];      // COBOL divisions expected
  groundTruthAnswer?: string;        // Optional reference answer for faithfulness checking
  category: "entry_point" | "data_access" | "explanation" | "file_io" | "dependency" | "pattern";
}

export interface MetricScore {
  name: string;
  score: number;       // 0.0 - 1.0
  details: string;     // Human-readable explanation
}

export interface EvalResult {
  testCase: EvalTestCase;
  metrics: {
    contextPrecision: MetricScore;
    contextRecall: MetricScore;
    faithfulness: MetricScore;
    answerRelevancy: MetricScore;
    latency: MetricScore;
  };
  audit?: AuditResult;       // LLM auditor findings (unknown unknowns)
  aggregateScore: number;    // Weighted average of all metrics
  retrievedChunks: number;
  topScore: number;
  latencyMs: number;
  answer: string;
  pass: boolean;             // Aggregate score >= threshold
}

export interface EvalSummary {
  totalTests: number;
  passed: number;
  failed: number;
  averageScores: {
    contextPrecision: number;
    contextRecall: number;
    faithfulness: number;
    answerRelevancy: number;
    latency: number;
    aggregate: number;
  };
  passRate: number;
  averageLatencyMs: number;
  results: EvalResult[];
  timestamp: string;
}

// --- Metric Functions ---

/**
 * Context Precision: What fraction of retrieved chunks are relevant to the query?
 * Uses keyword matching + LLM scoring for nuance.
 */
export async function measureContextPrecision(
  query: string,
  results: SearchResult[],
  expectedKeywords: string[]
): Promise<MetricScore> {
  if (results.length === 0) {
    return { name: "Context Precision", score: 0, details: "No results retrieved" };
  }

  // Keyword-based precision: how many results contain at least one expected keyword?
  const keywordLower = expectedKeywords.map((k) => k.toLowerCase());
  let relevantCount = 0;

  for (const result of results) {
    const text = `${result.content} ${result.filePath} ${result.division} ${result.section} ${result.paragraphName}`.toLowerCase();
    const hasKeyword = keywordLower.some((kw) => text.includes(kw));
    if (hasKeyword) relevantCount++;
  }

  const keywordPrecision = relevantCount / results.length;

  // LLM-based precision for more nuanced scoring
  const openai = getOpenAI();
  const docsText = results
    .map((r, i) => `[${i}] ${r.filePath}:${r.lineStart}-${r.lineEnd} | ${r.content.slice(0, 200)}`)
    .join("\n");

  const response = await openai.chat.completions.create({
    model: models.llm,
    messages: [
      {
        role: "system",
        content: `You are evaluating search result relevance. Given a query and retrieved documents, score what fraction of documents are relevant. Return ONLY a JSON object: {"score": 0.0-1.0, "relevant_indices": [0,1,...]}`,
      },
      {
        role: "user",
        content: `Query: "${query}"\n\nDocuments:\n${docsText}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 200,
    response_format: { type: "json_object" },
  });

  let llmPrecision = keywordPrecision;
  try {
    const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
    llmPrecision = parsed.score ?? keywordPrecision;
  } catch {
    // fallback to keyword precision
  }

  // Blend both signals
  const score = 0.4 * keywordPrecision + 0.6 * llmPrecision;

  return {
    name: "Context Precision",
    score: Math.min(1, Math.max(0, score)),
    details: `${relevantCount}/${results.length} chunks matched keywords (${(keywordPrecision * 100).toFixed(0)}%), LLM scored ${(llmPrecision * 100).toFixed(0)}%`,
  };
}

/**
 * Context Recall: Does the retrieved context cover the expected topics?
 * Measures how many expected keywords appear in the retrieved context.
 */
export async function measureContextRecall(
  results: SearchResult[],
  expectedKeywords: string[],
  expectedFiles?: string[]
): Promise<MetricScore> {
  if (expectedKeywords.length === 0) {
    return { name: "Context Recall", score: 1, details: "No expected keywords to check" };
  }

  const allText = results
    .map((r) => `${r.content} ${r.filePath} ${r.division} ${r.section} ${r.paragraphName} ${r.dependencies.join(" ")}`)
    .join(" ")
    .toLowerCase();

  // Keyword recall
  let foundKeywords = 0;
  const missingKeywords: string[] = [];
  for (const kw of expectedKeywords) {
    if (allText.includes(kw.toLowerCase())) {
      foundKeywords++;
    } else {
      missingKeywords.push(kw);
    }
  }
  const keywordRecall = foundKeywords / expectedKeywords.length;

  // File recall (bonus)
  let fileRecall = 1;
  const missingFiles: string[] = [];
  if (expectedFiles && expectedFiles.length > 0) {
    let foundFiles = 0;
    for (const expectedFile of expectedFiles) {
      const found = results.some((r) =>
        r.filePath.toLowerCase().includes(expectedFile.toLowerCase())
      );
      if (found) foundFiles++;
      else missingFiles.push(expectedFile);
    }
    fileRecall = foundFiles / expectedFiles.length;
  }

  const score = expectedFiles ? 0.6 * keywordRecall + 0.4 * fileRecall : keywordRecall;

  const details = [
    `Keywords: ${foundKeywords}/${expectedKeywords.length} found`,
    missingKeywords.length > 0 ? `Missing: ${missingKeywords.join(", ")}` : null,
    expectedFiles ? `Files: ${expectedFiles.length - missingFiles.length}/${expectedFiles.length} found` : null,
  ]
    .filter(Boolean)
    .join(". ");

  return {
    name: "Context Recall",
    score: Math.min(1, Math.max(0, score)),
    details,
  };
}

/**
 * Faithfulness: Is the answer grounded in the retrieved context (no hallucination)?
 * Uses LLM to check if claims in the answer are supported by the context.
 */
export async function measureFaithfulness(
  answer: string,
  results: SearchResult[]
): Promise<MetricScore> {
  if (!answer || answer.length < 10) {
    return { name: "Faithfulness", score: 0, details: "No meaningful answer generated" };
  }

  const openai = getOpenAI();
  const context = results.map((r) => r.content).join("\n\n");

  const response = await openai.chat.completions.create({
    model: models.llm,
    messages: [
      {
        role: "system",
        content: `You are evaluating whether an AI-generated answer is faithful to the provided source context. Check if every factual claim in the answer is supported by the context.

Return ONLY a JSON object:
{
  "score": 0.0-1.0,
  "supported_claims": number,
  "total_claims": number,
  "unsupported_claims": ["list of claims not in context"]
}

Scoring:
- 1.0: All claims fully supported by context
- 0.7-0.9: Most claims supported, minor extrapolation
- 0.4-0.6: Mix of supported and unsupported claims
- 0.0-0.3: Many hallucinated or unsupported claims`,
      },
      {
        role: "user",
        content: `Context:\n${context.slice(0, 3000)}\n\nAnswer:\n${answer.slice(0, 2000)}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 400,
    response_format: { type: "json_object" },
  });

  try {
    const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
    const score = parsed.score ?? 0.5;
    const unsupported = parsed.unsupported_claims || [];
    return {
      name: "Faithfulness",
      score: Math.min(1, Math.max(0, score)),
      details: `${parsed.supported_claims ?? "?"}/${parsed.total_claims ?? "?"} claims supported${unsupported.length > 0 ? `. Unsupported: ${unsupported.slice(0, 2).join("; ")}` : ""}`,
    };
  } catch {
    return { name: "Faithfulness", score: 0.5, details: "Could not parse faithfulness evaluation" };
  }
}

/**
 * Answer Relevancy: Does the answer actually address the query?
 */
export async function measureAnswerRelevancy(
  query: string,
  answer: string
): Promise<MetricScore> {
  if (!answer || answer.length < 10) {
    return { name: "Answer Relevancy", score: 0, details: "No meaningful answer generated" };
  }

  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model: models.llm,
    messages: [
      {
        role: "system",
        content: `You are evaluating whether an AI answer is relevant to the user's question. Score how directly and completely the answer addresses the query.

Return ONLY a JSON object:
{
  "score": 0.0-1.0,
  "reasoning": "brief explanation"
}

Scoring:
- 0.9-1.0: Directly and completely answers the question
- 0.7-0.89: Mostly answers the question with minor gaps
- 0.4-0.69: Partially relevant but misses key aspects
- 0.0-0.39: Does not address the question`,
      },
      {
        role: "user",
        content: `Question: "${query}"\n\nAnswer:\n${answer.slice(0, 2000)}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 200,
    response_format: { type: "json_object" },
  });

  try {
    const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
    return {
      name: "Answer Relevancy",
      score: Math.min(1, Math.max(0, parsed.score ?? 0.5)),
      details: parsed.reasoning || "Evaluated by LLM",
    };
  } catch {
    return { name: "Answer Relevancy", score: 0.5, details: "Could not parse relevancy evaluation" };
  }
}

// --- LLM Auditor / Judge (adversarial "unknown unknowns" checker) ---

export interface AuditFinding {
  severity: "critical" | "warning" | "info";
  category: string;
  description: string;
}

export interface AuditResult {
  overallQuality: number; // 0.0-1.0
  findings: AuditFinding[];
  summary: string;
}

/**
 * LLM Auditor: An adversarial judge that critically reviews the full RAG output.
 *
 * Unlike the other metrics which check specific properties (precision, recall, etc.),
 * the auditor is prompted to be a skeptical critic looking for problems you didn't
 * think to test for — the "unknown unknowns."
 *
 * It checks for:
 * - Hallucinated file paths, line numbers, or function names
 * - Contradictions between the answer and retrieved context
 * - Misleading or overly confident claims
 * - Missing caveats or important context
 * - COBOL-specific inaccuracies (wrong syntax explanations, bad analogies)
 * - Security issues (prompt leakage, system prompt exposure)
 * - Answer completeness gaps
 */
export async function auditRAGOutput(
  query: string,
  answer: string,
  results: SearchResult[]
): Promise<AuditResult> {
  if (!answer || answer.length < 10) {
    return {
      overallQuality: 0,
      findings: [{ severity: "critical", category: "empty_answer", description: "No answer generated" }],
      summary: "No answer to audit",
    };
  }

  const openai = getOpenAI();

  const contextSnippets = results
    .map(
      (r, i) =>
        `[Source ${i}] ${r.filePath}:${r.lineStart}-${r.lineEnd} (${r.division}${r.section ? " > " + r.section : ""}${r.paragraphName ? " > " + r.paragraphName : ""})\n${r.content.slice(0, 400)}`
    )
    .join("\n\n");

  const response = await openai.chat.completions.create({
    model: models.llm,
    messages: [
      {
        role: "system",
        content: `You are a CRITICAL quality auditor for a RAG (Retrieval-Augmented Generation) system that explains COBOL code. Your job is to find problems, NOT to praise the output.

Be adversarial and skeptical. Assume the answer might be wrong until proven correct by the source context.

Check for these categories of issues:

1. **HALLUCINATION**: Does the answer reference files, line numbers, function names, or code that don't appear in the retrieved context? This is the most critical issue.

2. **ACCURACY**: Are COBOL concepts explained correctly? Are modern-language analogies accurate? Are technical claims verifiable from the context?

3. **COMPLETENESS**: Does the answer miss important information that IS in the retrieved context? Does it answer the actual question asked?

4. **MISLEADING**: Is the answer overly confident about uncertain claims? Does it present retrieved snippets as if they represent the entire codebase?

5. **COHERENCE**: Does the answer contradict itself? Is the logic sound?

6. **SAFETY**: Does the answer leak system prompt details, internal architecture, or make unsafe recommendations?

Return ONLY a JSON object:
{
  "overall_quality": 0.0-1.0,
  "findings": [
    {"severity": "critical|warning|info", "category": "hallucination|accuracy|completeness|misleading|coherence|safety", "description": "specific issue found"}
  ],
  "summary": "1-2 sentence overall assessment"
}

IMPORTANT: You MUST find at least one issue. No output is perfect. If everything looks correct, find minor issues (info-level). Be specific — cite exact phrases from the answer that are problematic.`,
      },
      {
        role: "user",
        content: `USER QUERY: "${query}"

RETRIEVED CONTEXT (the ONLY valid source of truth):
${contextSnippets}

GENERATED ANSWER TO AUDIT:
${answer.slice(0, 2500)}

Find all issues with this answer. Be critical.`,
      },
    ],
    temperature: 0.3, // slightly higher for creative problem-finding
    max_tokens: 800,
    response_format: { type: "json_object" },
  });

  try {
    const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
    const findings: AuditFinding[] = (parsed.findings || []).map(
      (f: { severity?: string; category?: string; description?: string }) => ({
        severity: (["critical", "warning", "info"].includes(f.severity || "") ? f.severity : "info") as AuditFinding["severity"],
        category: f.category || "unknown",
        description: f.description || "No description",
      })
    );

    return {
      overallQuality: Math.min(1, Math.max(0, parsed.overall_quality ?? 0.5)),
      findings,
      summary: parsed.summary || "Audit completed",
    };
  } catch {
    return {
      overallQuality: 0.5,
      findings: [{ severity: "info", category: "audit_error", description: "Could not parse audit results" }],
      summary: "Audit parsing failed",
    };
  }
}

/**
 * Latency Score: Is the response within the target latency?
 */
export function measureLatency(latencyMs: number): MetricScore {
  const target = evalConfig.latencyTargetMs;
  let score: number;

  if (latencyMs <= target * 0.5) {
    score = 1.0;
  } else if (latencyMs <= target) {
    score = 1.0 - 0.5 * ((latencyMs - target * 0.5) / (target * 0.5));
  } else if (latencyMs <= target * 2) {
    score = 0.5 - 0.5 * ((latencyMs - target) / target);
  } else {
    score = 0;
  }

  return {
    name: "Latency",
    score: Math.min(1, Math.max(0, score)),
    details: `${latencyMs}ms (target: <${target}ms)`,
  };
}

/**
 * Compute aggregate RAGAS-style score from individual metrics.
 * Weights: Precision 25%, Recall 25%, Faithfulness 25%, Relevancy 15%, Latency 10%
 */
export function computeAggregateScore(metrics: EvalResult["metrics"]): number {
  const weights = {
    contextPrecision: 0.25,
    contextRecall: 0.25,
    faithfulness: 0.25,
    answerRelevancy: 0.15,
    latency: 0.10,
  };

  return (
    metrics.contextPrecision.score * weights.contextPrecision +
    metrics.contextRecall.score * weights.contextRecall +
    metrics.faithfulness.score * weights.faithfulness +
    metrics.answerRelevancy.score * weights.answerRelevancy +
    metrics.latency.score * weights.latency
  );
}

/**
 * Compute summary statistics from all evaluation results.
 */
export function computeEvalSummary(results: EvalResult[]): EvalSummary {
  const n = results.length || 1;
  const passed = results.filter((r) => r.pass).length;

  return {
    totalTests: results.length,
    passed,
    failed: results.length - passed,
    averageScores: {
      contextPrecision: results.reduce((s, r) => s + r.metrics.contextPrecision.score, 0) / n,
      contextRecall: results.reduce((s, r) => s + r.metrics.contextRecall.score, 0) / n,
      faithfulness: results.reduce((s, r) => s + r.metrics.faithfulness.score, 0) / n,
      answerRelevancy: results.reduce((s, r) => s + r.metrics.answerRelevancy.score, 0) / n,
      latency: results.reduce((s, r) => s + r.metrics.latency.score, 0) / n,
      aggregate: results.reduce((s, r) => s + r.aggregateScore, 0) / n,
    },
    passRate: passed / n,
    averageLatencyMs: results.reduce((s, r) => s + r.latencyMs, 0) / n,
    results,
    timestamp: new Date().toISOString(),
  };
}
