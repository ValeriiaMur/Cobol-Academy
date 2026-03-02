"use client";

import { useState, useCallback } from "react";
import Hero from "@/components/Hero";
import StatsBar from "@/components/StatsBar";
import QueryInterface from "@/components/QueryInterface";
import AnalyticsPanel from "@/components/AnalyticsPanel";
import CrisisSection from "@/components/CrisisSection";
import FeaturesSection from "@/components/FeaturesSection";
import Footer from "@/components/Footer";

interface QueryLog {
  query: string;
  latencyMs: number;
  resultsCount: number;
  topScore: number;
  timestamp: number;
}

interface SearchResult {
  score: number;
  filePath: string;
  division: string;
  chunkType: string;
  lineStart: number;
  lineEnd: number;
  paragraphName: string;
}

export default function Home() {
  const [showQuery, setShowQuery] = useState(false);
  const [currentResults, setCurrentResults] = useState<SearchResult[]>([]);
  const [queryHistory, setQueryHistory] = useState<QueryLog[]>([]);
  const [latencyMs, setLatencyMs] = useState(0);

  const handleQueryComplete = useCallback(
    (results: SearchResult[], query: string, latency: number) => {
      setCurrentResults(results);
      setLatencyMs(latency);
      if (results.length > 0) {
        setQueryHistory((prev) => [
          ...prev,
          {
            query,
            latencyMs: latency,
            resultsCount: results.length,
            topScore: results[0]?.score || 0,
            timestamp: Date.now(),
          },
        ]);
      }
    },
    []
  );

  return (
    <main className="min-h-screen">
      <Hero onStartLearning={() => setShowQuery(true)} />

      {showQuery && (
        <section
          id="query"
          className="py-12 relative"
          style={{
            background: "linear-gradient(180deg, #0f1a2e 0%, #162038 30%, #162038 70%, #0f1a2e 100%)",
            borderTop: "1px solid rgba(0, 212, 170, 0.1)",
            borderBottom: "1px solid rgba(0, 212, 170, 0.1)",
            boxShadow: "inset 0 1px 30px rgba(0, 212, 170, 0.03), inset 0 -1px 30px rgba(0, 212, 170, 0.03)",
          }}
        >
          {/* Subtle "LIVE APP" indicator */}
          <div className="max-w-5xl mx-auto mb-6 flex items-center justify-center">
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#00d4aa]/10 border border-[#00d4aa]/20">
              <span className="w-2 h-2 rounded-full bg-[#00d4aa] animate-pulse" />
              <span className="text-xs font-medium text-[#00d4aa]">LIVE — Ask the COBOL Codebase</span>
            </div>
          </div>

          <StatsBar />
          <QueryInterface onQueryComplete={handleQueryComplete} />
          <AnalyticsPanel
            currentResults={currentResults}
            queryHistory={queryHistory}
            latencyMs={latencyMs}
          />
        </section>
      )}

      <CrisisSection />
      <FeaturesSection />
      <Footer />
    </main>
  );
}
