"use client";

import { useState, useEffect } from "react";

interface IndexStats {
  index: {
    name: string;
    dimension: number;
    metric: string;
    host: string;
    status: string;
  };
  vectors: {
    total: number;
    namespaces: Record<string, { recordCount: number }>;
    indexFullness: number;
  };
  config: {
    embeddingModel: string;
    llmModel: string;
    topK: number;
    chunkingStrategy: string;
  };
}

export default function StatsBar() {
  const [stats, setStats] = useState<IndexStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/stats");
        if (!res.ok) throw new Error("Failed to fetch stats");
        const data = await res.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Stats unavailable");
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto mb-8">
        <div className="rounded-xl bg-[#0d1520] border border-[#1a2744] p-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[#1a2744]" />
            <div className="h-3 w-48 bg-[#1a2744] rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="max-w-5xl mx-auto mb-8">
        <div className="rounded-xl bg-[#0d1520] border border-red-500/20 p-4">
          <div className="flex items-center gap-2 text-xs text-red-400">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            Index not connected — run <code className="bg-[#0a0e17] px-1.5 py-0.5 rounded">npm run ingest</code> first
          </div>
        </div>
      </div>
    );
  }

  const namespaceCount = Object.keys(stats.vectors.namespaces).length;

  return (
    <div className="max-w-5xl mx-auto mb-8">
      <div className="rounded-xl bg-[#0d1520] border border-[#1a2744] overflow-hidden">
        {/* Compact Stats Row */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-5 py-3 flex items-center justify-between hover:bg-[#111b2e]/50 transition-colors"
        >
          <div className="flex items-center gap-6">
            {/* Status indicator */}
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${stats.index.status === "ready" ? "bg-[#00d4aa]" : "bg-[#ffd93d]"}`} />
              <span className="text-xs font-mono text-[#64748b]">
                {stats.index.name}
              </span>
            </div>

            {/* Key stats inline */}
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-[#4a5568]">Vectors:</span>
                <span className="text-[#00d4aa] font-mono font-medium">
                  {stats.vectors.total.toString()}
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-1.5">
                <span className="text-[#4a5568]">Dims:</span>
                <span className="text-[#e2e8f0] font-mono">
                  {stats.index.dimension}
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-1.5">
                <span className="text-[#4a5568]">Metric:</span>
                <span className="text-[#e2e8f0] font-mono">
                  {stats.index.metric}
                </span>
              </div>
              <div className="hidden md:flex items-center gap-1.5">
                <span className="text-[#4a5568]">Model:</span>
                <span className="text-[#e2e8f0] font-mono">
                  {stats.config.embeddingModel}
                </span>
              </div>
            </div>
          </div>

          <span className="text-[#4a5568] text-xs">
            {expanded ? "▲" : "▼"} details
          </span>
        </button>

        {/* Expanded Details */}
        {expanded && (
          <div className="border-t border-[#1a2744] px-5 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {/* Vector Count */}
              <div className="bg-[#0a0e17] rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wider text-[#4a5568] mb-1">
                  Total Vectors
                </div>
                <div className="text-xl font-bold text-[#00d4aa] font-mono">
                  {stats.vectors.total.toString()}
                </div>
                <div className="text-[10px] text-[#4a5568] mt-0.5">
                  chunks indexed in Pinecone
                </div>
              </div>

              {/* Dimensions */}
              <div className="bg-[#0a0e17] rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wider text-[#4a5568] mb-1">
                  Dimensions
                </div>
                <div className="text-xl font-bold text-[#e2e8f0] font-mono">
                  {stats.index.dimension}
                </div>
                <div className="text-[10px] text-[#4a5568] mt-0.5">
                  embedding vector size
                </div>
              </div>

              {/* Namespaces */}
              <div className="bg-[#0a0e17] rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wider text-[#4a5568] mb-1">
                  Namespaces
                </div>
                <div className="text-xl font-bold text-[#e2e8f0] font-mono">
                  {Math.max(namespaceCount, 1)}
                </div>
                <div className="text-[10px] text-[#4a5568] mt-0.5">
                  logical partitions
                </div>
              </div>

              {/* Index Fullness */}
              <div className="bg-[#0a0e17] rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wider text-[#4a5568] mb-1">
                  Index Fullness
                </div>
                <div className="text-xl font-bold text-[#e2e8f0] font-mono">
                  {(stats.vectors.indexFullness * 100).toFixed(1)}%
                </div>
                <div className="text-[10px] text-[#4a5568] mt-0.5">
                  of free tier capacity
                </div>
              </div>
            </div>

            {/* Pipeline Config */}
            <div className="bg-[#0a0e17] rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wider text-[#4a5568] mb-2">
                RAG Pipeline Configuration
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[#4a5568]">Embedding: </span>
                  <span className="text-[#00d4aa] font-mono">{stats.config.embeddingModel}</span>
                </div>
                <div>
                  <span className="text-[#4a5568]">LLM: </span>
                  <span className="text-[#00d4aa] font-mono">{stats.config.llmModel}</span>
                </div>
                <div>
                  <span className="text-[#4a5568]">Retrieval: </span>
                  <span className="text-[#e2e8f0] font-mono">Top-{stats.config.topK} {stats.index.metric}</span>
                </div>
                <div>
                  <span className="text-[#4a5568]">Chunking: </span>
                  <span className="text-[#e2e8f0] font-mono">paragraph-level</span>
                </div>
              </div>
            </div>

            {/* Namespace breakdown if multiple */}
            {namespaceCount > 0 && (
              <div className="mt-3 bg-[#0a0e17] rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wider text-[#4a5568] mb-2">
                  Namespace Breakdown
                </div>
                <div className="space-y-1">
                  {Object.entries(stats.vectors.namespaces).map(([ns, data]) => (
                    <div key={ns} className="flex items-center justify-between text-xs">
                      <span className="font-mono text-[#94a3b8]">
                        {ns || "(default)"}
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="w-32 h-1.5 bg-[#1a2744] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#00d4aa] rounded-full"
                            style={{
                              width: `${Math.min((data.recordCount / stats.vectors.total) * 100, 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-[#00d4aa] font-mono w-16 text-right">
                          {data.recordCount.toString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
