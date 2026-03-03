/**
 * Tests for the evaluation framework.
 * Tests scoring computations and aggregate logic without requiring API keys.
 */

import { describe, it, expect } from "vitest";
import {
  measureLatency,
  computeAggregateScore,
  computeEvalSummary,
  EvalResult,
  EvalTestCase,
} from "@/lib/evaluator";

function makeMetricScore(name: string, score: number) {
  return { name, score, details: "test" };
}

function makeEvalResult(aggregateScore: number, latencyMs: number = 1000): EvalResult {
  const testCase: EvalTestCase = {
    id: "test-1",
    query: "test query",
    expectedKeywords: ["test"],
    category: "explanation",
  };

  return {
    testCase,
    metrics: {
      contextPrecision: makeMetricScore("Context Precision", aggregateScore),
      contextRecall: makeMetricScore("Context Recall", aggregateScore),
      faithfulness: makeMetricScore("Faithfulness", aggregateScore),
      answerRelevancy: makeMetricScore("Answer Relevancy", aggregateScore),
      latency: measureLatency(latencyMs),
    },
    aggregateScore,
    retrievedChunks: 5,
    topScore: 0.85,
    latencyMs,
    answer: "Test answer",
    pass: aggregateScore >= 0.7,
  };
}

describe("evaluator", () => {
  describe("measureLatency", () => {
    it("gives perfect score for very fast responses", () => {
      const result = measureLatency(500); // 500ms, well under 3s target
      expect(result.score).toBe(1.0);
    });

    it("gives good score at target boundary", () => {
      const result = measureLatency(3000);
      expect(result.score).toBeCloseTo(0.5, 1);
    });

    it("gives zero for very slow responses", () => {
      const result = measureLatency(10000);
      expect(result.score).toBe(0);
    });

    it("gives moderate score for mid-range latency", () => {
      const result = measureLatency(2000);
      expect(result.score).toBeGreaterThan(0.5);
      expect(result.score).toBeLessThan(1.0);
    });

    it("includes latency in details", () => {
      const result = measureLatency(1500);
      expect(result.details).toContain("1500ms");
      expect(result.details).toContain("3000ms");
    });
  });

  describe("computeAggregateScore", () => {
    it("returns weighted average of all metrics", () => {
      const metrics = {
        contextPrecision: makeMetricScore("CP", 1.0),
        contextRecall: makeMetricScore("CR", 1.0),
        faithfulness: makeMetricScore("F", 1.0),
        answerRelevancy: makeMetricScore("AR", 1.0),
        latency: makeMetricScore("L", 1.0),
      };
      expect(computeAggregateScore(metrics)).toBeCloseTo(1.0);
    });

    it("returns 0 when all metrics are 0", () => {
      const metrics = {
        contextPrecision: makeMetricScore("CP", 0),
        contextRecall: makeMetricScore("CR", 0),
        faithfulness: makeMetricScore("F", 0),
        answerRelevancy: makeMetricScore("AR", 0),
        latency: makeMetricScore("L", 0),
      };
      expect(computeAggregateScore(metrics)).toBe(0);
    });

    it("weights precision and recall equally at 25% each", () => {
      const metrics = {
        contextPrecision: makeMetricScore("CP", 1.0),
        contextRecall: makeMetricScore("CR", 0.0),
        faithfulness: makeMetricScore("F", 0.0),
        answerRelevancy: makeMetricScore("AR", 0.0),
        latency: makeMetricScore("L", 0.0),
      };
      expect(computeAggregateScore(metrics)).toBeCloseTo(0.25);
    });
  });

  describe("computeEvalSummary", () => {
    it("computes correct pass rate", () => {
      const results = [
        makeEvalResult(0.8),
        makeEvalResult(0.9),
        makeEvalResult(0.5),
      ];
      const summary = computeEvalSummary(results);
      expect(summary.totalTests).toBe(3);
      expect(summary.passed).toBe(2);
      expect(summary.failed).toBe(1);
      expect(summary.passRate).toBeCloseTo(2 / 3);
    });

    it("computes average latency", () => {
      const results = [
        makeEvalResult(0.8, 1000),
        makeEvalResult(0.9, 2000),
        makeEvalResult(0.7, 3000),
      ];
      const summary = computeEvalSummary(results);
      expect(summary.averageLatencyMs).toBeCloseTo(2000);
    });

    it("includes timestamp", () => {
      const results = [makeEvalResult(0.8)];
      const summary = computeEvalSummary(results);
      expect(summary.timestamp).toBeTruthy();
      expect(new Date(summary.timestamp).getTime()).toBeGreaterThan(0);
    });

    it("handles empty results array", () => {
      const summary = computeEvalSummary([]);
      expect(summary.totalTests).toBe(0);
      expect(summary.passed).toBe(0);
      expect(summary.passRate).toBe(0);
    });
  });
});
