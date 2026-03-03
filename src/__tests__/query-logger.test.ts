import { describe, it, expect, beforeEach } from "vitest";
import {
  logQuery,
  getSessionLog,
  getSessionMetrics,
  clearSessionLog,
} from "../lib/query-logger";

describe("query-logger", () => {
  beforeEach(() => {
    clearSessionLog();
  });

  describe("logQuery", () => {
    it("creates a full log entry with defaults", () => {
      const entry = logQuery({ query: "test query", type: "search" });
      expect(entry.query).toBe("test query");
      expect(entry.type).toBe("search");
      expect(entry.success).toBe(true);
      expect(entry.requestId).toMatch(/^req_/);
      expect(entry.timestamp).toBeDefined();
    });

    it("stores entries in session log", () => {
      logQuery({ query: "q1", type: "search" });
      logQuery({ query: "q2", type: "answer" });
      const log = getSessionLog();
      expect(log.length).toBe(2);
      expect(log[0].query).toBe("q1");
      expect(log[1].query).toBe("q2");
    });

    it("merges provided fields with defaults", () => {
      const entry = logQuery({
        query: "test",
        type: "search",
        topK: 10,
        resultsCount: 3,
        topScore: 0.95,
        totalLatencyMs: 150,
      });
      expect(entry.topK).toBe(10);
      expect(entry.resultsCount).toBe(3);
      expect(entry.topScore).toBe(0.95);
    });
  });

  describe("circular buffer behavior", () => {
    it("limits log to max size and maintains order", () => {
      // The max is 100, so add 105 entries
      for (let i = 0; i < 105; i++) {
        logQuery({ query: `query-${i}`, type: "search" });
      }
      const log = getSessionLog();
      expect(log.length).toBe(100);
      // Oldest 5 should be evicted, first entry should be query-5
      expect(log[0].query).toBe("query-5");
      expect(log[99].query).toBe("query-104");
    });
  });

  describe("getSessionLog", () => {
    it("returns a copy, not a reference", () => {
      logQuery({ query: "test", type: "search" });
      const log1 = getSessionLog();
      const log2 = getSessionLog();
      expect(log1).not.toBe(log2);
      expect(log1).toEqual(log2);
    });
  });

  describe("getSessionMetrics", () => {
    it("returns zeros for empty log", () => {
      const metrics = getSessionMetrics();
      expect(metrics.totalQueries).toBe(0);
      expect(metrics.avgLatencyMs).toBe(0);
      expect(metrics.errorRate).toBe(0);
    });

    it("calculates correct averages", () => {
      logQuery({
        query: "q1",
        type: "search",
        topScore: 0.9,
        totalLatencyMs: 100,
        resultsCount: 5,
      });
      logQuery({
        query: "q2",
        type: "search",
        topScore: 0.8,
        totalLatencyMs: 200,
        resultsCount: 3,
      });

      const metrics = getSessionMetrics();
      expect(metrics.totalQueries).toBe(2);
      expect(metrics.successfulQueries).toBe(2);
      expect(metrics.avgLatencyMs).toBe(150);
      expect(metrics.avgTopScore).toBe(0.85);
    });

    it("handles all-error logs without division by zero", () => {
      logQuery({
        query: "q1",
        type: "search",
        success: false,
        totalLatencyMs: 500,
      });

      const metrics = getSessionMetrics();
      expect(metrics.totalQueries).toBe(1);
      expect(metrics.errorCount).toBe(1);
      expect(metrics.errorRate).toBe(1);
      // Should not throw or return NaN
      expect(isNaN(metrics.avgLatencyMs)).toBe(false);
    });
  });

  describe("clearSessionLog", () => {
    it("empties the log", () => {
      logQuery({ query: "test", type: "search" });
      expect(getSessionLog().length).toBe(1);
      clearSessionLog();
      expect(getSessionLog().length).toBe(0);
    });
  });
});
