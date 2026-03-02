/**
 * COBOL Academy — Evaluation Test Suite
 *
 * Runs 6 test queries tailored to the actual GnuCOBOL codebase and scores
 * retrieval quality using automated heuristics + a simplified RAGAS approach.
 *
 * The GnuCOBOL codebase contains:
 * - CBL_OC_DUMP.cob: A hex dump display utility
 * - tutorial.cob: File handler tutorial using the Callable File Handler
 * - numeric-dump.cob / numeric-display.cob: Numeric data test programs
 * - Copybooks: screenio.cpy (screen I/O), sqlca.cpy (SQL), xfhfcd*.cpy (file handler)
 *
 * Metrics measured:
 * - Retrieval Precision: Are the top-5 results relevant?
 * - Context Recall: Did we find the right files/patterns?
 * - Answer Faithfulness: Does the answer reference retrieved context?
 * - Latency: End-to-end query time
 *
 * Usage: npx tsx scripts/evaluate.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { searchCodebase, generateAnswer, SearchResult } from "../src/lib/rag-pipeline";

// ============================================
// Test Suite — 6 queries tailored to GnuCOBOL
// ============================================

interface TestCase {
  id: number;
  query: string;
  expectedResultType: string;
  relevanceKeywords: string[]; // keywords that should appear in retrieved chunks
  evaluationCriteria: string;
}

const TEST_CASES: TestCase[] = [
  {
    id: 1,
    query: "What does the CBL_OC_DUMP program do and how is it called?",
    expectedResultType: "Program explanation with PROCEDURE DIVISION entry point",
    relevanceKeywords: ["CBL_OC_DUMP", "DUMP", "PROCEDURE", "DIVISION", "DISPLAY", "HEX", "BUFFER"],
    evaluationCriteria: "Identifies CBL_OC_DUMP as a hex dump utility with USING parameters",
  },
  {
    id: 2,
    query: "How does the tutorial program open and write to indexed files?",
    expectedResultType: "File I/O operation sequence",
    relevanceKeywords: ["TUTORIAL", "OPEN", "WRITE", "CLOSE", "OPCODE", "FCD", "FILE", "PERFORM", "CALL"],
    evaluationCriteria: "Shows the open/write/close sequence using opcodes and CALL file handler",
  },
  {
    id: 3,
    query: "Explain the SQLCA copybook structure and its fields",
    expectedResultType: "Data structure explanation",
    relevanceKeywords: ["SQLCA", "SQLCODE", "SQLERRM", "SQLSTATE", "SQLWARN", "BINARY"],
    evaluationCriteria: "Identifies SQLCA fields: SQLCODE, SQLERRM, SQLSTATE, SQLWARN",
  },
  {
    id: 4,
    query: "What screen I/O constants are defined in the screenio copybook?",
    expectedResultType: "Constant definitions with values",
    relevanceKeywords: ["SCREEN", "COB-SCR", "COB-COLOR", "MOUSE", "VALUE", "78"],
    evaluationCriteria: "Lists color constants, function key values, and mouse handling flags",
  },
  {
    id: 5,
    query: "Show me how PERFORM and CALL statements are used in the file handler tutorial",
    expectedResultType: "Control flow examples with PERFORM/CALL patterns",
    relevanceKeywords: ["PERFORM", "CALL", "TUTORIAL", "CALL-FILE-HANDLER", "SET-FCD", "READ", "WRITE"],
    evaluationCriteria: "Shows PERFORM targets (set-fcd, call-file-handler, read-all-records)",
  },
  {
    id: 6,
    query: "What COPY statements and external dependencies exist across the codebase?",
    expectedResultType: "Dependency list across files",
    relevanceKeywords: ["COPY", "XFHFCD", "SCREENIO", "SQLCA", "SQLDA", "GCWINDOW"],
    evaluationCriteria: "Identifies copybook dependencies (xfhfcd3.cpy, screenio.cpy, sqlca.cpy)",
  },
];

// ============================================
// Scoring Functions
// ============================================

/**
 * Retrieval Precision: What fraction of top-k results contain relevant keywords?
 */
function scoreRetrievalPrecision(results: SearchResult[], keywords: string[]): number {
  if (results.length === 0) return 0;
  const upperKeywords = keywords.map((k) => k.toUpperCase());

  let relevantCount = 0;
  for (const result of results) {
    const content = (result.content + " " + result.paragraphName + " " + result.division + " " + result.filePath).toUpperCase();
    const hasRelevant = upperKeywords.some((kw) => content.includes(kw));
    if (hasRelevant) relevantCount++;
  }

  return relevantCount / results.length;
}

/**
 * Context Recall: How many expected keywords appear across all results?
 */
function scoreContextRecall(results: SearchResult[], keywords: string[]): number {
  if (keywords.length === 0) return 1;
  const upperKeywords = keywords.map((k) => k.toUpperCase());
  const allContent = results
    .map((r) => (r.content + " " + r.paragraphName + " " + r.division + " " + r.filePath).toUpperCase())
    .join(" ");

  let foundCount = 0;
  for (const kw of upperKeywords) {
    if (allContent.includes(kw)) foundCount++;
  }

  return foundCount / upperKeywords.length;
}

/**
 * Answer Faithfulness: Does the answer reference the retrieved files?
 */
function scoreAnswerFaithfulness(answer: string, results: SearchResult[]): number {
  if (!answer || results.length === 0) return 0;
  const answerUpper = answer.toUpperCase();

  let referencedSources = 0;
  for (const result of results) {
    const fileName = result.filePath.split("/").pop()?.toUpperCase() || "";
    if (fileName && answerUpper.includes(fileName)) referencedSources++;
    if (answerUpper.includes(`LINE ${result.lineStart}`) || answerUpper.includes(`L${result.lineStart}`)) {
      referencedSources++;
    }
  }

  return Math.min(referencedSources / Math.max(results.length, 1), 1);
}

/**
 * Similarity Score Quality: Average similarity of top results
 */
function scoreSimQuality(results: SearchResult[]): number {
  if (results.length === 0) return 0;
  return results.reduce((sum, r) => sum + r.score, 0) / results.length;
}

// ============================================
// Main Evaluation Runner
// ============================================

interface EvalResult {
  testCase: TestCase;
  retrievalPrecision: number;
  contextRecall: number;
  answerFaithfulness: number;
  avgSimilarity: number;
  latencyMs: number;
  resultsCount: number;
  topScore: number;
  filesHit: number;
  pass: boolean;
}

async function runEvaluation(): Promise<EvalResult[]> {
  console.log("🎓 COBOL Academy — Evaluation Suite");
  console.log("====================================");
  console.log("Target: GnuCOBOL codebase (compiler tests, copybooks, utilities)\n");

  const results: EvalResult[] = [];

  for (const testCase of TEST_CASES) {
    console.log(`\n📝 Test ${testCase.id}: "${testCase.query}"`);
    console.log(`   Expected: ${testCase.expectedResultType}`);

    const startTime = Date.now();

    // Step 1: Search
    const searchResults = await searchCodebase(testCase.query, 5);
    const searchLatency = Date.now() - startTime;

    // Step 2: Generate answer
    let answer = "";
    try {
      answer = await generateAnswer(testCase.query, searchResults);
    } catch (e) {
      console.log(`   ⚠️ Answer generation failed: ${e}`);
    }

    const totalLatency = Date.now() - startTime;

    // Step 3: Score
    const retrievalPrecision = scoreRetrievalPrecision(searchResults, testCase.relevanceKeywords);
    const contextRecall = scoreContextRecall(searchResults, testCase.relevanceKeywords);
    const answerFaithfulness = scoreAnswerFaithfulness(answer, searchResults);
    const avgSimilarity = scoreSimQuality(searchResults);
    const uniqueFiles = new Set(searchResults.map((r) => r.filePath)).size;

    const pass = retrievalPrecision >= 0.4 && searchResults.length > 0;

    const evalResult: EvalResult = {
      testCase,
      retrievalPrecision,
      contextRecall,
      answerFaithfulness,
      avgSimilarity,
      latencyMs: totalLatency,
      resultsCount: searchResults.length,
      topScore: searchResults[0]?.score || 0,
      filesHit: uniqueFiles,
      pass,
    };

    results.push(evalResult);

    console.log(`   Results: ${searchResults.length} chunks from ${uniqueFiles} files`);
    console.log(`   Top similarity: ${(evalResult.topScore * 100).toFixed(1)}%`);
    console.log(`   Retrieval Precision: ${(retrievalPrecision * 100).toFixed(0)}%`);
    console.log(`   Context Recall: ${(contextRecall * 100).toFixed(0)}%`);
    console.log(`   Answer Faithfulness: ${(answerFaithfulness * 100).toFixed(0)}%`);
    console.log(`   Latency: ${totalLatency}ms (search: ${searchLatency}ms)`);
    console.log(`   ${pass ? "✅ PASS" : "❌ FAIL"}: ${testCase.evaluationCriteria}`);
  }

  return results;
}

function printSummary(results: EvalResult[]) {
  console.log("\n\n📊 EVALUATION SUMMARY");
  console.log("====================\n");

  const passCount = results.filter((r) => r.pass).length;
  const avgPrecision = results.reduce((s, r) => s + r.retrievalPrecision, 0) / results.length;
  const avgRecall = results.reduce((s, r) => s + r.contextRecall, 0) / results.length;
  const avgFaithfulness = results.reduce((s, r) => s + r.answerFaithfulness, 0) / results.length;
  const avgLatency = results.reduce((s, r) => s + r.latencyMs, 0) / results.length;
  const avgSim = results.reduce((s, r) => s + r.avgSimilarity, 0) / results.length;

  console.log(`Tests Passed: ${passCount}/${results.length}`);
  console.log(`\nAggregate Metrics:`);
  console.log(`  Avg Retrieval Precision: ${(avgPrecision * 100).toFixed(1)}%`);
  console.log(`  Avg Context Recall:      ${(avgRecall * 100).toFixed(1)}%`);
  console.log(`  Avg Answer Faithfulness: ${(avgFaithfulness * 100).toFixed(1)}%`);
  console.log(`  Avg Similarity Score:    ${(avgSim * 100).toFixed(1)}%`);
  console.log(`  Avg End-to-End Latency:  ${avgLatency.toFixed(0)}ms`);
  console.log(`  p50 Latency:             ${results.sort((a, b) => a.latencyMs - b.latencyMs)[Math.floor(results.length / 2)]?.latencyMs}ms`);

  console.log("\n\nPer-Query Breakdown:");
  console.log("┌────┬──────────────────────────────────────────┬──────────┬─────────┬───────────┬──────────┐");
  console.log("│ #  │ Query                                    │ Precis.  │ Recall  │ Faith.    │ Latency  │");
  console.log("├────┼──────────────────────────────────────────┼──────────┼─────────┼───────────┼──────────┤");

  for (const r of results) {
    const q = r.testCase.query.substring(0, 40).padEnd(40);
    const p = `${(r.retrievalPrecision * 100).toFixed(0)}%`.padStart(6);
    const rc = `${(r.contextRecall * 100).toFixed(0)}%`.padStart(5);
    const f = `${(r.answerFaithfulness * 100).toFixed(0)}%`.padStart(7);
    const l = `${r.latencyMs}ms`.padStart(7);
    const status = r.pass ? "✅" : "❌";
    console.log(`│ ${status} │ ${q} │ ${p}  │ ${rc}  │ ${f}  │ ${l} │`);
  }

  console.log("└────┴──────────────────────────────────────────┴──────────┴─────────┴───────────┴──────────┘");

  console.log("\n\nPerformance Targets:");
  console.log(`  Query latency <3s:        ${avgLatency < 3000 ? "✅ PASS" : "❌ FAIL"} (${avgLatency.toFixed(0)}ms)`);
  console.log(`  Precision >70% in top-5:  ${avgPrecision >= 0.7 ? "✅ PASS" : "⚠️  " + (avgPrecision * 100).toFixed(0) + "%"}`);
  console.log(`  Answer accuracy:          ${avgFaithfulness > 0.2 ? "✅ PASS" : "⚠️  needs improvement"}`);
}

// Run
async function main() {
  const results = await runEvaluation();
  printSummary(results);
}

main().catch((error) => {
  console.error("❌ Evaluation failed:", error);
  process.exit(1);
});
